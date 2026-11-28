import { Router } from 'express';
import { ROLES } from '../auth/auth.domain.js';
import { createGroupsRepository } from '../groups/groups.repository.js';
import { createGamesService } from './games.service.js';
import { createGamesController } from './games.controller.js';
import { createGamesRepository } from './games.repository.js';
import { demoSponsorLogoUrl } from './games.demo-sponsors.js';

export function createGamesRouter({ db, requireAuth, demoSponsors }) {
  const controller = createGamesController(createGamesService({
    groupsRepository: createGroupsRepository(db), repository: createGamesRepository(db),
    demoSponsors, logoUrlFor: demoSponsorLogoUrl,
  }));
  const router = Router();
  router.use(requireAuth(ROLES.STUDENT));
  router.get('/', controller.getCatalog);
  router.get('/:gameCode', controller.getGame);
  router.post('/:gameCode/check', controller.check);
  return router;
}
