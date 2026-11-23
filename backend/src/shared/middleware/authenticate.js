import { HttpError } from '../errors/HttpError.js';
import { verifyToken } from '../utils/tokens.js';

/**
 * Crea el middleware `requireAuth(...roles)`. Lee `Authorization: Bearer <token>`,
 * deja los claims en `req.auth` y, si se indican roles, exige uno de ellos.
 *
 * @example router.get('/groups', requireAuth('teacher'), handler)
 */
export function createRequireAuth({ secret }) {
  return function requireAuth(...roles) {
    return (req, _res, next) => {
      const header = req.get('authorization') ?? '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) {
        return next(new HttpError(401, 'AUTH_REQUIRED', 'Necesitas iniciar sesión.'));
      }
      try {
        req.auth = verifyToken(token, { secret });
      } catch (error) {
        return next(error);
      }
      if (roles.length > 0 && !roles.includes(req.auth.role)) {
        return next(new HttpError(403, 'FORBIDDEN', 'No tienes permiso para esta acción.'));
      }
      return next();
    };
  };
}
