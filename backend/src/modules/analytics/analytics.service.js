/** Orquestación de consultas autorizadas, sin escrituras. */
import { HttpError } from '../../shared/errors/HttpError.js';
import { createGroupAccess } from '../groups/groups.access.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import { computeCoverage, CURRICULUM_REVIEW_NOTICE, isSkillInGrade, skillGradesLabel } from '../curriculum/curriculum.domain.js';
import { buildStudentSkills, summarizeGroupSkills, countStudentsNeedingSupport,
  findWeakestSkill, selectRecommendedActivity, toHistoryDto, parseAnalyticsSelection,
  selectAnalyticsStudents, summarizeGroupEvidence, summarizeAutonomyProgress, buildNextStep } from './analytics.domain.js';
import { renderAnalyticsPdf, renderAnalyticsXlsx, renderSchoolPdf } from './analytics.export.js';
import { buildSchoolPriorities, currentSchoolYear, mapSkillsToFields, mergeTypicalErrors, summarizeFields,
  summarizeSchool, summarizeSchoolGroup, summarizeSkills, summarizeTeachers, nextCteSession } from './analytics.school.domain.js';

const groupDto = (group) => ({ id: group.id, grade: group.grade, section: group.section, schoolYear: group.school_year });
const studentDto = (student) => ({ id: student.id, name: `${student.first_names} ${student.last_names}`,
  initials: student.initials, avatarColor: student.avatar_color });
const errorDtos = (rows) => rows.map((row) => ({ skillCode: row.skill_code,
  errorTag: row.error_tag, explanation: row.explanation, count: row.count, studentCount: row.student_count }));
const meta = { contentReview: CURRICULUM_REVIEW_NOTICE };

/** Fecha de hoy (`AAAA-MM-DD`) en la zona horaria de las escuelas (Ciudad de México). */
const todayInMexico = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);

export function createAnalyticsService({ repository, groupsRepository, curriculumRepository, now = () => new Date() }) {
  const { findReadableGroup } = createGroupAccess(groupsRepository);
  const service = {
    getGroup(auth, groupId, query = {}) {
      const group = findReadableGroup(auth, groupId);
      const skillRows = repository.listSkills();
      const selection = parseAnalyticsSelection(query, skillRows);
      const history = repository.listGroupHistory(group.id, group.school_id);
      const students = groupsRepository.listActiveStudents(group.id).map((student) => ({
        ...studentDto(student), skills: buildStudentSkills(skillRows, history.filter((cut) => cut.student_id === student.id)),
      }));
      const skills = summarizeGroupSkills(skillRows, students);
      const weakestSkill = findWeakestSkill(skills);
      const contents = curriculumRepository.listContentsWithProgress(group.id, group.grade);
      const coverage = computeCoverage(contents.length, contents.map((content) => ({ status: content.status ?? 'pending' })));
      const typicalErrors = errorDtos(repository.listTypicalErrors(group.id, group.school_id));
      const selectedStudents = selectAnalyticsStudents(students, selection);
      const currentGradeEvidence = Boolean(weakestSkill?.gradeCounts?.[group.grade]);
      const recommendedActivity = currentGradeEvidence
        ? selectRecommendedActivity(repository.listActivities(group.grade), weakestSkill.code, typicalErrors)
        : null;
      return { data: { group: groupDto(group), skills, students: selectedStudents,
        selection: { ...selection, studentCount: selectedStudents.length }, summary: {
        studentCount: students.length, needsSupportCount: countStudentsNeedingSupport(students),
        ...summarizeGroupEvidence(students),
        weakestSkill, coverage, typicalErrors, recommendedActivity,
        autonomyProgress: summarizeAutonomyProgress(skillRows, students),
        nextStep: buildNextStep(weakestSkill, typicalErrors, recommendedActivity, group.grade),
      } }, meta };
    },
    getStudent(auth, groupId, studentId) {
      const group = findReadableGroup(auth, groupId);
      const id = parsePositiveId(studentId, 'id del alumno');
      const student = groupsRepository.findActiveStudentInGroup(id, group.id);
      if (!student) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'No encontramos ese alumno en el grupo.');
      const history = repository.listStudentHistory(group.id, group.school_id, id);
      const skills = buildStudentSkills(repository.listSkills(), history);
      const weakestSkill = findWeakestSkill(skills.map((skill) => ({ ...skill, average: skill.masteryPercentage })));
      const typicalErrors = errorDtos(repository.listTypicalErrors(group.id, group.school_id, id));
      return { data: { group: groupDto(group), student: studentDto(student), skills,
        history: history.map(toHistoryDto).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id - b.id),
        typicalErrors,
        recommendedActivity: weakestSkill?.grade === group.grade
          ? selectRecommendedActivity(repository.listActivities(group.grade), weakestSkill.code, typicalErrors) : null,
      }, meta };
    },
    /**
     * Panel de Dirección: agregados del ciclo actual de la escuela del director (`auth.schoolId`).
     * Sin nombres ni folios de alumnos.
     */
    getSchool(auth) {
      const school = repository.findSchool(auth.schoolId);
      if (!school) throw new HttpError(404, 'SCHOOL_NOT_FOUND', 'No encontramos tu escuela.');
      const allGroups = repository.listSchoolGroups(school.id);
      const schoolYear = currentSchoolYear(allGroups);
      const skillRows = repository.listSkills();
      const fieldSkills = mapSkillsToFields(repository.listSkillFields());
      const allStudents = [];
      const errorsPerGroup = [];
      const currentGroups = allGroups.filter((g) => g.school_year === schoolYear);
      const groups = currentGroups.map((group) => {
        // Solo las habilidades del programa de su grado (p. ej. fracciones desde 3.º) y cortes de ese grado.
        const gradeSkills = skillRows.filter((s) => isSkillInGrade(s.code, group.grade));
        const history = repository.listGroupHistory(group.id, school.id).filter((cut) => cut.grade === group.grade);
        const students = groupsRepository.listActiveStudents(group.id).map((student) => ({
          skills: buildStudentSkills(gradeSkills, history.filter((cut) => cut.student_id === student.id)),
        }));
        allStudents.push(...students);
        errorsPerGroup.push(errorDtos(repository.listGroupErrorTags(group.id, school.id))
          .filter((e) => isSkillInGrade(e.skillCode, group.grade)));
        const contents = curriculumRepository.listContentsWithProgress(group.id, group.grade);
        const coverage = computeCoverage(contents.length, contents.map((c) => ({ status: c.status ?? 'pending' })));
        return summarizeSchoolGroup({ id: group.id, grade: group.grade, section: group.section,
          schoolYear: group.school_year, teacherName: group.teacher_name }, students, gradeSkills, fieldSkills, coverage);
      });
      const skills = summarizeSkills(allStudents, skillRows)
        .map((s) => ({ ...s, grades: skillGradesLabel(s.code) }));
      const teacherIds = currentGroups.map((g) => g.teacher_id);
      return { data: {
        school: { id: school.id, name: school.name, schoolYear },
        summary: { ...summarizeSchool(groups, teacherIds),
          latestRecordedAt: summarizeGroupEvidence(allStudents).latestRecordedAt },
        fields: summarizeFields(allStudents, fieldSkills, skillRows),
        skills,
        groups,
        teachers: summarizeTeachers(currentGroups.map((g, i) => ({ teacherId: g.teacher_id, group: groups[i] }))),
        cte: schoolYear ? nextCteSession(todayInMexico(now()), schoolYear) : null,
        priorities: buildSchoolPriorities(groups, skills),
        typicalErrors: mergeTypicalErrors(errorsPerGroup, skillRows),
      }, meta: { ...meta, source: 'SEP, Plan de Estudio 2022 (campos formativos)' } };
    },
    /** Panel de la escuela en PDF Carta B/N (solo agregados; sin datos de alumnos). */
    async exportSchool(auth) {
      const { data } = service.getSchool(auth);
      return { buffer: await renderSchoolPdf(data), filename: `panel-escuela-${data.school.schoolYear ?? 'ciclo'}.pdf`,
        contentType: 'application/pdf' };
    },
    async exportGroup(auth, groupId, query, format) {
      const { data } = service.getGroup(auth, groupId, query);
      const buffer = await (format === 'xlsx' ? renderAnalyticsXlsx(data) : renderAnalyticsPdf(data));
      return { buffer, filename: `diagnostico-grupo-${data.group.id}.${format}`,
        contentType: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' };
    },
  };
  return service;
}
