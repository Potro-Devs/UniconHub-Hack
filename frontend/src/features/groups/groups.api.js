/**
 * Llamadas a `/api/v1/groups` (ver docs/api-contract.md, sección Groups).
 */
import { apiClient } from '@/shared/api/client';

export const groupsApi = {
  list: () => apiClient.get('/groups'),
  create: ({ grade, section, schoolYear }) => apiClient.post('/groups', { grade, section, schoolYear }),
  get: (groupId) => apiClient.get(`/groups/${encodeURIComponent(groupId)}`),
  update: (groupId, patch) => apiClient.patch(`/groups/${encodeURIComponent(groupId)}`, patch),
  listStudents: (groupId) => apiClient.get(`/groups/${encodeURIComponent(groupId)}/students`),
  addStudent: (groupId, { firstNames, lastNames }) =>
    apiClient.post(`/groups/${encodeURIComponent(groupId)}/students`, { firstNames, lastNames }),
  addStudentsBulk: (groupId, text) =>
    apiClient.post(`/groups/${encodeURIComponent(groupId)}/students/bulk`, { text }),
};
