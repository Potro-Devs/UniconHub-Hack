/**
 * Módulo diagnostics — Capa 2 (Aplicación): flujo de evaluación del alumno en pantalla.
 *
 * Autorización: solo alumnos activos (`role === 'student'`) sobre su propio `studentId`,
 * su grupo del token y pruebas asignadas a ellos. Bloquea pruebas en papel (`409 SCREEN_LOCKED`)
 * y reintentos sobre pruebas ya completadas (`409 ALREADY_COMPLETED`).
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { HttpError } from '../../shared/errors/HttpError.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import {
  ANSWER_SAVED_FEEDBACK,
  CELEBRATION_SIZES,
  MAX_HINT_LEVEL,
  OUTCOME_STATUSES,
  assertCanAnswerOnScreen,
  classifyResponse,
  parseAnswerInput,
  parseHintRequestInput,
  scoreSession,
  toStartQuestionDto,
  toStudentAssignmentDto,
} from './diagnostics.domain.js';
import { closeSkillSessions } from './diagnostics.mastery.js';

const STUDENT_NOT_FOUND = () => new HttpError(404, 'STUDENT_NOT_FOUND', 'No encontramos a ese alumno.');
const ASSIGNMENT_NOT_FOUND = () => new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'No encontramos esa prueba.');
const QUESTION_NOT_FOUND = () => new HttpError(404, 'QUESTION_NOT_FOUND', 'No encontramos ese reactivo en la prueba.');

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
 *   repository: ReturnType<import('./diagnostics.repository.js').createDiagnosticsRepository>,
 *   groupsRepository: ReturnType<import('../groups/groups.repository.js').createGroupsRepository>,
 *   transaction: <T>(fn: () => T) => T,
 * }} deps
 */
export function createDiagnosticsService({ repository, groupsRepository, transaction }) {
  const requireActiveStudent = (auth) =>
    groupsRepository.findActiveStudentInGroup(Number(auth.sub), Number(auth.groupId));

  const requireAnswerableTarget = (auth, assignmentId) => {
    const id = parsePositiveId(assignmentId, 'id de la prueba');
    if (!requireActiveStudent(auth)) throw ASSIGNMENT_NOT_FOUND();
    const target = repository.findTargetAssignment(id, Number(auth.sub), Number(auth.groupId));
    if (!target) throw ASSIGNMENT_NOT_FOUND();

    assertCanAnswerOnScreen(
      { modality: target.modality },
      { status: target.status, is_screen_locked: target.is_screen_locked },
    );
    if (target.assignment_status !== 'active') {
      throw new DomainError('ASSIGNMENT_CLOSED', 'Esta prueba ya no está disponible.');
    }
    return target;
  };

  return {
    listStudentAssignments(auth, studentId) {
      const id = parsePositiveId(studentId, 'id del alumno');
      if (Number(auth.sub) !== id || !requireActiveStudent(auth)) throw STUDENT_NOT_FOUND();

      const groupId = Number(auth.groupId);
      const skills = groupBy(repository.listSkillCountsForStudentGroup(id, groupId), 'assignment_id');
      return repository
        .listAssignmentsForStudent(id, groupId)
        .map((row) => toStudentAssignmentDto(row, skills.get(row.id) ?? []));
    },

    startAssignment(auth, assignmentId) {
      const target = requireAnswerableTarget(auth, assignmentId);
      if (target.status === 'pending') {
        repository.markTargetInProgress(target.target_id);
      }
      const current = repository.findTargetById(target.target_id);
      const questionRows = repository.listQuestionsOfAssignment(target.assignment_id);
      const options = groupBy(repository.listPublicOptionsOfAssignment(target.assignment_id), 'question_id');
      const responses = repository.listResponsesOfTarget(target.target_id);
      const responseByQuestion = new Map(responses.map((r) => [r.question_id, r]));
      const hintLevels = new Map(
        repository.listHintRequestsOfTarget(target.target_id).map((h) => [h.question_id, h.max_hint_level]),
      );

      return {
        assignment: {
          id: target.assignment_id,
          title: target.title,
          modality: target.modality,
          status: current.status,
          startedAt: current.started_at,
          questionCount: questionRows.length,
          answeredCount: responses.filter((r) => r.outcome_status !== OUTCOME_STATUSES.UNANSWERED).length,
        },
        questions: questionRows.map((q) =>
          toStartQuestionDto(
            q,
            options.get(q.id) ?? [],
            responseByQuestion.get(q.id) ?? null,
            hintLevels.get(q.id) ?? 0,
          ),
        ),
      };
    },

    requestHint(auth, assignmentId, questionId, body) {
      const target = requireAnswerableTarget(auth, assignmentId);
      const qId = parsePositiveId(questionId, 'id del reactivo');
      const { level } = parseHintRequestInput(body);

      const question = repository.findQuestionHintsInAssignment(target.assignment_id, qId);
      if (!question) throw QUESTION_NOT_FOUND();
      if (repository.findResponse(target.target_id, qId)) {
        throw new HttpError(409, 'ALREADY_ANSWERED', 'Ya respondiste esta pregunta.');
      }

      return transaction(() => {
        const currentLevel = repository.findHintLevel(target.target_id, qId);
        if (level !== currentLevel + 1) {
          throw new DomainError('INVALID_HINT_SEQUENCE', 'Debes pedir las pistas en orden.', {
            currentLevel,
            expectedLevel: currentLevel + 1,
            requestedLevel: level,
          });
        }
        if (target.status === 'pending') {
          repository.markTargetInProgress(target.target_id);
        }
        repository.upsertHintLevel(target.target_id, qId, level);
        return {
          questionId: qId,
          level,
          hint: [question.hint_1, question.hint_2, question.hint_3][level - 1],
          remainingHints: MAX_HINT_LEVEL - level,
        };
      });
    },

    answerQuestion(auth, assignmentId, body) {
      const target = requireAnswerableTarget(auth, assignmentId);
      const input = parseAnswerInput(body);

      const question = repository.findQuestionInAssignment(target.assignment_id, input.questionId);
      if (!question) {
        throw new DomainError('VALIDATION_ERROR', 'Ese reactivo no pertenece a esta prueba.', {
          field: 'questionId',
        });
      }
      const option = repository.findOptionOfQuestion(input.questionId, input.selectedOptionId);
      if (!option) {
        throw new DomainError('VALIDATION_ERROR', 'Esa opción no pertenece al reactivo.', {
          field: 'selectedOptionId',
        });
      }
      if (repository.findResponse(target.target_id, input.questionId)) {
        throw new HttpError(409, 'ALREADY_ANSWERED', 'Ya respondiste esta pregunta.');
      }

      return transaction(() => {
        const maxHintLevelUsed = repository.findHintLevel(target.target_id, input.questionId);
        const classified = classifyResponse({ selectedOption: option, maxHintLevelUsed });

        if (target.status === 'pending') {
          repository.markTargetInProgress(target.target_id);
        }
        try {
          repository.insertResponse({
            targetId: target.target_id,
            questionId: input.questionId,
            selectedOptionId: input.selectedOptionId,
            outcomeStatus: classified.outcome_status,
            maxHintLevelUsed: classified.max_hint_level_used,
            errorTag: classified.error_tag,
          });
        } catch (err) {
          if (err?.code === 'ERR_SQLITE_ERROR' && /UNIQUE/i.test(err.message)) {
            throw new HttpError(409, 'ALREADY_ANSWERED', 'Ya respondiste esta pregunta.');
          }
          throw err;
        }

        const questionCount = repository.listQuestionsOfAssignment(target.assignment_id).length;
        const answeredCount = repository
          .listResponsesOfTarget(target.target_id)
          .filter((r) => r.outcome_status !== OUTCOME_STATUSES.UNANSWERED).length;

        return {
          questionId: input.questionId,
          selectedOptionId: input.selectedOptionId,
          maxHintLevelUsed: classified.max_hint_level_used,
          feedback: ANSWER_SAVED_FEEDBACK,
          answeredCount,
          questionCount,
        };
      });
    },

    completeAssignment(auth, assignmentId) {
      const target = requireAnswerableTarget(auth, assignmentId);
      const studentId = Number(auth.sub);

      return transaction(() => {
        const questionRows = repository.listQuestionsOfAssignment(target.assignment_id);
        const existing = repository.listResponsesOfTarget(target.target_id);
        if (existing.filter((r) => r.outcome_status !== OUTCOME_STATUSES.UNANSWERED).length === 0) {
          throw new DomainError('NOTHING_ANSWERED', 'Contesta al menos una pregunta antes de terminar la prueba.');
        }

        // Cómo contar reactivos sin contestar en el corte queda por validar con docente.
        const existingIds = new Set(existing.map((r) => r.question_id));
        for (const q of questionRows) {
          if (!existingIds.has(q.id)) {
            repository.insertResponse({
              targetId: target.target_id,
              questionId: q.id,
              selectedOptionId: null,
              outcomeStatus: OUTCOME_STATUSES.UNANSWERED,
              maxHintLevelUsed: 0,
              errorTag: null,
            });
          }
        }

        const allResponses = repository.listResponsesOfTarget(target.target_id);

        repository.insertAchievement({
          studentId,
          code: 'block_completed',
          size: CELEBRATION_SIZES.SMALL,
          skillId: null,
          assignmentId: target.assignment_id,
        });
        const closed = closeSkillSessions({
          repository,
          studentId,
          assignmentId: target.assignment_id,
          grade: target.grade,
          questionRows,
          responses: allResponses,
          recordAchievements: true,
        });
        const skills = closed.skills;
        const celebrations = [
          { code: 'block_completed', size: CELEBRATION_SIZES.SMALL, skillCode: null, skillName: null },
          ...closed.celebrations,
        ];

        const { changes } = repository.markTargetCompletedScreen(target.target_id);
        if (changes === 0) {
          throw new DomainError('ALREADY_COMPLETED', 'Esta prueba ya se terminó o se bloqueó en papel.');
        }
        const updated = repository.findTargetById(target.target_id);
        const { sessionPercentage: _, ...summary } = scoreSession(allResponses);

        return {
          assignmentId: target.assignment_id,
          status: updated.status,
          completedAt: updated.completed_at,
          summary,
          skills,
          celebrations,
        };
      });
    },
  };
}
