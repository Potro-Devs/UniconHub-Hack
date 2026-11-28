/**
 * Módulo groups — Capa 1 (Presentación): rutas `/api/v1/groups`.
 * Lectura: docente y director. Escritura: solo docente. Avatar: docente o el propio alumno.
 */
import { Router } from 'express';
import { withTransaction } from '../../config/database.js';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsController } from './groups.controller.js';
import { createGroupsRepository } from './groups.repository.js';
import { createGroupsService } from './groups.service.js';

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, requireAuth: Function, random?: () => number }} deps
 */
export function createGroupsRouter({ db, requireAuth, random }) {
  const service = createGroupsService({
    repository: createGroupsRepository(db),
    transaction: (fn) => withTransaction(db, fn),
    random,
  });
  const controller = createGroupsController(service);

  const staff = requireAuth(ROLES.TEACHER, ROLES.DIRECTOR);
  const teacher = requireAuth(ROLES.TEACHER);

  const router = Router();
  router.patch('/students/:studentId/avatar', requireAuth(ROLES.TEACHER, ROLES.STUDENT), controller.updateAvatar);

  router.get('/', staff, controller.list);
  router.post('/', teacher, controller.create);
  router.get('/:groupId', staff, controller.get);
  router.patch('/:groupId', teacher, controller.update);
  router.get('/:groupId/students', staff, controller.listStudents);
  router.post('/:groupId/students', teacher, controller.addStudent);
  router.post('/:groupId/students/bulk', teacher, controller.addStudentsBulk);
  router.post('/:groupId/students/import-preview', teacher, controller.previewStudentImport);
  router.patch('/:groupId/students/:studentId', teacher, controller.updateStudent);
  router.post('/:groupId/students/:studentId/withdraw', teacher, controller.withdrawStudent);
  router.delete('/:groupId/students/:studentId', teacher, controller.deleteStudent);
  return router;
}
