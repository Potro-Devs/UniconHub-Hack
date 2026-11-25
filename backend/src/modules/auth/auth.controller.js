/**
 * Módulo auth — Capa 1 (Presentación): traduce HTTP ↔ casos de uso. Sin SQL ni reglas de negocio.
 */
import { asyncHandler, sendData } from '../../shared/utils/http.js';

/**
 * @param {ReturnType<import('./auth.service.js').createAuthService>} service
 */
export function createAuthController(service) {
  return {
    login: asyncHandler(async (req, res) => sendData(res, await service.login(req.body))),
    quickLoginStatus: (_req, res) => sendData(res, service.quickLoginStatus()),
    quickLoginTeacher: (_req, res) => sendData(res, service.quickLoginTeacher()),
    quickLoginDirector: (_req, res) => sendData(res, service.quickLoginDirector()),
    quickLoginStudent: (_req, res) => sendData(res, service.quickLoginStudent()),
    joinGroup: (req, res) => sendData(res, service.joinGroup(req.body)),
    selectStudent: (req, res) => sendData(res, service.selectStudent(req.body)),
    me: (req, res) => sendData(res, service.me(req.auth)),
  };
}
