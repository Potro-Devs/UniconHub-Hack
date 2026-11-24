/**
 * Módulo curriculum — Capa 1 (Presentación): traduce HTTP ↔ casos de uso. Sin SQL ni reglas de negocio.
 */
import { sendData } from '../../shared/utils/http.js';

/**
 * @param {ReturnType<import('./curriculum.service.js').createCurriculumService>} service
 */
export function createCurriculumController(service) {
  return {
    getGroupCurriculum: (req, res) => {
      const { contents, meta } = service.getGroupCurriculum(req.auth, req.params.groupId);
      sendData(res, contents, { meta });
    },
    getCoverage: (req, res) => {
      const { coverage, meta } = service.getCoverage(req.auth, req.params.groupId);
      sendData(res, coverage, { meta });
    },
    updateContent: (req, res) =>
      sendData(res, service.updateContentProgress(req.auth, req.params.groupId, req.params.contentId, req.body)),
  };
}
