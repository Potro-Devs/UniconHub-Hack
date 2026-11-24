/** Práctica sin escrituras. La matrícula y el grado se consultan en cada petición. */
import { HttpError } from '../../shared/errors/HttpError.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import { GAME_CONTENT_REVIEW, listGames, findGame, buildGameRounds, checkGameConstruction } from './games.domain.js';

const practice = { practiceOnly: true, contentReview: GAME_CONTENT_REVIEW };

export function createGamesService({ groupsRepository, repository }) {
  const requireActiveStudent = (auth) => {
    if (auth.role !== 'student') throw new HttpError(403, 'FORBIDDEN', 'Entra con tu tarjeta de alumno para practicar.');
    const group = groupsRepository.findGroupOfSchool(parsePositiveId(auth.groupId, 'grupo'), auth.schoolId);
    const student = group && groupsRepository.findActiveStudentInGroup(parsePositiveId(auth.sub, 'alumno'), group.id);
    if (!student || !repository.isStudentInSchool(student.id, group.school_id)) {
      throw new HttpError(403, 'STUDENT_ACCESS_REVOKED', 'Tu acceso a este grupo cambió. Entra de nuevo con tu tarjeta.');
    }
    return group;
  };
  const loadGame = (auth, gameCode) => {
    const group = requireActiveStudent(auth);
    const game = findGame(gameCode);
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND', 'No encontramos ese juego.');
    return { game, grade: group.grade, rounds: buildGameRounds(gameCode, group.grade), ...practice };
  };
  return {
    getCatalog(auth) {
      const group = requireActiveStudent(auth);
      return { games: listGames(), grade: group.grade, ...practice };
    },
    getGame: loadGame,
    check(auth, gameCode, body) {
      const { rounds } = loadGame(auth, gameCode);
      return checkGameConstruction(gameCode, rounds, body);
    },
  };
}
