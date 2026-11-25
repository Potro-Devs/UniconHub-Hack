/**
 * Módulo assessments — Capa 1 (Presentación): rutas `/api/v1/assessments`.
 * Lectura: docente y director. Asignar: solo docente. Alumno: 403 en todo
 * (el portal del alumno usa `diagnostics`, que nunca expone la respuesta correcta).
 */
import { Router } from 'express';
import { withTransaction } from '../../config/database.js';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createAssessmentsController } from './assessments.controller.js';
import { createAssessmentsRepository } from './assessments.repository.js';
import { createAssessmentsService } from './assessments.service.js';

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, requireAuth: Function }} deps
 */
export function createAssessmentsRouter({ db, requireAuth }) {
  const service = createAssessmentsService({
    repository: createAssessmentsRepository(db),
    groupsRepository: createGroupsRepository(db),
    transaction: (fn) => withTransaction(db, fn),
  });
  const controller = createAssessmentsController(service);

  const staff = requireAuth(ROLES.TEACHER, ROLES.DIRECTOR);
  const teacher = requireAuth(ROLES.TEACHER);

  const router = Router();
  router.get('/questions', staff, controller.listQuestions);
  router.get('/quizzes', staff, controller.listQuizzes);
  router.post('/quizzes', teacher, controller.createQuiz);
  router.get('/quizzes/:quizId', staff, controller.getQuiz);
  router.patch('/quizzes/:quizId', teacher, controller.updateQuiz);
  router.get('/quizzes/:quizId/pdf', staff, controller.exportQuizPdf);
  router.get('/groups/:groupId/assignments', staff, controller.listAssignments);
  router.post('/groups/:groupId/assignments', teacher, controller.createAssignment);
  router.get('/assignments/:assignmentId', staff, controller.getAssignment);
  return router;
}
