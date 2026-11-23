/**
 * Error con estado HTTP explícito, lanzado por servicios y middleware.
 */
export class HttpError extends Error {
  /**
   * @param {number} status Código HTTP (401, 403, 404, 409...).
   * @param {string} code Código estable en SCREAMING_SNAKE_CASE.
   * @param {string} message Mensaje legible, sin datos personales.
   * @param {object} [details]
   */
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
