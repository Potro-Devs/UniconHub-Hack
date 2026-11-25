/**
 * Módulo assessments — Capa 2 (Aplicación): banco de reactivos y asignación de pruebas.
 *
 * Autorización (idéntica a `groups`):
 * - `teacher`: solo sus grupos (`teacher_id = sub` y su escuela) y sus asignaciones; puede asignar.
 * - `director`: solo lectura de los grupos y asignaciones de su escuela.
 * - `student`: sin acceso (403 en las rutas).
 * Un grupo o asignación inexistente o ajeno responde 404 (no se revela qué ids existen).
 */
import { HttpError } from '../../shared/errors/HttpError.js';
import { initialTargetState } from '../diagnostics/diagnostics.domain.js';
import { createGroupAccess } from '../groups/groups.access.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import {
  assertHasTargets,
  assertQuestionLimit,
  assertQuestionsForGrade,
  assertQuestionsPerSkill,
  assertRequestedSkillsHaveQuestions,
  assertStudentsInGroup,
  buildGroupSkillContext,
  orderQuestionsByIds,
  orderQuestionsBySkills,
  parseAssignmentInput,
  parseQuestionFilters,
  parseQuizInput,
  parseQuizListQuery,
  toAssignmentSummaryDto,
  toQuestionDto,
  toQuizDetailDto,
  toQuizSummaryDto,
  toTargetDto,
} from './assessments.domain.js';
import { renderQuizPdf } from './assessments.pdf.js';

const ASSIGNMENT_NOT_FOUND = () => new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'No encontramos esa prueba.');
const QUIZ_NOT_FOUND = () => new HttpError(404, 'QUIZ_NOT_FOUND', 'No encontramos ese cuestionario.');

/** Agrupa filas por una llave (`Map<key, rows[]>`). */
function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const k = row[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

/**
 * @param {{
 *   repository: ReturnType<import('./assessments.repository.js').createAssessmentsRepository>,
 *   groupsRepository: ReturnType<import('../groups/groups.repository.js').createGroupsRepository>,
 *   transaction: <T>(fn: () => T) => T,
 * }} deps
 */
export function createAssessmentsService({ repository, groupsRepository, transaction }) {
  // Regla de acceso a grupos: única fuente en `groups.access.js`.
  const { findReadableGroupById, findReadableGroup, findOwnGroup } = createGroupAccess(groupsRepository);

  const withOptions = (questionRows, optionRows) => {
    const options = groupBy(optionRows, 'question_id');
    return questionRows.map((row) => toQuestionDto(row, options.get(row.id) ?? []));
  };

  const buildDetail = (assignment) => {
    const summary = toAssignmentSummaryDto(
      assignment,
      repository.listSkillCountsOfAssignment(assignment.id),
      repository.listTargetCountsOfAssignment(assignment.id),
    );
    const questionRows = repository.listQuestionsOfAssignment(assignment.id);
    const questions = withOptions(questionRows, repository.listOptionsOfAssignment(assignment.id)).map((q, idx) => ({
      position: questionRows[idx].position,
      ...q,
    }));
    const targets = repository.listTargetsOfAssignment(assignment.id).map(toTargetDto);
    return { ...summary, questions, targets };
  };

  /** Reactivos elegidos y ya ordenados, validados contra el grado del grupo. */
  const resolveQuestions = (input, group) => {
    if (input.questionIds) {
      const found = repository.findQuestionsByIds(input.questionIds);
      assertQuestionsForGrade(input.questionIds, found, group.grade);
      return orderQuestionsByIds(found, input.questionIds);
    }
    const found = repository.listQuestionsOfGradeBySkills(group.grade, input.skills);
    assertRequestedSkillsHaveQuestions(input.skills, found);
    return orderQuestionsBySkills(found, input.skills);
  };

  const resolveTargets = (input, group) => {
    if (!input.studentIds) return repository.listActiveStudentIds(group.id);
    const active = repository.findActiveStudentIdsInGroup(group.id, input.studentIds);
    assertStudentsInGroup(input.studentIds, active);
    return input.studentIds;
  };

  return {
    listQuestions(query) {
      const filters = parseQuestionFilters(query);
      return withOptions(repository.listBankQuestions(filters), repository.listBankOptions(filters));
    },

    listAssignments(auth, groupId) {
      const group = findReadableGroup(auth, groupId);
      const skills = groupBy(repository.listSkillCountsOfGroup(group.id), 'assignment_id');
      const targets = groupBy(repository.listTargetCountsOfGroup(group.id), 'assignment_id');
      return repository
        .listAssignmentsOfGroup(group.id)
        .map((a) => toAssignmentSummaryDto(a, skills.get(a.id) ?? [], targets.get(a.id) ?? []));
    },

    getAssignment(auth, assignmentId) {
      const id = parsePositiveId(assignmentId, 'id de la prueba');
      const assignment = repository.findAssignmentById(id);
      if (!assignment || !findReadableGroupById(auth, assignment.group_id)) throw ASSIGNMENT_NOT_FOUND();
      return buildDetail(assignment);
    },

    /**
     * Crea la asignación con sus reactivos (`position` 1..n) y destinatarios en una sola transacción.
     * En papel cada destinatario queda `pending` con `is_screen_locked = 1` (AGENTS.md §4.9).
     */
    createAssignment(auth, groupId, body) {
      const group = findOwnGroup(auth, groupId);
      const input = parseAssignmentInput(body);

      return transaction(() => {
        const questions = resolveQuestions(input, group);
        assertQuestionLimit(questions.length);
        assertQuestionsPerSkill(questions);
        const studentIds = resolveTargets(input, group);
        assertHasTargets(studentIds.length);

        const id = repository.insertAssignment({
          groupId: group.id,
          createdBy: Number(auth.sub),
          title: input.title,
          modality: input.modality,
        });
        repository.insertAssignmentQuestions(id, questions.map((q) => q.id));
        repository.insertTargets(id, studentIds, initialTargetState(input.modality));
        return buildDetail(repository.findAssignmentById(id));
      });
    },

    listQuizzes(auth, query = {}) {
      const { groupId, origin } = parseQuizListQuery(query);
      let groupContext = null;
      if (groupId != null) {
        const group = findReadableGroup(auth, groupId);
        groupContext = buildGroupSkillContext(
          group,
          repository.listAllSkills(),
          repository.listGroupLatestMastery(group.id, group.school_id),
        );
      }

      const rawSummaries = repository
        .listVisibleQuizzes(auth.schoolId)
        .map((row) => toQuizSummaryDto(row, auth.sub, groupContext))
        .sort(
          (a, b) =>
            Number(b.isRecommended) - Number(a.isRecommended) ||
            b.recommendationScore - a.recommendationScore ||
            b.id - a.id,
        );

      // Si el grupo domina todas las habilidades (ninguna alcanza el umbral >= 74),
      // destacamos dinámicamente las 2 opciones con mayor afinidad para su grado y desempeño.
      const hasExplicitMatch = rawSummaries.some((q) => q.isRecommended);
      const allSummaries =
        groupContext && !hasExplicitMatch
          ? rawSummaries.map((q, idx) =>
              idx < 2 && q.recommendationScore >= 40 ? { ...q, isRecommended: true } : q,
            )
          : rawSummaries;

      const counts = {
        all: allSummaries.length,
        recommended: allSummaries.filter((q) => q.isRecommended).length,
        own: allSummaries.filter((q) => q.origin === 'own').length,
        other_teachers: allSummaries.filter((q) => q.origin === 'other_teacher').length,
        preloaded: allSummaries.filter((q) => q.origin === 'preloaded').length,
      };

      const quizzes = allSummaries.filter((q) => {
        if (origin === 'all') return true;
        if (origin === 'recommended') return q.isRecommended;
        if (origin === 'own') return q.origin === 'own';
        if (origin === 'other_teachers') return q.origin === 'other_teacher';
        if (origin === 'preloaded') return q.origin === 'preloaded';
        return true;
      });

      return { quizzes, counts, groupContext };
    },

    getQuiz(auth, quizId, query = {}) {
      const id = parsePositiveId(quizId, 'id del cuestionario');
      const { groupId } = parseQuizListQuery(query);
      const quiz = repository.findQuizById(id);
      if (!quiz || (quiz.origin_type !== 'system' && Number(quiz.school_id) !== Number(auth.schoolId))) {
        throw QUIZ_NOT_FOUND();
      }

      let groupContext = null;
      if (groupId != null) {
        const group = findReadableGroup(auth, groupId);
        groupContext = buildGroupSkillContext(
          group,
          repository.listAllSkills(),
          repository.listGroupLatestMastery(group.id, group.school_id),
        );
      }

      return toQuizDetailDto(quiz, repository.listQuizQuestions(id), auth.sub, groupContext);
    },

    createQuiz(auth, body) {
      const input = parseQuizInput(body);
      const skillId = repository.findSkillIdByCode(input.skillCode);
      if (!skillId) throw new HttpError(400, 'SKILL_NOT_FOUND', 'No encontramos esa habilidad.');

      return transaction(() => {
        const quizId = repository.insertQuiz({
          schoolId: auth.schoolId,
          createdBy: Number(auth.sub),
          title: input.title,
          description: input.description,
          skillId,
          grade: input.grade,
        });
        repository.replaceQuizQuestions(quizId, input.questions);
        return toQuizDetailDto(repository.findQuizById(quizId), repository.listQuizQuestions(quizId), auth.sub);
      });
    },

    updateQuiz(auth, quizId, body) {
      const id = parsePositiveId(quizId, 'id del cuestionario');
      const existing = repository.findQuizById(id);
      if (!existing || (existing.origin_type !== 'system' && Number(existing.school_id) !== Number(auth.schoolId))) {
        throw QUIZ_NOT_FOUND();
      }
      if (existing.origin_type !== 'teacher' || Number(existing.created_by) !== Number(auth.sub)) {
        throw new HttpError(403, 'QUIZ_NOT_OWNED', 'Solo puedes editar cuestionarios creados por ti.');
      }

      const input = parseQuizInput(body);
      const skillId = repository.findSkillIdByCode(input.skillCode);
      if (!skillId) throw new HttpError(400, 'SKILL_NOT_FOUND', 'No encontramos esa habilidad.');

      return transaction(() => {
        repository.updateQuiz({
          id,
          title: input.title,
          description: input.description,
          skillId,
          grade: input.grade,
        });
        repository.replaceQuizQuestions(id, input.questions);
        return toQuizDetailDto(repository.findQuizById(id), repository.listQuizQuestions(id), auth.sub);
      });
    },

    async exportQuizPdf(auth, quizId, query = {}) {
      const id = parsePositiveId(quizId, 'id del cuestionario');
      const { groupId } = parseQuizListQuery(query);
      const quiz = repository.findQuizById(id);
      if (!quiz || (quiz.origin_type !== 'system' && Number(quiz.school_id) !== Number(auth.schoolId))) {
        throw QUIZ_NOT_FOUND();
      }

      let groupLabel = null;
      if (groupId != null) {
        const group = findReadableGroup(auth, groupId);
        groupLabel = `${group.grade}.º ${group.section}`;
      }

      const detail = toQuizDetailDto(quiz, repository.listQuizQuestions(id), auth.sub);
      const buffer = await renderQuizPdf(detail, { groupLabel });
      return {
        buffer,
        filename: `cuestionario-${detail.id}.pdf`,
        contentType: 'application/pdf',
      };
    },
  };
}
