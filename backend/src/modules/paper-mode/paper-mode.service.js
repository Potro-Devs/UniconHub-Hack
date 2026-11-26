/**
 * Módulo paper-mode — Capa 2 (Aplicación): casos de uso del Modo Papel.
 *
 * Autorización (idéntica a `assessments`): docente solo sus grupos, director solo lectura de su
 * escuela. Asignación inexistente o ajena → 404 (no se revela qué ids existen).
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { HttpError } from '../../shared/errors/HttpError.js';
import { toTargetDto } from '../assessments/assessments.domain.js';
import { scoreSession } from '../diagnostics/diagnostics.domain.js';
import { closeSkillSessions } from '../diagnostics/diagnostics.mastery.js';
import { createGroupAccess } from '../groups/groups.access.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import { buildPaperCapture, parsePaperCaptureInput, summarizeCaptureStatus } from './paper-mode.domain.js';

const ASSIGNMENT_NOT_FOUND = () => new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'No encontramos esa prueba.');
const STUDENT_NOT_FOUND = () => new HttpError(404, 'STUDENT_NOT_FOUND', 'Ese alumno no tiene asignada esta prueba.');
const NOT_PAPER_ASSIGNMENT = () =>
  new HttpError(409, 'NOT_PAPER_ASSIGNMENT', 'Esta prueba se contesta en pantalla, no en papel.');
const ALREADY_CAPTURED = () => new HttpError(409, 'ALREADY_CAPTURED', 'La hoja de este alumno ya se capturó.');

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

/**
 * @param {{
 *   repository: ReturnType<import('./paper-mode.repository.js').createPaperModeRepository>,
 *   assessmentsRepository: ReturnType<import('../assessments/assessments.repository.js').createAssessmentsRepository>,
 *   diagnosticsRepository: ReturnType<import('../diagnostics/diagnostics.repository.js').createDiagnosticsRepository>,
 *   groupsRepository: ReturnType<import('../groups/groups.repository.js').createGroupsRepository>,
 *   transaction: <T>(fn: () => T) => T,
 * }} deps
 */
export function createPaperModeService({
  repository,
  assessmentsRepository,
  diagnosticsRepository,
  groupsRepository,
  transaction,
}) {
  const { findReadableGroupById } = createGroupAccess(groupsRepository);

  /**
   * Asignación en papel legible por el usuario y su grupo: 400 id inválido, 404 inexistente o ajena,
   * 409 si es de pantalla. Para el docente, "legible" ya es "suya" (`groups.access.js`).
   */
  const findReadablePaperAssignment = (auth, assignmentId) => {
    const id = parsePositiveId(assignmentId, 'id de la prueba');
    const assignment = assessmentsRepository.findAssignmentById(id);
    const group = assignment && findReadableGroupById(auth, assignment.group_id);
    if (!group) throw ASSIGNMENT_NOT_FOUND();
    if (assignment.modality !== 'paper') throw NOT_PAPER_ASSIGNMENT();
    return { assignment, group };
  };

  return {
    /** Avance de captura: conteos + destinatarios en orden de lista (sin nombres ni folio). */
    getCaptureStatus(auth, assignmentId) {
      const { assignment } = findReadablePaperAssignment(auth, assignmentId);
      const rows = assessmentsRepository.listTargetsOfAssignment(assignment.id);
      return {
        assignmentId: assignment.id,
        ...summarizeCaptureStatus(rows),
        targets: rows.map(toTargetDto),
      };
    },

    /**
     * Captura la hoja de un alumno en una sola transacción: respuestas (`source = 'paper'`),
     * destinatario `completed_paper` bloqueado y corte de dominio por habilidad (misma regla que
     * en pantalla). Sin logros: el alumno no está frente a la pantalla.
     */
    captureStudent(auth, assignmentId, studentId, body) {
      const { assignment, group } = findReadablePaperAssignment(auth, assignmentId);
      const sId = parsePositiveId(studentId, 'id del alumno');
      const target = repository.findTarget(assignment.id, sId);
      if (!target) throw STUDENT_NOT_FOUND();
      if (assignment.status !== 'active') throw new DomainError('ASSIGNMENT_CLOSED', 'Esta prueba ya no está disponible.');
      if (target.status === 'completed_paper') throw ALREADY_CAPTURED();

      const input = parsePaperCaptureInput(body);
      const questionRows = diagnosticsRepository.listQuestionsOfAssignment(assignment.id);
      const options = groupBy(repository.listOptionsOfAssignment(assignment.id), 'question_id');
      const questions = questionRows.map((q) => ({ id: q.id, options: options.get(q.id) ?? [] }));
      const { responses, targetState } = buildPaperCapture({ questions, ...input });

      if (input.absent) {
        return { assignmentId: assignment.id, studentId: sId, captured: false, status: target.status };
      }

      return transaction(() => {
        for (const r of responses) {
          diagnosticsRepository.insertResponse({
            targetId: target.id,
            questionId: r.question_id,
            selectedOptionId: r.selected_option_id,
            outcomeStatus: r.outcome_status,
            maxHintLevelUsed: r.max_hint_level_used,
            errorTag: r.error_tag,
            source: r.source,
          });
        }
        const { skills } = closeSkillSessions({
          repository: diagnosticsRepository,
          studentId: sId,
          assignmentId: assignment.id,
          grade: group.grade,
          questionRows,
          responses,
          recordAchievements: false,
        });

        const { changes } = repository.markTargetCaptured(target.id, targetState);
        if (changes === 0) throw ALREADY_CAPTURED();
        const updated = repository.findTarget(assignment.id, sId);
        const { sessionPercentage: _, ...summary } = scoreSession(responses);

        return {
          assignmentId: assignment.id,
          studentId: sId,
          captured: true,
          status: updated.status,
          completedAt: updated.completed_at,
          summary,
          skills,
        };
      });
    },
  };
}
