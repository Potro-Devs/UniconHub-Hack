/** Práctica sin escrituras. La matrícula y el grado se consultan en cada petición. */
import { HttpError } from '../../shared/errors/HttpError.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import { GAME_CONTENT_REVIEW, listGames, findGame, buildGameRounds, checkGameConstruction } from './games.domain.js';
import { applyDemoSponsor } from './games.sponsored.domain.js';

const practice = { practiceOnly: true, contentReview: GAME_CONTENT_REVIEW };

/**
 * @param {{ demoSponsors?: { overrides: Map<string, { name: string, logo: string | null }> }, logoUrlFor?: (logo: string | null) => string | null }} deps
 *   Marcas de demostración del servidor (opcional): reemplazan a la marca de ejemplo.
 */
export function createGamesService({ groupsRepository, repository, demoSponsors, logoUrlFor = () => null }) {
  const overrides = demoSponsors?.overrides ?? new Map();
  const withSponsor = (game) => applyDemoSponsor(game, overrides.get(game?.code), logoUrlFor);
  const requireActiveStudent = (auth) => {
    const group = groupsRepository.findGroupOfSchool(parsePositiveId(auth.groupId, 'grupo'), auth.schoolId);
    const student = group && groupsRepository.findActiveStudentInGroup(parsePositiveId(auth.sub, 'alumno'), group.id);
    if (!student || !repository.isStudentInSchool(student.id, group.school_id)) {
      throw new HttpError(403, 'STUDENT_ACCESS_REVOKED', 'Tu acceso a este grupo cambió. Entra de nuevo con tu tarjeta.');
    }
    return group;
  };
  const loadGame = (auth, gameCode) => {
    const group = requireActiveStudent(auth);
    const game = withSponsor(findGame(gameCode));
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND', 'No encontramos ese juego.');
    return { game, grade: group.grade, rounds: buildGameRounds(gameCode, group.grade), ...practice };
  };
  return {
    getCatalog(auth) {
      const group = requireActiveStudent(auth);
      return { games: listGames().map(withSponsor), grade: group.grade, ...practice };
    },
    getGame: loadGame,
    check(auth, gameCode, body) {
      const { rounds, grade } = loadGame(auth, gameCode);
      return checkGameConstruction(gameCode, rounds, body, grade);
    },
  };
}
