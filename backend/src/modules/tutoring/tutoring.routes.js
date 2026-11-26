import { Router } from 'express';
import { withTransaction } from '../../config/database.js';
import { ROLES } from '../auth/auth.domain.js';
import { createAnalyticsRepository } from '../analytics/analytics.repository.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createTutoringRepository } from './tutoring.repository.js';
import { createTutoringService } from './tutoring.service.js';
import { createTutoringController } from './tutoring.controller.js';

export function createTutoringRouter({ db, requireAuth }) {
  const controller = createTutoringController(createTutoringService({
    repository: createTutoringRepository(db), groupsRepository: createGroupsRepository(db),
    analyticsRepository: createAnalyticsRepository(db), transaction: (fn) => withTransaction(db, fn),
  }));
  const router = Router();
  const staff = requireAuth(ROLES.TEACHER, ROLES.DIRECTOR);
  const teacher = requireAuth(ROLES.TEACHER);
  router.get('/groups/:groupId/proposal', staff, controller.proposal);
  router.get('/groups/:groupId/sessions', staff, controller.listSessions);
  router.post('/groups/:groupId/sessions', teacher, controller.createSession);
  router.get('/groups/:groupId/sessions/:sessionId/cards.pdf', staff, controller.pdf('cards'));
  router.get('/groups/:groupId/sessions/:sessionId/key.pdf', staff, controller.pdf('key'));
  router.patch('/groups/:groupId/pairs/:pairId/demonstration', teacher, controller.recordDemonstration);
  return router;
}
