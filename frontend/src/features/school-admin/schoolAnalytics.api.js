/**
 * Panel de la escuela para Dirección (`GET /api/v1/analytics/school`, ver docs/api-contract.md).
 */
import { apiClient } from '@/shared/api/client';

export const schoolAnalyticsApi = {
  school: (options) => apiClient.get('/analytics/school', options),
};
