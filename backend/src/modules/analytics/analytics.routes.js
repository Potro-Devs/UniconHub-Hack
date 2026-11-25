import { Router } from 'express';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createCurriculumRepository } from '../curriculum/curriculum.repository.js';
import { createAnalyticsRepository } from './analytics.repository.js';
import { createAnalyticsService } from './analytics.service.js';
import { createAnalyticsController } from './analytics.controller.js';

export function createAnalyticsRouter({ db, requireAuth, now }) {
  const controller = createAnalyticsController(createAnalyticsService({
    repository: createAnalyticsRepository(db), groupsRepository: createGroupsRepository(db),
    curriculumRepository: createCurriculumRepository(db), now,
  }));
  const router = Router();
  const staff = requireAuth(ROLES.TEACHER, ROLES.DIRECTOR);
  // Panel de la escuela: solo Dirección (agregados, sin datos personales de alumnos).
  router.get('/school', requireAuth(ROLES.DIRECTOR), controller.getSchool);
  router.get('/school/export.pdf', requireAuth(ROLES.DIRECTOR), controller.exportSchool);
  router.get('/groups/:groupId', staff, controller.getGroup);
  router.get('/groups/:groupId/export.xlsx', staff, controller.exportGroup('xlsx'));
  router.get('/groups/:groupId/export.pdf', staff, controller.exportGroup('pdf'));
  router.get('/groups/:groupId/students/:studentId', staff, controller.getStudent);
  return router;
}
