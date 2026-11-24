import { Router } from 'express';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createGamesService } from './games.service.js';
import { createGamesController } from './games.controller.js';
import { createGamesRepository } from './games.repository.js';

export function createGamesRouter({ db, requireAuth }) {
  const controller = createGamesController(createGamesService({
    groupsRepository: createGroupsRepository(db), repository: createGamesRepository(db),
  }));
  const router = Router();
  router.use(requireAuth(ROLES.STUDENT));
  router.get('/', controller.getCatalog);
  router.get('/:gameCode', controller.getGame);
  router.post('/:gameCode/check', controller.check);
  return router;
}
