/**
 * Módulo paper-mode — Capa 1 (Presentación): traduce HTTP ↔ casos de uso. Sin SQL ni reglas de negocio.
 * Los endpoints aún sin implementar responden 501; al implementar uno, reemplaza su `notImplemented`.
 */
import { HttpError } from '../../shared/errors/HttpError.js';
import { sendData } from '../../shared/utils/http.js';

const notImplemented = (endpoint) => () => {
  throw new HttpError(501, 'NOT_IMPLEMENTED', `${endpoint} aún no está disponible.`);
};

/**
 * @param {ReturnType<import('./paper-mode.service.js').createPaperModeService>} service
 */
export function createPaperModeController(service) {
  return {
    exportSheetPdf: notImplemented('La hoja en PDF'),
    exportHintsPdf: notImplemented('Las tarjetas de pistas en PDF'),
    getCaptureStatus: (req, res) => sendData(res, service.getCaptureStatus(req.auth, req.params.assignmentId)),
    captureStudent: (req, res) =>
      sendData(res, service.captureStudent(req.auth, req.params.assignmentId, req.params.studentId, req.body)),
  };
}
