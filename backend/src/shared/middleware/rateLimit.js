import { HttpError } from '../errors/HttpError.js';

/**
 * Limitador simple en memoria por ventana fija (suficiente para un solo proceso en el MVP).
 *
 * @param {{ windowMs: number, max: number, key?: (req) => string, now?: () => number }} options
 */
export function createRateLimit({ windowMs, max, key = (req) => req.ip, now = Date.now }) {
  const hits = new Map();

  return (req, _res, next) => {
    const id = key(req);
    const current = now();
    let entry = hits.get(id);
    if (!entry || current >= entry.resetAt) {
      entry = { count: 0, resetAt: current + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;

    // Limpieza ocasional para que el mapa no crezca sin límite.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (current >= v.resetAt) hits.delete(k);
    }

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - current) / 1000);
      return next(
        new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.', {
          retryAfterSeconds: retryAfter,
        }),
      );
    }
    return next();
  };
}
