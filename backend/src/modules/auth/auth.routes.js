/**
 * Módulo auth — Capa 1 (Presentación): rutas `/api/v1/auth`.
 */
import { Router } from 'express';
import { createRateLimit } from '../../shared/middleware/rateLimit.js';
import { createAuthController } from './auth.controller.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, config: object, requireAuth: Function }} deps
 */
export function createAuthRouter({ db, config, requireAuth }) {
  const controller = createAuthController(createAuthService({ repository: createAuthRepository(db), config }));
  const { windowMs, max } = config.auth.rateLimit;
  const loginLimit = createRateLimit({ windowMs, max });
  // Acceso del alumno: límite amplio por IP (el salón comparte IP) y, para la imagen secreta,
  // un límite por alumno que frena que alguien adivine la de un compañero.
  const joinLimit = createRateLimit(config.auth.studentJoinRateLimit);
  const secretLimit = createRateLimit({
    ...config.auth.secretAttemptsPerStudent,
    key: (req) => `secret:${Number(req.body?.studentId) || 'x'}`,
    code: 'SECRET_TOO_MANY_ATTEMPTS',
    failuresOnly: true,
    message: 'Pídele ayuda a tu maestra o maestro para entrar.',
  });

  const router = Router();
  router.post('/login', loginLimit, controller.login);

  router.get('/quick-login', controller.quickLoginStatus);
  router.post('/quick-login/teacher', controller.quickLoginTeacher);
  router.post('/quick-login/director', controller.quickLoginDirector);
  router.post('/quick-login/student', controller.quickLoginStudent);

  router.post('/student-join', joinLimit, controller.joinGroup);
  router.post('/student-join/select', joinLimit, controller.selectStudent);
  router.post('/student-join/secret', joinLimit, secretLimit, controller.confirmSecret);

  router.get('/me', requireAuth(), controller.me);
  return router;
}
