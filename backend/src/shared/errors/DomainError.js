/**
 * Error de regla de negocio lanzado por la capa de dominio.
 * La capa HTTP lo traduce a `{ error: { code, message } }` con el estado correspondiente.
 */
export class DomainError extends Error {
  /**
   * @param {string} code Código estable en SCREAMING_SNAKE_CASE (p. ej. `SCREEN_LOCKED`).
   * @param {string} message Mensaje legible, sin datos personales.
   * @param {object} [details] Información adicional para el cliente.
   */
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
