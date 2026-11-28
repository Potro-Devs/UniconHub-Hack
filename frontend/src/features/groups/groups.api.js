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
  /** Lee un .xlsx o .csv y devuelve la lista "Apellidos, Nombres" (no guarda). */
  previewStudentImport: (groupId, fileName, contentBase64) =>
    apiClient.post(`/groups/${encodeURIComponent(groupId)}/students/import-preview`, { fileName, contentBase64 }),
  /** Corrige nombre(s) y/o apellido(s); devuelve el alumno con sus iniciales recalculadas. */
  updateStudent: (groupId, studentId, patch) =>
    apiClient.patch(`/groups/${encodeURIComponent(groupId)}/students/${encodeURIComponent(studentId)}`, patch),
  /** Baja del grupo: no borra su historial. */
  withdrawStudent: (groupId, studentId) =>
    apiClient.post(`/groups/${encodeURIComponent(groupId)}/students/${encodeURIComponent(studentId)}/withdraw`),
  /** Elimina un alumno creado por error; si ya tiene datos responde 409 STUDENT_HAS_HISTORY. */
  deleteStudent: (groupId, studentId) =>
    apiClient.delete(`/groups/${encodeURIComponent(groupId)}/students/${encodeURIComponent(studentId)}`),
};
