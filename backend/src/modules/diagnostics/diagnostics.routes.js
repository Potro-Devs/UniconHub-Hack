/**
 * Módulo diagnostics — Capa 1 (Presentación): rutas `/api/v1/diagnostics`.
 * Acceso exclusivo del alumno (`role === 'student'`); nunca expone respuestas correctas ni errores típicos.
 */
import { Router } from 'express';
import { withTransaction } from '../../config/database.js';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createDiagnosticsController } from './diagnostics.controller.js';
import { createDiagnosticsRepository } from './diagnostics.repository.js';
import { createDiagnosticsService } from './diagnostics.service.js';

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, requireAuth: Function }} deps
 */
export function createDiagnosticsRouter({ db, requireAuth }) {
  const service = createDiagnosticsService({
    repository: createDiagnosticsRepository(db),
    groupsRepository: createGroupsRepository(db),
    transaction: (fn) => withTransaction(db, fn),
  });
  const controller = createDiagnosticsController(service);
  const student = requireAuth(ROLES.STUDENT);

  const router = Router();
  router.get('/students/:studentId/assignments', student, controller.listStudentAssignments);
  router.get('/assignments/:assignmentId/start', student, controller.startAssignment);
  router.post('/assignments/:assignmentId/answer', student, controller.answerQuestion);
  router.post('/assignments/:assignmentId/complete', student, controller.completeAssignment);
  return router;
}
