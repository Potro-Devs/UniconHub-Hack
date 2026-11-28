/**
 * Módulo groups — Capa 1 (Presentación): traduce HTTP ↔ casos de uso. Sin SQL ni reglas de negocio.
 */
import { asyncHandler, sendData } from '../../shared/utils/http.js';

/**
 * @param {ReturnType<import('./groups.service.js').createGroupsService>} service
 */
export function createGroupsController(service) {
  return {
    list: (req, res) => {
      const groups = service.listGroups(req.auth);
      sendData(res, groups, { meta: { count: groups.length } });
    },
    create: (req, res) => sendData(res, service.createGroup(req.auth, req.body), { status: 201 }),
    get: (req, res) => sendData(res, service.getGroup(req.auth, req.params.groupId)),
    update: (req, res) => sendData(res, service.updateGroup(req.auth, req.params.groupId, req.body)),
    listStudents: (req, res) => {
      const students = service.listStudents(req.auth, req.params.groupId);
      sendData(res, students, { meta: { count: students.length } });
    },
    updateStudent: (req, res) =>
      sendData(res, service.updateStudent(req.auth, req.params.groupId, req.params.studentId, req.body)),
    withdrawStudent: (req, res) => sendData(res, service.withdrawStudent(req.auth, req.params.groupId, req.params.studentId)),
    deleteStudent: (req, res) => sendData(res, service.deleteStudent(req.auth, req.params.groupId, req.params.studentId)),
    openSecretSetup: (req, res) => sendData(res, service.openSecretSetup(req.auth, req.params.groupId, req.body)),
    closeSecretSetup: (req, res) => sendData(res, service.closeSecretSetup(req.auth, req.params.groupId)),
    resetStudentSecret: (req, res) =>
      sendData(res, service.resetStudentSecret(req.auth, req.params.groupId, req.params.studentId)),
    addStudent: (req, res) =>
      sendData(res, service.addStudent(req.auth, req.params.groupId, req.body), { status: 201 }),
    previewStudentImport: asyncHandler(async (req, res) =>
      sendData(res, await service.previewStudentImport(req.auth, req.params.groupId, req.body))),
    addStudentsBulk: (req, res) => {
      const result = service.addStudentsBulk(req.auth, req.params.groupId, req.body);
      sendData(res, result, {
        status: 201,
        meta: { createdCount: result.created.length },
      });
    },
    updateAvatar: (req, res) => sendData(res, service.updateAvatar(req.auth, req.params.studentId, req.body)),
  };
}
