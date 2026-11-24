import { sendData } from '../../shared/utils/http.js';

export function createGamesController(service) {
  return {
    getCatalog: (req, res) => sendData(res, service.getCatalog(req.auth)),
    getGame: (req, res) => sendData(res, service.getGame(req.auth, req.params.gameCode)),
    check: (req, res) => sendData(res, service.check(req.auth, req.params.gameCode, req.body)),
  };
}
