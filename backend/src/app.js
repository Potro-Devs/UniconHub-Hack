import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { createAssessmentsRouter } from './modules/assessments/assessments.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createCurriculumRouter } from './modules/curriculum/curriculum.routes.js';
import { createDiagnosticsRouter } from './modules/diagnostics/diagnostics.routes.js';
import { createGroupsRouter } from './modules/groups/groups.routes.js';
import { createAnalyticsRouter } from './modules/analytics/analytics.routes.js';
import { createGamesRouter } from './modules/games/games.routes.js';
import { createInterventionsRouter } from './modules/interventions/interventions.routes.js';
import { createTutoringRouter } from './modules/tutoring/tutoring.routes.js';
import { installFrontend } from './shared/middleware/serveFrontend.js';
import { createRequireAuth } from './shared/middleware/authenticate.js';
import { createErrorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';

/**
 * Crea la aplicación Express. Recibe la conexión y la configuración para poder probarla
 * con una base en memoria.
 *
 * @param {{ db: import('node:sqlite').DatabaseSync, config?: object, logger?: Console }} deps
 */
export function createApp({ db, config = env, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  const requireAuth = createRequireAuth({ secret: config.jwtSecret });

  /**
   * Endpoint base de verificación de salud del servicio.
   */
  app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({
      data: { status: 'ok', service: 'axi-backend' },
      meta: { version: 'v1' },
    });
  });

  app.use('/api/v1/auth', createAuthRouter({ db, config, requireAuth }));
  app.use('/api/v1/groups', createGroupsRouter({ db, requireAuth }));
  app.use('/api/v1/curriculum', createCurriculumRouter({ db, requireAuth }));
  app.use('/api/v1/assessments', createAssessmentsRouter({ db, requireAuth }));
  app.use('/api/v1/diagnostics', createDiagnosticsRouter({ db, requireAuth }));
  app.use('/api/v1/analytics', createAnalyticsRouter({ db, requireAuth }));
  app.use('/api/v1/games', createGamesRouter({ db, requireAuth }));
  app.use('/api/v1/interventions', createInterventionsRouter({ db, requireAuth }));
  app.use('/api/v1/tutoring', createTutoringRouter({ db, requireAuth }));

  app.use('/api', notFoundHandler);
  installFrontend(app);
  app.use(createErrorHandler({ logger }));
  return app;
}
