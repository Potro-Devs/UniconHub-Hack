import { Router } from 'express';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createCurriculumRepository } from '../curriculum/curriculum.repository.js';
import { createAnalyticsRepository } from './analytics.repository.js';
import { createAnalyticsService } from './analytics.service.js';
import { createAnalyticsController } from './analytics.controller.js';

export function createAnalyticsRouter({ db, requireAuth }) {
  const controller = createAnalyticsController(createAnalyticsService({
    repository: createAnalyticsRepository(db), groupsRepository: createGroupsRepository(db),
    curriculumRepository: createCurriculumRepository(db),
  }));
  const router = Router();
  const staff = requireAuth(ROLES.TEACHER, ROLES.DIRECTOR);
  router.get('/groups/:groupId', staff, controller.getGroup);
  router.get('/groups/:groupId/students/:studentId', staff, controller.getStudent);
  return router;
}
