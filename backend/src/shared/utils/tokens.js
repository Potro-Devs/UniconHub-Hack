import jwt from 'jsonwebtoken';
import { HttpError } from '../errors/HttpError.js';

const ALGORITHM = 'HS256';
const ISSUER = 'axi-api';

/**
 * Firma un JWT. El payload solo lleva identificadores y rol: nunca nombres ni `internal_folio`.
 *
 * @returns {{ token: string, expiresAt: string }}
 */
export function signToken(claims, { secret, expiresIn }) {
  const token = jwt.sign(claims, secret, { algorithm: ALGORITHM, expiresIn, issuer: ISSUER });
  const { exp } = jwt.decode(token);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

/**
 * Verifica un JWT y devuelve sus claims. Lanza `HttpError` 401 si es inválido o expiró.
 */
export function verifyToken(token, { secret }) {
  try {
    return jwt.verify(token, secret, { algorithms: [ALGORITHM], issuer: ISSUER });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new HttpError(401, 'TOKEN_EXPIRED', 'La sesión expiró. Vuelve a entrar.');
    }
    throw new HttpError(401, 'INVALID_TOKEN', 'La sesión no es válida. Vuelve a entrar.');
  }
}
