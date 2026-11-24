/**
 * Módulo diagnostics — Capa 2 (Aplicación): flujo de evaluación del alumno en pantalla.
 *
 * Autorización: solo alumnos activos (`role === 'student'`) sobre su propio `studentId`,
 * su grupo del token y pruebas asignadas a ellos. Bloquea pruebas en papel (`409 SCREEN_LOCKED`)
 * y reintentos sobre pruebas ya completadas (`409 ALREADY_COMPLETED`).
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { HttpError } from '../../shared/errors/HttpError.js';
import { buildNextMasteryCut, getMasteryLevel } from '../analytics/analytics.domain.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import {
  OUTCOME_STATUSES,
  assertCanAnswerOnScreen,
  classifyResponse,
  evaluateAchievements,
  feedbackForOutcome,
  parseAnswerInput,
  scoreSession,
  toStartQuestionDto,
  toStudentAssignmentDto,
} from './diagnostics.domain.js';

const STUDENT_NOT_FOUND = () => new HttpError(404, 'STUDENT_NOT_FOUND', 'No encontramos a ese alumno.');
const ASSIGNMENT_NOT_FOUND = () => new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'No encontramos esa prueba.');

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

      return {
        assignment: {
          id: target.assignment_id,
          title: target.title,
          modality: target.modality,
          status: current.status,
          startedAt: current.started_at,
          questionCount: questionRows.length,
          answeredCount: responses.length,
        },
        questions: questionRows.map((q) =>
          toStartQuestionDto(q, options.get(q.id) ?? [], responseByQuestion.get(q.id) ?? null),
        ),
      };
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

      const classified = classifyResponse({
        selectedOption: option,
        maxHintLevelUsed: input.maxHintLevelUsed,
      });

      return transaction(() => {
        if (target.status === 'pending') {
          repository.markTargetInProgress(target.target_id);
        }
        repository.insertResponse({
          targetId: target.target_id,
          questionId: input.questionId,
          selectedOptionId: input.selectedOptionId,
          outcomeStatus: classified.outcome_status,
          maxHintLevelUsed: classified.max_hint_level_used,
          errorTag: classified.error_tag,
        });
        const questionCount = repository.listQuestionsOfAssignment(target.assignment_id).length;
        const answeredCount = repository.listResponsesOfTarget(target.target_id).length;

        return {
          questionId: input.questionId,
          selectedOptionId: input.selectedOptionId,
          outcomeStatus: classified.outcome_status,
          maxHintLevelUsed: classified.max_hint_level_used,
          isCorrect: option.is_correct === 1,
          feedback: feedbackForOutcome(classified.outcome_status),
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
        const responseByQuestion = new Map(allResponses.map((r) => [r.question_id, r]));

        const skillGroups = new Map();
        for (const q of questionRows) {
          if (!skillGroups.has(q.skill_id)) {
            skillGroups.set(q.skill_id, {
              skillId: q.skill_id,
              code: q.skill_code,
              name: q.skill_name,
              responses: [],
            });
          }
          skillGroups.get(q.skill_id).responses.push(responseByQuestion.get(q.id));
        }

        const skills = [];
        const celebrations = [];
        for (const sg of skillGroups.values()) {
          const session = scoreSession(sg.responses);
          const previousCuts = repository.listMasteryCuts(studentId, sg.skillId);
          const previousPercentage = previousCuts.length
            ? previousCuts[previousCuts.length - 1].mastery_percentage
            : null;
          const cut = buildNextMasteryCut(previousCuts, session);

          repository.insertMasteryCut({
            studentId,
            skillId: sg.skillId,
            assignmentId: target.assignment_id,
            grade: target.grade,
            cut,
          });

          const { celebrations: awarded, message } = evaluateAchievements({
            blockCompleted: true,
            previousPercentage,
            currentPercentage: cut.mastery_percentage,
          });
          for (const c of awarded) {
            repository.insertAchievement({
              studentId,
              code: c.code,
              size: c.size,
              skillId: sg.skillId,
              assignmentId: target.assignment_id,
            });
            celebrations.push({
              code: c.code,
              size: c.size,
              skillCode: sg.code,
              skillName: sg.name,
            });
          }

          const level = getMasteryLevel(cut.mastery_percentage);
          skills.push({
            code: sg.code,
            name: sg.name,
            total: session.total,
            correctAutonomous: session.correctAutonomous,
            achievedWithSupport: session.achievedWithSupport,
            incorrect: session.incorrect,
            unanswered: session.unanswered,
            autonomousPercentage: session.autonomousPercentage,
            supportedPercentage: session.supportedPercentage,
            masteryPercentage: cut.mastery_percentage,
            masteryLevel: level.code,
            masteryLabel: level.label,
            message,
          });
        }

        repository.markTargetCompletedScreen(target.target_id);
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
