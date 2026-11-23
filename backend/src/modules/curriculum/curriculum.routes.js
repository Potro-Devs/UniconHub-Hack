/**
 * Módulo curriculum — Capa 1 (Presentación): rutas `/api/v1/curriculum`.
 * Lectura: docente y director. Escritura: solo docente. Alumno: 403.
 */
import { Router } from 'express';
import { withTransaction } from '../../config/database.js';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createCurriculumController } from './curriculum.controller.js';
import { createCurriculumRepository } from './curriculum.repository.js';
import { createCurriculumService } from './curriculum.service.js';

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, requireAuth: Function }} deps
 */
export function createCurriculumRouter({ db, requireAuth }) {
  const service = createCurriculumService({
    repository: createCurriculumRepository(db),
    groupsRepository: createGroupsRepository(db),
    transaction: (fn) => withTransaction(db, fn),
  });
  const controller = createCurriculumController(service);

  const staff = requireAuth(ROLES.TEACHER, ROLES.DIRECTOR);
  const teacher = requireAuth(ROLES.TEACHER);

  const router = Router();
  router.get('/groups/:groupId', staff, controller.getGroupCurriculum);
  router.get('/groups/:groupId/coverage', staff, controller.getCoverage);
  router.patch('/groups/:groupId/contents/:contentId', teacher, controller.updateContent);
  return router;
}
