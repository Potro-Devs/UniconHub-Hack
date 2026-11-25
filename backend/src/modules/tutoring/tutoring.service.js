/** Casos de uso de la Red de tutores: propuesta, sesión, demostración, tarjetas y red. */
import { HttpError } from '../../shared/errors/HttpError.js';
import { createGroupAccess } from '../groups/groups.access.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import { buildStudentSkills } from '../analytics/analytics.domain.js';
import { buildPairingProposal, canTeach, classifyDemonstration, chooseCardQuestions, buildCardScript,
  latestDemonstrations, isReadyToTeach, parseDemonstrationInput, parseSessionInput, summarizeNetwork,
  MAX_TUTEES_PER_TUTOR, QUESTION_FRAMES, TUTOR_RULES, DEMONSTRATION_ITEMS, needsTutoring,
  pickTuteeErrorTag, assertDemonstrationQuestions } from './tutoring.domain.js';
import { renderTeacherKeyPdf, renderTutorCardsPdf } from './tutoring.pdf.js';

const groupDto = (group) => ({ id: group.id, grade: group.grade, section: group.section, schoolYear: group.school_year });
const studentDto = (student) => ({ id: student.id, name: `${student.first_names} ${student.last_names}`,
  initials: student.initials, avatarColor: student.avatar_color });
const meta = { contentReview: 'Guiones y frases de pregunta por validar con docente de primaria.' };
const skillNotFound = () => new HttpError(404, 'SKILL_NOT_FOUND', 'No encontramos esa habilidad.');

export function createTutoringService({ repository, groupsRepository, analyticsRepository, transaction = (fn) => fn() }) {
  const { findReadableGroup, findOwnGroup } = createGroupAccess(groupsRepository);

  /** Fotografía del grupo: alumnos con dominio por habilidad y demostraciones 3/3 por habilidad. */
  function loadGroupState(group) {
    const skills = analyticsRepository.listSkills();
    const history = analyticsRepository.listGroupHistory(group.id, group.school_id);
    const students = groupsRepository.listActiveStudents(group.id).map((student) => ({
      ...studentDto(student), skills: buildStudentSkills(skills, history.filter((cut) => cut.student_id === student.id)),
    }));
    const pairRows = repository.listPairsOfGroup(group.id);
    const readyBySkill = new Map(skills.map((skill) => {
      const latest = latestDemonstrations(pairRows.filter((row) => row.skill_code === skill.code));
      return [skill.code, new Set([...latest.values()].filter((row) => isReadyToTeach(row.demo_correct))
        .map((row) => row.tutee_student_id))];
    }));
    return { skills, students, pairRows, readyBySkill };
  }

  const skillView = (students, readyBySkill, code) => students.map((student) => {
    const result = student.skills.find((entry) => entry.code === code);
    return { ...student, masteryPercentage: result?.masteryPercentage ?? null, level: result?.level ?? null,
      label: result?.label ?? 'Sin evaluar', readyToTeach: readyBySkill.get(code)?.has(student.id) ?? false };
  });

  function errorMaps(group, skillId) {
    const errorsByStudent = new Map();
    for (const row of repository.listErrorCounts(group.id, group.school_id, skillId)) {
      if (!errorsByStudent.has(row.student_id)) errorsByStudent.set(row.student_id, []);
      errorsByStudent.get(row.student_id).push({ errorTag: row.error_tag, count: row.count });
    }
    const overcomeByStudent = new Map();
    for (const row of repository.listPastErrors(group.id, group.school_id, skillId)) {
      if (!overcomeByStudent.has(row.student_id)) overcomeByStudent.set(row.student_id, new Set());
      overcomeByStudent.get(row.student_id).add(row.error_tag);
    }
    const explanations = new Map(repository.listErrorExplanations(skillId).map((row) => [row.error_tag, row.explanation]));
    return { errorsByStudent, overcomeByStudent, explanations };
  }

  const skillCounts = (state) => state.skills.map((skill) => {
    const view = skillView(state.students, state.readyBySkill, skill.code);
    return { code: skill.code, name: skill.name,
      tutorCount: view.filter((s) => canTeach(s, s.readyToTeach)).length,
      tuteeCount: view.filter((s) => needsTutoring(s, s.readyToTeach)).length };
  });

  /** Por defecto, la habilidad con más compañeros por acompañar que sí tiene tutores. */
  const defaultSkill = (counts) => [...counts].sort((a, b) =>
    Number(b.tutorCount > 0) - Number(a.tutorCount > 0) || b.tuteeCount - a.tuteeCount)[0];

  const sessionDto = (row, pairs, byId) => ({
    id: row.id, createdAt: row.created_at, note: row.note, skillCode: row.skill_code, skillName: row.skill_name,
    pairs: pairs.filter((pair) => pair.session_id === row.id).map((pair) => ({
      id: pair.id,
      tutor: pair.tutor_student_id === null ? null : byId.get(pair.tutor_student_id) ?? null,
      // El tutor dejó el grupo: la pareja pasa a la maestra y se avisa en lugar de ocultarlo.
      tutorInactive: pair.tutor_student_id !== null && !byId.has(pair.tutor_student_id),
      tutee: byId.get(pair.tutee_student_id) ?? null,
      errorTag: pair.target_error_tag, explanation: pair.error_explanation ?? null,
      tutorOvercameError: pair.tutor_overcame_error === 1,
      demonstration: classifyDemonstration(pair.demo_correct), demonstratedAt: pair.demo_recorded_at,
    })).filter((pair) => pair.tutee),
  });

  return {
    getProposal(auth, groupId, query = {}) {
      const group = findReadableGroup(auth, groupId);
      const state = loadGroupState(group);
      const counts = skillCounts(state);
      if (query.skillCode !== undefined && (typeof query.skillCode !== 'string'
        || !state.skills.some((skill) => skill.code === query.skillCode))) throw skillNotFound();
      const code = query.skillCode ?? defaultSkill(counts)?.code;
      const skill = state.skills.find((entry) => entry.code === code);
      if (!skill) throw skillNotFound();
      const view = skillView(state.students, state.readyBySkill, skill.code);
      const { errorsByStudent, overcomeByStudent, explanations } = errorMaps(group, skill.id);
      const proposal = buildPairingProposal({ students: view, errorsByStudent, overcomeByStudent,
        readyToTeachIds: state.readyBySkill.get(skill.code) });
      const byId = new Map(view.map((s) => [s.id, { id: s.id, name: s.name, initials: s.initials, avatarColor: s.avatarColor,
        masteryPercentage: s.masteryPercentage, level: s.level, label: s.label, readyToTeach: s.readyToTeach }]));
      const tutee = (entry) => ({ ...byId.get(entry.id), errorTag: entry.errorTag,
        explanation: entry.errorTag ? explanations.get(entry.errorTag) ?? null : null,
        tutorOvercameError: entry.tutorOvercameError ?? false });
      return { data: {
        group: groupDto(group), skill: { code: skill.code, name: skill.name }, skills: counts,
        maxPerTutor: MAX_TUTEES_PER_TUTOR,
        pairs: proposal.pairs.map((pair) => ({ tutor: byId.get(pair.tutorId), tutees: pair.tutees.map(tutee) })),
        teacherTable: proposal.teacherTable.map(tutee),
        availableTutors: proposal.availableTutorIds.map((id) => byId.get(id)),
        tutors: proposal.tutorIds.map((id) => byId.get(id)),
      }, meta };
    },

    createSession(auth, groupId, body) {
      const group = findOwnGroup(auth, groupId);
      const state = loadGroupState(group);
      const input = parseSessionInput(body, state.skills.map((skill) => skill.code));
      const skill = repository.findSkillByCode(input.skillCode);
      if (!skill) throw skillNotFound();
      const view = new Map(skillView(state.students, state.readyBySkill, skill.code).map((s) => [s.id, s]));
      for (const { tutorId, tuteeId } of input.pairs) {
        if (!view.has(tuteeId) || (tutorId !== null && !view.has(tutorId))) {
          throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Algún alumno ya no está activo en el grupo.');
        }
        const tutor = tutorId === null ? null : view.get(tutorId);
        if (tutor && !canTeach(tutor, tutor.readyToTeach)) {
          throw new HttpError(422, 'TUTOR_NOT_READY', `${tutor.name} todavía está practicando ${skill.name}; elige a otro compañero guía.`);
        }
      }
      const { errorsByStudent, overcomeByStudent } = errorMaps(group, skill.id);
      const rows = input.pairs.map(({ tutorId, tuteeId }) => {
        const errorTag = pickTuteeErrorTag(errorsByStudent.get(tuteeId));
        return { tutorId, tuteeId, errorTag,
          tutorOvercameError: Boolean(tutorId !== null && errorTag && overcomeByStudent.get(tutorId)?.has(errorTag)) };
      });
      const id = transaction(() => repository.createSession({ groupId: group.id, skillId: skill.id,
        userId: Number(auth.sub), note: input.note, rows }));
      const byId = new Map(state.students.map((s) => [s.id, { id: s.id, name: s.name, initials: s.initials, avatarColor: s.avatarColor }]));
      return sessionDto(repository.findSession(id, group.id), repository.listPairsOfGroup(group.id), byId);
    },

    listSessions(auth, groupId) {
      const group = findReadableGroup(auth, groupId);
      const state = loadGroupState(group);
      const byId = new Map(state.students.map((s) => [s.id, { id: s.id, name: s.name, initials: s.initials, avatarColor: s.avatarColor }]));
      const network = summarizeNetwork({ skills: state.skills, students: state.students,
        readyBySkill: state.readyBySkill, pairRows: state.pairRows });
      const teachers = state.students.map((student) => ({ ...byId.get(student.id),
        canTeach: state.skills.filter((skill) => canTeach(student.skills.find((entry) => entry.code === skill.code),
          state.readyBySkill.get(skill.code)?.has(student.id))).map((skill) => ({ code: skill.code, name: skill.name })) }));
      return { data: {
        group: groupDto(group),
        sessions: repository.listSessions(group.id).map((row) => sessionDto(row, state.pairRows, byId)),
        network: { ...network, students: teachers },
      }, meta };
    },

    recordDemonstration(auth, groupId, pairId, body) {
      const group = findOwnGroup(auth, groupId);
      const id = parsePositiveId(pairId, 'id de la pareja');
      const { correct } = parseDemonstrationInput(body);
      const existingPair = repository.findPairInGroup(id, group.id);
      if (!existingPair) {
        throw new HttpError(404, 'PAIR_NOT_FOUND', 'No encontramos ese equipo.');
      }
      assertDemonstrationQuestions(repository.listCardQuestions(existingPair.skill_id, group.grade));
      repository.recordDemonstration(id, correct);
      const pair = repository.findPairInGroup(id, group.id);
      return { id: pair.id, demonstration: classifyDemonstration(pair.demo_correct), demonstratedAt: pair.demo_recorded_at };
    },

    /** `part`: `cards` (se reparte a los tutores) o `key` (solo para la maestra). */
    async renderCards(auth, groupId, sessionId, part = 'cards') {
      const group = findReadableGroup(auth, groupId);
      const id = parsePositiveId(sessionId, 'id de la sesión');
      const row = repository.findSession(id, group.id);
      if (!row) throw new HttpError(404, 'SESSION_NOT_FOUND', 'No encontramos esa sesión de equipos.');
      const students = new Map(groupsRepository.listActiveStudents(group.id).map((s) => [s.id, studentDto(s)]));
      const session = sessionDto(row, repository.listPairsOfGroup(group.id), students);
      const questions = repository.listCardQuestions(row.skill_id, group.grade);
      assertDemonstrationQuestions(questions);
      const cards = session.pairs.map((pair) => {
        const { practice, demonstration } = chooseCardQuestions(questions, pair.errorTag);
        return { ...pair, script: buildCardScript(practice), practice, demonstration };
      });
      if (part === 'key') {
        return { buffer: await renderTeacherKeyPdf({ group: groupDto(group), session, cards,
          demonstrationItems: DEMONSTRATION_ITEMS }),
          filename: `guia-docente-equipo-${group.id}-${session.id}.pdf` };
      }
      const buffer = await renderTutorCardsPdf({ group: groupDto(group), session, cards,
        frames: QUESTION_FRAMES, rules: TUTOR_RULES, demonstrationItems: DEMONSTRATION_ITEMS });
      return { buffer, filename: `hojas-equipo-${group.id}-${session.id}.pdf` };
    },
  };
}
