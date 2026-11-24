import { sendData } from '../../shared/utils/http.js';

export function createAnalyticsController(service) {
  return {
    getGroup(req, res) {
      const { data, meta } = service.getGroup(req.auth, req.params.groupId);
      return sendData(res, data, { meta });
    },
    getStudent(req, res) {
      const { data, meta } = service.getStudent(req.auth, req.params.groupId, req.params.studentId);
      return sendData(res, data, { meta });
    },
  };
}
