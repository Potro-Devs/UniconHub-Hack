/**
 * Llamadas del alumno a `/api/v1/diagnostics` (ver docs/api-contract.md).
 * El servidor nunca revela si una respuesta es correcta: la retroalimentación es neutra.
 */
import { apiClient } from '@/shared/api/client';

const assignmentPath = (id) => `/diagnostics/assignments/${encodeURIComponent(id)}`;

export const diagnosticsApi = {
  listAssignments: (studentId, options) =>
    apiClient.get(`/diagnostics/students/${encodeURIComponent(studentId)}/assignments`, options),
  start: (assignmentId, options) => apiClient.get(`${assignmentPath(assignmentId)}/start`, options),
  requestHint: (assignmentId, questionId, level) =>
    apiClient.post(`${assignmentPath(assignmentId)}/questions/${encodeURIComponent(questionId)}/hints`, { level }),
  answer: (assignmentId, questionId, selectedOptionId) =>
    apiClient.post(`${assignmentPath(assignmentId)}/answer`, { questionId, selectedOptionId }),
  complete: (assignmentId) => apiClient.post(`${assignmentPath(assignmentId)}/complete`),
};

export { assignmentState } from './assignmentLogic';

/** Mensaje para los errores que el alumno puede encontrar al abrir o contestar una prueba. */
export function friendlyDiagnosticsError(error) {
  switch (error?.code) {
    case 'SCREEN_LOCKED': return 'Esta actividad se hace en papel con tu docente.';
    case 'ALREADY_COMPLETED': return 'Ya terminaste esta actividad. ¡Bien hecho!';
    case 'ASSIGNMENT_CLOSED': return 'Esta actividad ya cerró. Pregúntale a tu docente cuál sigue.';
    case 'ASSIGNMENT_NOT_FOUND': return 'No encontramos esta actividad. Vuelve al inicio.';
    case 'NOTHING_ANSWERED': return 'Contesta al menos una pregunta antes de terminar.';
    default: return error?.message || 'Algo no salió bien. Intenta de nuevo.';
  }
}
