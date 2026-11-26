/**
 * Módulo paper-mode — Capa 1 (Presentación): rutas `/api/v1/paper`.
 * Lectura y PDF: docente y director. Captura: solo docente. Alumno: 403 en todo.
 * Contrato: docs/api-contract.md § "Paper Mode".
 */
import { Router } from 'express';
import { ROLES } from '../auth/auth.domain.js';
import { createPaperModeController } from './paper-mode.controller.js';

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, requireAuth: Function }} deps
 */
export function createPaperModeRouter({ requireAuth }) {
  // TODO(paper-mode): crear service/repository con `db` y pasarlos al controller.
  const controller = createPaperModeController();

  const staff = requireAuth(ROLES.TEACHER, ROLES.DIRECTOR);
  const teacher = requireAuth(ROLES.TEACHER);

  const router = Router();
  router.get('/assignments/:assignmentId/pdf', staff, controller.exportSheetPdf);
  router.get('/assignments/:assignmentId/hints-pdf', staff, controller.exportHintsPdf);
  router.get('/assignments/:assignmentId/capture-status', staff, controller.getCaptureStatus);
  router.post('/assignments/:assignmentId/capture/:studentId', teacher, controller.captureStudent);
  return router;
}
