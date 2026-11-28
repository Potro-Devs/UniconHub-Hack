import { HttpError } from '../errors/HttpError.js';

/**
 * Limitador simple en memoria por ventana fija (suficiente para un solo proceso en el MVP).
 *
 * Con `failuresOnly`, solo cuentan las respuestas con error (≥ 400): entrar bien no consume intentos.
 *
 * El middleware expone `reset(id)` para olvidar los intentos de una llave (p. ej. cuando la docente
 * restablece la imagen secreta de un alumno que se quedó sin intentos).
 *
 * @param {{ windowMs: number, max: number, key?: (req) => string, now?: () => number, failuresOnly?: boolean }} options
 */
export function createRateLimit({
  windowMs,
  max,
  key = (req) => req.ip,
  now = Date.now,
  code = 'TOO_MANY_ATTEMPTS',
  message = 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  failuresOnly = false,
}) {
  const hits = new Map();

  const middleware = (req, res, next) => {
    const id = key(req);
    const current = now();
    let entry = hits.get(id);
    if (!entry || current >= entry.resetAt) {
      entry = { count: 0, resetAt: current + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;
    if (failuresOnly) {
      const counted = entry;
      res.once('finish', () => { if (res.statusCode < 400 && counted.count > 0) counted.count -= 1; });
    }

    // Limpieza ocasional para que el mapa no crezca sin límite.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (current >= v.resetAt) hits.delete(k);
    }

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - current) / 1000);
      return next(
        new HttpError(429, code, message, {
          retryAfterSeconds: retryAfter,
        }),
      );
    }
    return next();
  };
  middleware.reset = (id) => hits.delete(id);
  return middleware;
}
