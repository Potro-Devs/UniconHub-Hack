/**
 * Stub de cliente HTTP centralizado para comunicarse con el API REST (/api/v1).
 * Sin llamadas reales implementadas en la etapa de configuración inicial.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = {
  baseUrl: API_BASE_URL,
  async request(_path, _options = {}) {
    throw new Error('Cliente API aún no conectado al backend.');
  },
};
