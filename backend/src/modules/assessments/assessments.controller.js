/**
 * Módulo assessments — Capa 1 (Presentación): traduce HTTP ↔ casos de uso. Sin SQL ni reglas de negocio.
 */
import { sendData } from '../../shared/utils/http.js';

/**
 * @param {ReturnType<import('./assessments.service.js').createAssessmentsService>} service
 */
export function createAssessmentsController(service) {
  return {
    listQuestions: (req, res) => {
      const questions = service.listQuestions(req.query);
      sendData(res, questions, { meta: { count: questions.length } });
    },
    listAssignments: (req, res) => {
      const assignments = service.listAssignments(req.auth, req.params.groupId);
      sendData(res, assignments, { meta: { count: assignments.length } });
    },
    getAssignment: (req, res) => sendData(res, service.getAssignment(req.auth, req.params.assignmentId)),
    createAssignment: (req, res) =>
      sendData(res, service.createAssignment(req.auth, req.params.groupId, req.body), { status: 201 }),
  };
}
