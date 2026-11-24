/**
 * Módulo diagnostics — Capa 1 (Presentación): traduce HTTP ↔ casos de uso. Sin SQL ni reglas de negocio.
 */
import { sendData } from '../../shared/utils/http.js';

/**
 * @param {ReturnType<import('./diagnostics.service.js').createDiagnosticsService>} service
 */
export function createDiagnosticsController(service) {
  return {
    listStudentAssignments: (req, res) => {
      const assignments = service.listStudentAssignments(req.auth, req.params.studentId);
      sendData(res, assignments, { meta: { count: assignments.length } });
    },
    startAssignment: (req, res) => sendData(res, service.startAssignment(req.auth, req.params.assignmentId)),
    requestHint: (req, res) =>
      sendData(res, service.requestHint(req.auth, req.params.assignmentId, req.params.questionId, req.body)),
    answerQuestion: (req, res) =>
      sendData(res, service.answerQuestion(req.auth, req.params.assignmentId, req.body)),
    completeAssignment: (req, res) =>
      sendData(res, service.completeAssignment(req.auth, req.params.assignmentId)),
  };
}
