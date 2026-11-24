import { Router } from 'express';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createInterventionsRepository } from './interventions.repository.js';
import { createInterventionsService } from './interventions.service.js';
import { createInterventionsController } from './interventions.controller.js';

export function createInterventionsRouter({ db, requireAuth }) {
  const controller = createInterventionsController(createInterventionsService({
    repository: createInterventionsRepository(db), groupsRepository: createGroupsRepository(db),
  }));
  const router = Router();
  router.get('/groups/:groupId', requireAuth(ROLES.TEACHER, ROLES.DIRECTOR), controller.list);
  router.post('/groups/:groupId', requireAuth(ROLES.TEACHER), controller.create);
  return router;
}
