import { sendData } from '../../shared/utils/http.js';

export function createInterventionsController(service) {
  return {
    list: (req, res) => sendData(res, service.list(req.auth, req.params.groupId)),
    create: (req, res) => sendData(res, service.create(req.auth, req.params.groupId, req.body), { status: 201 }),
  };
}
