/**
 * Módulo paper-mode — Capa 1 (Presentación): rutas `/api/v1/paper`.
 * Lectura y PDF: docente y director. Captura: solo docente. Alumno: 403 en todo.
 * Contrato: docs/api-contract.md § "Paper Mode".
 */
import { Router } from 'express';
import { withTransaction } from '../../config/database.js';
import { createAssessmentsRepository } from '../assessments/assessments.repository.js';
import { ROLES } from '../auth/auth.domain.js';
import { createDiagnosticsRepository } from '../diagnostics/diagnostics.repository.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createPaperModeController } from './paper-mode.controller.js';
import { createPaperModeRepository } from './paper-mode.repository.js';
import { createPaperModeService } from './paper-mode.service.js';

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, requireAuth: Function }} deps
 */
export function createPaperModeRouter({ db, requireAuth }) {
  const service = createPaperModeService({
    repository: createPaperModeRepository(db),
    assessmentsRepository: createAssessmentsRepository(db),
    diagnosticsRepository: createDiagnosticsRepository(db),
    groupsRepository: createGroupsRepository(db),
    transaction: (fn) => withTransaction(db, fn),
  });
  const controller = createPaperModeController(service);

  const staff = requireAuth(ROLES.TEACHER, ROLES.DIRECTOR);
  const teacher = requireAuth(ROLES.TEACHER);

  const router = Router();
  router.get('/assignments/:assignmentId/pdf', staff, controller.exportSheetPdf);
  router.get('/assignments/:assignmentId/hints-pdf', staff, controller.exportHintsPdf);
  router.get('/assignments/:assignmentId/capture-status', staff, controller.getCaptureStatus);
  router.post('/assignments/:assignmentId/capture/:studentId', teacher, controller.captureStudent);
  return router;
}
