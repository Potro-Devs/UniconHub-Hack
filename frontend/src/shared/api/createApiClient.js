/**
 * Cliente HTTP para la API REST de Axi (`{ data, meta }` / `{ error: { code, message } }`).
 * Sin dependencias de Vite ni del navegador para poder probarlo con `node --test`.
 */

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
const UNEXPECTED_ERROR_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/**
 * @param {{
 *   baseUrl: string,
 *   fetchImpl?: typeof fetch,
 *   getToken?: () => string | null,
 *   onUnauthorized?: (error: ApiError) => void,
 * }} options
 */
export function createApiClient({ baseUrl, fetchImpl = (...args) => fetch(...args), getToken = () => null, onUnauthorized = () => {} }) {
  /**
   * @param {string} method
   * @param {string} path Ruta relativa a `baseUrl` (p. ej. `/auth/login`).
   * @param {{ body?: unknown, auth?: boolean, signal?: AbortSignal, responseType?: 'json' | 'blob' }} [options]
   * @returns {Promise<any>} El campo `data` de JSON, o un Blob para descargas autenticadas.
   */
  async function request(method, path, { body, auth = true, signal, responseType = 'json' } = {}) {
    const headers = { Accept: responseType === 'blob' ? '*/*' : 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = auth ? getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: NETWORK_ERROR_MESSAGE });
    }

    if (response.ok && responseType === 'blob') return response.blob();
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new ApiError({
        status: response.status,
        code: payload?.error?.code ?? 'HTTP_ERROR',
        message: payload?.error?.message ?? UNEXPECTED_ERROR_MESSAGE,
        details: payload?.error?.details,
      });
      // Solo una sesión que se envió y fue rechazada cierra la sesión local.
      if (response.status === 401 && token) onUnauthorized(error);
      throw error;
    }
    return payload?.data;
  }

  return {
    request,
    get: (path, options) => request('GET', path, options),
    download: (path, options) => request('GET', path, { ...options, responseType: 'blob' }),
    post: (path, body, options) => request('POST', path, { ...options, body }),
    patch: (path, body, options) => request('PATCH', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
  };
}

/**
 * Mensaje para mostrar al usuario a partir de cualquier error.
 */
export function errorMessageOf(error) {
  return error instanceof ApiError ? error.message : UNEXPECTED_ERROR_MESSAGE;
}
