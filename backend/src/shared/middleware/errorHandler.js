import { DomainError } from '../errors/DomainError.js';
import { HttpError } from '../errors/HttpError.js';

/**
 * Estado HTTP para los códigos de `DomainError` que no son 422 (regla de negocio incumplida).
 */
const DOMAIN_ERROR_STATUS = Object.freeze({
  VALIDATION_ERROR: 400,
  UNKNOWN_QUESTION: 400,
  UNKNOWN_OPTION: 400,
  SCREEN_LOCKED: 409,
  ALREADY_COMPLETED: 409,
  GROUP_HAS_HISTORY: 409,
});

function errorBody(code, message, details) {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/**
 * 404 para rutas de la API que no existen.
 */
export function notFoundHandler(req, res) {
  res.status(404).json(errorBody('NOT_FOUND', `No existe la ruta ${req.method} ${req.baseUrl}${req.path}.`));
}

/**
 * Traduce cualquier error a `{ error: { code, message } }`. Los errores inesperados se registran
 * en el servidor y se responden como 500 sin exponer detalles internos.
 */
export function createErrorHandler({ logger = console } = {}) {
  // Express reconoce el middleware de errores por sus 4 argumentos.
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, _req, res, _next) {
    if (err instanceof HttpError) {
      return res.status(err.status).json(errorBody(err.code, err.message, err.details));
    }
    if (err instanceof DomainError) {
      const status = DOMAIN_ERROR_STATUS[err.code] ?? 422;
      return res.status(status).json(errorBody(err.code, err.message, err.details));
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json(errorBody('INVALID_JSON', 'El cuerpo de la petición no es JSON válido.'));
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json(errorBody('PAYLOAD_TOO_LARGE', 'El cuerpo de la petición es demasiado grande.'));
    }

    logger.error(err);
    return res.status(500).json(errorBody('INTERNAL_ERROR', 'Ocurrió un error inesperado.'));
  };
}
