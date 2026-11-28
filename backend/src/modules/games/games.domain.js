/** Práctica manipulativa de ejemplo. Reglas puras, sin diagnóstico ni persistencia. */
import { DomainError } from '../../shared/errors/DomainError.js';
import { SPONSORED_CATALOG, buildSponsoredRounds, checkSponsoredAnswer, findSponsoredGame } from './games.sponsored.domain.js';

export const GAME_CONTENT_REVIEW = 'por validar con docente';
const CATALOG = Object.freeze([
  Object.freeze({ code: 'fractions', title: 'Pinta la fracción', skillCode: 'fractions',
    description: 'Construye una fracción pintando partes iguales de una figura.' }),
  Object.freeze({ code: 'multiplication', title: 'Reparte en grupos', skillCode: 'multiplication',
    description: 'Coloca contadores en recipientes para formar grupos iguales.' }),
  Object.freeze({ code: 'place_value', title: 'Construye el número', skillCode: 'place_value',
    description: 'Usa bloques de valor posicional para representar un número.' }),
]);

/** Primero los juegos propios (`sponsor: null`); después los de patrocinio educativo (demo). */
export function listGames() {
  return [
    ...CATALOG.map((game) => ({ ...game, sponsor: null })),
    ...SPONSORED_CATALOG.map((game) => findSponsoredGame(game.code)),
  ];
}

export function findGame(gameCode) {
  const game = CATALOG.find((entry) => entry.code === gameCode);
  return game ? { ...game, sponsor: null } : findSponsoredGame(gameCode);
}

const isSponsored = (gameCode) => SPONSORED_CATALOG.some((game) => game.code === gameCode);

const FRACTIONS = {
  1: [[1, 2], [1, 3], [3, 4]], 2: [[2, 3], [3, 4], [2, 5]],
  3: [[3, 4], [5, 6], [3, 8]], 4: [[3, 4], [5, 6], [3, 8]],
  5: [[5, 6], [3, 8], [7, 10]], 6: [[5, 6], [3, 8], [7, 10]],
};
const GROUPS = {
  1: [[2, 2], [2, 3], [3, 2]], 2: [[2, 4], [3, 3], [4, 2]],
  3: [[3, 4], [4, 3], [5, 2]], 4: [[4, 5], [5, 3], [6, 4]],
  5: [[5, 6], [6, 7], [4, 8]], 6: [[6, 8], [5, 9], [6, 9]],
};
const NUMBERS = {
  1: [14, 23, 35], 2: [17, 29, 43], 3: [132, 245, 367],
  4: [153, 276, 498], 5: [426, 583, 709], 6: [638, 754, 902],
};

export function buildGameRounds(gameCode, grade) {
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) throw new RangeError('El grado debe estar entre 1 y 6.');
  if (!findGame(gameCode)) throw new RangeError('Juego desconocido.');
  if (isSponsored(gameCode)) return buildSponsoredRounds(gameCode, grade);
  if (gameCode === 'fractions') return FRACTIONS[grade].map(([targetNumerator, denominator], index) => ({
    id: `${gameCode}-${index + 1}`,
    prompt: `Representa ${targetNumerator}/${denominator}.`,
    instruction: 'Toca las partes iguales que quieras pintar. Puedes volver a tocarlas para quitar la pintura.',
    material: { denominator, targetNumerator },
    hints: [
      'Observa que todas las partes de la figura tienen el mismo tamaño.',
      'Separa el reto en dos ideas: cómo está dividido el entero y qué parte te pide mostrar.',
      'En otro ejemplo, para representar 1/6 se divide una figura en seis partes iguales y se pinta una. Usa esa idea con tu fracción.',
    ],
  }));
  if (gameCode === 'multiplication') return GROUPS[grade].map(([groups, perGroup], index) => ({
    id: `${gameCode}-${index + 1}`,
    prompt: `Forma ${groups} grupos con ${perGroup} contadores en cada uno.`,
    instruction: 'Agrega o quita contadores en cada recipiente hasta construir los grupos pedidos.',
    material: { groups, perGroup, totalCounters: groups * perGroup },
    hints: [
      'Observa cuántos recipientes hay y compara lo que tiene cada uno.',
      'Reparte una vuelta a la vez: coloca un contador en cada recipiente y después revisa si necesitas otra vuelta.',
      'En otro ejemplo, tres grupos de un contador se construyen poniendo uno en cada uno de tres recipientes. Haz grupos iguales con los datos de tu reto.',
    ],
  }));
  return NUMBERS[grade].map((targetNumber, index) => ({
    id: `${gameCode}-${index + 1}`,
    prompt: `Construye el número ${targetNumber}.`,
    instruction: 'Agrega o quita bloques en cada posición. Usa de cero a nueve bloques por posición.',
    material: { targetNumber, places: grade <= 2 ? ['tens', 'units'] : ['hundreds', 'tens', 'units'] },
    hints: [
      'Observa la posición de cada cifra en el número que quieres construir.',
      grade <= 2 ? 'Una decena representa diez unidades. Empieza por las decenas y después revisa las unidades.'
        : 'Una centena representa cien unidades y una decena representa diez. Revisa una posición a la vez.',
      grade <= 2 ? 'En otro ejemplo, el número 50 se construye con cinco decenas y ninguna unidad. Usa las posiciones de tu número.'
        : 'En otro ejemplo, 810 se construye con ocho centenas, una decena y ninguna unidad. Usa las posiciones de tu número.',
    ],
  }));
}

const invalid = () => new DomainError('VALIDATION_ERROR', 'Envía la construcción de este reto con los controles del juego.');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value, maximum) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximum;
const hasExactKeys = (object, keys) => Object.keys(object).length === keys.length && keys.every((key) => Object.hasOwn(object, key));

/** Valida forma y límites; una construcción incorrecta válida no es un error HTTP. */
export function checkGameConstruction(gameCode, rounds, body, grade) {
  if (!isObject(body) || !hasExactKeys(body, ['roundId', 'answer']) || typeof body.roundId !== 'string') throw invalid();
  const round = rounds.find((entry) => entry.id === body.roundId);
  if (!round) throw new DomainError('VALIDATION_ERROR', 'Ese reto no está disponible en este juego.');
  const { answer } = body;
  if (isSponsored(gameCode)) {
    const { correct, explanation } = checkSponsoredAnswer(gameCode, round, grade, answer);
    return { correct, feedback: correct ? '¡Lo lograste! Puedes seguir explorando.'
      : 'Puedes ajustar tu respuesta y volver a probar.', explanation };
  }
  let correct;
  if (gameCode === 'fractions') {
    if (!isCount(answer, round.material.denominator)) throw invalid();
    correct = answer === round.material.targetNumerator;
  } else if (gameCode === 'multiplication') {
    if (!Array.isArray(answer) || answer.length !== round.material.groups
      || !Array.from(answer).every((count) => isCount(count, round.material.totalCounters))) throw invalid();
    correct = answer.every((count) => count === round.material.perGroup);
  } else if (gameCode === 'place_value') {
    if (!isObject(answer) || !hasExactKeys(answer, round.material.places)
      || !Object.values(answer).every((count) => isCount(count, 9))) throw invalid();
    const value = (answer.hundreds ?? 0) * 100 + answer.tens * 10 + answer.units;
    correct = value === round.material.targetNumber;
  } else throw invalid();
  const explanations = {
    fractions: correct ? 'La figura representa la fracción pedida con partes del mismo tamaño.'
      : 'Compara las partes pintadas con la fracción pedida y conserva el mismo tamaño en todas las partes.',
    multiplication: correct ? 'Cada grupo tiene la cantidad pedida y todos los grupos son iguales.'
      : 'Compara cada recipiente con la cantidad pedida. Puedes ajustar un recipiente a la vez.',
    place_value: correct ? 'Los bloques representan el número pedido según el valor de cada posición.'
      : 'Revisa el valor de los bloques de cada posición y compáralos con el número pedido.',
  };
  return { correct, feedback: correct ? 'Tu construcción está lista. Puedes seguir explorando.'
    : 'Puedes ajustar tu construcción y volver a probar.', explanation: explanations[gameCode] };
}
