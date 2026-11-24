/**
 * Llamadas a `/api/v1/auth` (ver docs/api-contract.md).
 */
import { apiClient } from '@/shared/api/client';

const noAuth = { auth: false };

export const authApi = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }, noAuth),
  quickLoginStatus: () => apiClient.get('/auth/quick-login', noAuth),
  quickLoginTeacher: () => apiClient.post('/auth/quick-login/teacher', undefined, noAuth),
  quickLoginDirector: () => apiClient.post('/auth/quick-login/director', undefined, noAuth),
  quickLoginStudent: () => apiClient.post('/auth/quick-login/student', undefined, noAuth),
  joinGroup: (joinCode) => apiClient.post('/auth/student-join', { joinCode }, noAuth),
  selectStudent: (joinCode, studentId) =>
    apiClient.post('/auth/student-join/select', { joinCode, studentId }, noAuth),
};
