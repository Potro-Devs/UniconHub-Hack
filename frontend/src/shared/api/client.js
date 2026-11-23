/**
 * Instancia compartida del cliente HTTP (`/api/v1`). En desarrollo, Vite redirige `/api`
 * al backend (ver `vite.config.js`).
 */
import { createApiClient } from './createApiClient';

export { ApiError, errorMessageOf } from './createApiClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

let tokenProvider = () => null;
let unauthorizedHandler = () => {};

/**
 * La sesión registra aquí cómo obtener el token y qué hacer si el servidor lo rechaza.
 */
export function configureApiAuth({ getToken, onUnauthorized }) {
  tokenProvider = getToken;
  unauthorizedHandler = onUnauthorized;
}

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: () => tokenProvider(),
  onUnauthorized: (error) => unauthorizedHandler(error),
});
