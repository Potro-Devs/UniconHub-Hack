import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createCurriculumRouter } from './modules/curriculum/curriculum.routes.js';
import { createGroupsRouter } from './modules/groups/groups.routes.js';
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

  app.use('/api', notFoundHandler);
  app.use(createErrorHandler({ logger }));
  return app;
}
