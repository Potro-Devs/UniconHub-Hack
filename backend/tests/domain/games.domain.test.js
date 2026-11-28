import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildGameRounds, checkGameConstruction, findGame, listGames } from '../../src/modules/games/games.domain.js';

const codes = ['fractions', 'multiplication', 'place_value'];
const answerFor = (code, round) => code === 'fractions' ? round.material.targetNumerator
  : code === 'multiplication' ? Array(round.material.groups).fill(round.material.perGroup)
    : Object.fromEntries(round.material.places.map((place) => [place, Math.floor(round.material.targetNumber / ({ hundreds: 100, tens: 10, units: 1 }[place])) % 10]));
const check = (code, rounds, answer, round = rounds[0]) => checkGameConstruction(code, rounds, { roundId: round.id, answer });

describe('games domain: construcciones manipulativas sin evaluación', () => {
  test('catálogo: tres juegos propios primero y después los patrocinados (demo); las copias no alteran el catálogo', () => {
    assert.deepEqual(listGames().map((game) => game.code), [...codes, 'grammar_fix', 'mental_math', 'symmetry']);
    assert.ok(listGames().slice(0, 3).every((game) => game.sponsor === null));
    const sponsored = listGames()[3]; sponsored.sponsor.name = 'Otra';
    assert.equal(findGame('grammar_fix').sponsor.name, 'Marca patrocinadora de ejemplo');
    const copy = listGames(); copy[0].title = 'Cambio externo';
    assert.notEqual(findGame('fractions').title, 'Cambio externo');
    assert.equal(findGame('unknown'), null);
  });

  for (const grade of [1, 2, 3, 4, 5, 6]) {
    test(`grado ${grade}: tres retos por juego, pistas distintas y álgebra correcta`, () => {
      for (const code of codes) {
        const rounds = buildGameRounds(code, grade);
        assert.equal(rounds.length, 3);
        assert.equal(new Set(rounds.map((round) => round.id)).size, 3);
        for (const round of rounds) {
          assert.equal(round.hints.length, 3);
          assert.equal(new Set(round.hints).size, 3);
          const result = check(code, rounds, answerFor(code, round), round);
          assert.equal(result.correct, true);
          assert.equal(typeof result.explanation, 'string');
          const incorrect = code === 'fractions' ? 0 : code === 'multiplication' ? Array(round.material.groups).fill(0)
            : Object.fromEntries(round.material.places.map((place) => [place, 0]));
          assert.equal(check(code, rounds, incorrect, round).correct, false);
          if (code === 'fractions') assert.ok(![1, 6].every((value, index) => value === [round.material.targetNumerator, round.material.denominator][index]), 'ejemplo 1/6 distinto del objetivo');
          if (code === 'multiplication') assert.ok(round.material.groups !== 3 || round.material.perGroup !== 1, 'ejemplo 3 grupos de 1 distinto');
          if (code === 'place_value') assert.notEqual(round.material.targetNumber, grade <= 2 ? 50 : 810);
        }
      }
    });
  }

  test('pista de fracciones orienta sin asignar directamente cada número', () => {
    for (const grade of [1, 2, 3, 4, 5, 6]) {
      for (const round of buildGameRounds('fractions', grade)) {
        assert.doesNotMatch(round.hints[1], /\b(abajo|arriba|numerador|denominador)\b/i);
      }
    }
  });

  test('fracciones valida conteos enteros y límites del denominador', () => {
    const rounds = buildGameRounds('fractions', 3);
    for (const invalid of [-1, rounds[0].material.denominator + 1, 1.2, '3', null, [], {}, true]) {
      assert.throws(() => check('fractions', rounds, invalid), (error) => error.code === 'VALIDATION_ERROR');
    }
    assert.equal(check('fractions', rounds, rounds[0].material.denominator).correct, false);
  });

  test('multiplicaciones exige cantidad por recipiente, no solo suma total', () => {
    const rounds = buildGameRounds('multiplication', 3);
    assert.equal(check('multiplication', rounds, [3, 4, 5]).correct, false);
    for (const invalid of [4, [4, 4], [4, 4, 4, 4], [-1, 4, 4], [13, 0, 0], ['4', 4, 4], [4.1, 4, 4], null]) {
      assert.throws(() => check('multiplication', rounds, invalid), (error) => error.code === 'VALIDATION_ERROR');
    }
  });

  test('valor posicional exige cifras 0–9 y claves exactas según grado', () => {
    const early = buildGameRounds('place_value', 1);
    const later = buildGameRounds('place_value', 6);
    assert.equal(check('place_value', early, { tens: 0, units: 9 }).correct, false);
    for (const invalid of [{ hundreds: 0, tens: 1, units: 4 }, { tens: 1 }, { tens: '1', units: 4 }, { tens: 0, units: 14 }, { tens: -1, units: 4 }, { tens: 1, units: 4, extra: 0 }, [], null]) {
      assert.throws(() => check('place_value', early, invalid), (error) => error.code === 'VALIDATION_ERROR');
    }
    assert.throws(() => check('place_value', later, { tens: 3, units: 8 }), (error) => error.code === 'VALIDATION_ERROR');
  });

  test('rechaza retos ajenos, override de grado y cuerpos no esperados', () => {
    const rounds = buildGameRounds('fractions', 1);
    for (const body of [null, [], {}, { roundId: 'unknown', answer: 1 }, { roundId: rounds[0].id, answer: 1, grade: 6 }, { roundId: rounds[0].id }]) {
      assert.throws(() => checkGameConstruction('fractions', rounds, body), (error) => error.code === 'VALIDATION_ERROR');
    }
    for (const grade of [0, 7, '3', NaN]) assert.throws(() => buildGameRounds('fractions', grade), RangeError);
    assert.throws(() => buildGameRounds('unknown', 3), RangeError);
  });
});
