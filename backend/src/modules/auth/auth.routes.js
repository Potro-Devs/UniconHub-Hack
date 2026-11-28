/**
 * Módulo auth — Capa 1 (Presentación): rutas `/api/v1/auth`.
 */
import { Router } from 'express';
import { createRateLimit } from '../../shared/middleware/rateLimit.js';
import { createAuthController } from './auth.controller.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';

/**
 * Límite por alumno de intentos fallidos con la imagen secreta: frena que alguien adivine la de un
 * compañero. Se crea en `app.js` y se comparte con `groups`, que lo libera al restablecer la imagen.
 * `resetStudent(studentId)` olvida los intentos de ese alumno.
 */
export function createSecretAttemptsLimit(config) {
  const limit = createRateLimit({
    ...config.auth.secretAttemptsPerStudent,
    key: (req) => `secret:${Number(req.body?.studentId) || 'x'}`,
    code: 'SECRET_TOO_MANY_ATTEMPTS',
    failuresOnly: true,
    message: 'Pídele ayuda a tu maestra o maestro para entrar.',
  });
  limit.resetStudent = (studentId) => limit.reset(`secret:${Number(studentId)}`);
  return limit;
}

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, config: object, requireAuth: Function, secretLimit?: Function }} deps
 */
export function createAuthRouter({ db, config, requireAuth, secretLimit = createSecretAttemptsLimit(config) }) {
  const controller = createAuthController(createAuthService({ repository: createAuthRepository(db), config }));
  const { windowMs, max } = config.auth.rateLimit;
  const loginLimit = createRateLimit({ windowMs, max });
  // Acceso del alumno: límite amplio por IP (el salón comparte IP); la imagen secreta además
  // usa el límite por alumno (`secretLimit`).
  const joinLimit = createRateLimit(config.auth.studentJoinRateLimit);

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
