/**
 * Módulo paper-mode — Capa 1 (Presentación): traduce HTTP ↔ casos de uso. Sin SQL ni reglas de negocio.
 */
import { sendData } from '../../shared/utils/http.js';

/** Envía un PDF como descarga. Express 4 no captura errores async: se pasan a `next`. */
const sendPdf = (load) => async (req, res, next) => {
  try {
    const { buffer, filename, contentType } = await load(req);
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @param {ReturnType<import('./paper-mode.service.js').createPaperModeService>} service
 */
export function createPaperModeController(service) {
  return {
    exportSheetPdf: sendPdf((req) => service.exportSheetPdf(req.auth, req.params.assignmentId)),
    exportHintsPdf: sendPdf((req) => service.exportHintsPdf(req.auth, req.params.assignmentId)),
    getCaptureStatus: (req, res) => sendData(res, service.getCaptureStatus(req.auth, req.params.assignmentId)),
    captureStudent: (req, res) =>
      sendData(res, service.captureStudent(req.auth, req.params.assignmentId, req.params.studentId, req.body)),
  };
}
