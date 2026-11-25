import { sendData } from '../../shared/utils/http.js';

export function createTutoringController(service) {
  return {
    proposal(req, res) {
      const { data, meta } = service.getProposal(req.auth, req.params.groupId, req.query);
      return sendData(res, data, { meta });
    },
    listSessions(req, res) {
      const { data, meta } = service.listSessions(req.auth, req.params.groupId);
      return sendData(res, data, { meta });
    },
    createSession: (req, res) => sendData(res, service.createSession(req.auth, req.params.groupId, req.body), { status: 201 }),
    recordDemonstration: (req, res) =>
      sendData(res, service.recordDemonstration(req.auth, req.params.groupId, req.params.pairId, req.body)),
    /** @param {'cards' | 'key'} part */
    pdf(part) {
      return async (req, res, next) => {
        try {
          const { buffer, filename } = await service.renderCards(req.auth, req.params.groupId, req.params.sessionId, part);
          res.set('Content-Type', 'application/pdf');
          res.set('Content-Disposition', `attachment; filename="${filename}"`);
          res.set('Cache-Control', 'no-store');
          res.send(buffer);
        } catch (error) { next(error); }
      };
    },
  };
}
