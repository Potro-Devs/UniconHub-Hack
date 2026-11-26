/**
 * Módulo paper-mode — Capa 1 (Presentación): controladores HTTP.
 * Esqueleto: cada endpoint responde 501 hasta que se implemente su caso de uso.
 * Al implementar uno, reemplaza su `notImplemented` por la llamada al service.
 */
import { HttpError } from '../../shared/errors/HttpError.js';

const notImplemented = (endpoint) => () => {
  throw new HttpError(501, 'NOT_IMPLEMENTED', `${endpoint} aún no está disponible.`);
};

export function createPaperModeController() {
  return {
    exportSheetPdf: notImplemented('La hoja en PDF'),
    exportHintsPdf: notImplemented('Las tarjetas de pistas en PDF'),
    getCaptureStatus: notImplemented('El avance de captura'),
    captureStudent: notImplemented('La captura en papel'),
  };
}
