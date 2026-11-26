/**
 * Módulo paper-mode — Capa 2 (Aplicación): casos de uso del Modo Papel.
 *
 * Autorización (idéntica a `assessments`): docente solo sus grupos, director solo lectura de su
 * escuela. Asignación inexistente o ajena → 404 (no se revela qué ids existen).
 */
import { HttpError } from '../../shared/errors/HttpError.js';
import { toTargetDto } from '../assessments/assessments.domain.js';
import { createGroupAccess } from '../groups/groups.access.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import { summarizeCaptureStatus } from './paper-mode.domain.js';

const ASSIGNMENT_NOT_FOUND = () => new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'No encontramos esa prueba.');
const NOT_PAPER_ASSIGNMENT = () =>
  new HttpError(409, 'NOT_PAPER_ASSIGNMENT', 'Esta prueba se contesta en pantalla, no en papel.');

/**
 * @param {{
 *   assessmentsRepository: ReturnType<import('../assessments/assessments.repository.js').createAssessmentsRepository>,
 *   groupsRepository: ReturnType<import('../groups/groups.repository.js').createGroupsRepository>,
 * }} deps
 */
export function createPaperModeService({ assessmentsRepository, groupsRepository }) {
  const { findReadableGroupById } = createGroupAccess(groupsRepository);

  /** Asignación en papel legible por el usuario: 400 id inválido, 404 inexistente o ajena, 409 si es de pantalla. */
  const findReadablePaperAssignment = (auth, assignmentId) => {
    const id = parsePositiveId(assignmentId, 'id de la prueba');
    const assignment = assessmentsRepository.findAssignmentById(id);
    if (!assignment || !findReadableGroupById(auth, assignment.group_id)) throw ASSIGNMENT_NOT_FOUND();
    if (assignment.modality !== 'paper') throw NOT_PAPER_ASSIGNMENT();
    return assignment;
  };

  return {
    /** Avance de captura: conteos + destinatarios en orden de lista (sin nombres ni folio). */
    getCaptureStatus(auth, assignmentId) {
      const assignment = findReadablePaperAssignment(auth, assignmentId);
      const rows = assessmentsRepository.listTargetsOfAssignment(assignment.id);
      return {
        assignmentId: assignment.id,
        ...summarizeCaptureStatus(rows),
        targets: rows.map(toTargetDto),
      };
    },
  };
}
