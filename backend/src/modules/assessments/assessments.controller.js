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
    listQuizzes: (req, res) => {
      const result = service.listQuizzes(req.auth, req.query);
      sendData(res, result, { meta: { count: result.quizzes.length } });
    },
    getQuiz: (req, res) => sendData(res, service.getQuiz(req.auth, req.params.quizId, req.query)),
    createQuiz: (req, res) => sendData(res, service.createQuiz(req.auth, req.body), { status: 201 }),
    updateQuiz: (req, res) => sendData(res, service.updateQuiz(req.auth, req.params.quizId, req.body)),
    exportQuizPdf: async (req, res, next) => {
      try {
        const { buffer, filename, contentType } = await service.exportQuizPdf(req.auth, req.params.quizId, req.query);
        res.set('Content-Type', contentType);
        res.set('Content-Disposition', `attachment; filename="${filename}"`);
        res.set('Cache-Control', 'no-store');
        res.send(buffer);
      } catch (error) {
        next(error);
      }
    },
  };
}
