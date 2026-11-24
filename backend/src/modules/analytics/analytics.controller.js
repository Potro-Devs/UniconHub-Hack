import { sendData } from '../../shared/utils/http.js';

export function createAnalyticsController(service) {
  return {
    getGroup(req, res) {
      const { data, meta } = service.getGroup(req.auth, req.params.groupId, req.query);
      return sendData(res, data, { meta });
    },
    exportGroup(format) {
      return async (req, res, next) => {
        try {
          const { buffer, filename, contentType } = await service.exportGroup(req.auth, req.params.groupId, req.query, format);
          res.set('Content-Type', contentType);
          res.set('Content-Disposition', `attachment; filename="${filename}"`);
          res.set('Cache-Control', 'no-store');
          res.send(buffer);
        } catch (error) { next(error); }
      };
    },
    getSchool(req, res) {
      const { data, meta } = service.getSchool(req.auth);
      return sendData(res, data, { meta });
    },
    getStudent(req, res) {
      const { data, meta } = service.getStudent(req.auth, req.params.groupId, req.params.studentId);
      return sendData(res, data, { meta });
    },
  };
}
