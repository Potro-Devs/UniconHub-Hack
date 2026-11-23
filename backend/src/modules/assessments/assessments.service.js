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
  orderQuestionsByIds,
  orderQuestionsBySkills,
  parseAssignmentInput,
  parseQuestionFilters,
  toAssignmentSummaryDto,
  toQuestionDto,
  toTargetDto,
} from './assessments.domain.js';

const ASSIGNMENT_NOT_FOUND = () => new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'No encontramos esa prueba.');

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
  };
}
