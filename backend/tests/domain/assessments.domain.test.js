import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  MIN_QUESTIONS_PER_SKILL,
  assertQuestionsPerSkill,
  assertValidModality,
  findHintsRevealingAnswer,
  validateQuestion,
  validateQuestionsPerSkill,
} from '../../src/modules/assessments/assessments.domain.js';
import { DomainError } from '../../src/shared/errors/DomainError.js';

const qs = (skill, n) => Array.from({ length: n }, () => ({ skill }));

describe('mínimo de reactivos por habilidad', () => {
  test('MIN_QUESTIONS_PER_SKILL es 3', () => {
    assert.equal(MIN_QUESTIONS_PER_SKILL, 3);
  });

  test('acepta 3 o más reactivos por habilidad', () => {
    const result = validateQuestionsPerSkill([...qs('fractions', 3), ...qs('multiplication', 5)]);
    assert.equal(result.valid, true);
    assert.deepEqual(result.counts, { fractions: 3, multiplication: 5 });
  });

  for (const n of [1, 2]) {
    test(`bloquea una habilidad con ${n} reactivo(s)`, () => {
      const questions = [...qs('fractions', 4), ...qs('place_value', n)];
      const result = validateQuestionsPerSkill(questions);
      assert.equal(result.valid, false);
      assert.deepEqual(result.insufficient, [{ skill: 'place_value', count: n, missing: 3 - n }]);

      assert.throws(
        () => assertQuestionsPerSkill(questions),
        (err) => err instanceof DomainError && err.code === 'INSUFFICIENT_QUESTIONS_PER_SKILL'
          && err.details.insufficient[0].skill === 'place_value',
      );
    });
  }

  test('bloquea una prueba vacía', () => {
    assert.equal(validateQuestionsPerSkill([]).valid, false);
    assert.throws(() => assertQuestionsPerSkill([]), (err) => err.code === 'EMPTY_ASSESSMENT');
  });
});

describe('modalidad', () => {
  test('acepta screen y paper', () => {
    assert.doesNotThrow(() => assertValidModality('screen'));
    assert.doesNotThrow(() => assertValidModality('paper'));
  });

  test('rechaza otras modalidades', () => {
    assert.throws(() => assertValidModality('mixed'), (err) => err.code === 'INVALID_MODALITY');
  });
});

describe('pistas que revelan la respuesta', () => {
  test('detecta la respuesta literal sin importar mayúsculas ni acentos', () => {
    const hints = ['Cuenta las partes.', 'La respuesta es 1/4.', 'Ejemplo: 1/3.'];
    assert.deepEqual(findHintsRevealingAnswer(hints, '1/4'), [2]);
    assert.deepEqual(findHintsRevealingAnswer(['Piensa en LUÍS'], 'Luis'), [1]);
  });

  test('no confunde respuestas que solo comparten dígitos', () => {
    const hints = ['Son 4 partes iguales.', 'Mira el 11/4 del ejemplo.', 'Ejemplo parecido: 1/3.'];
    assert.deepEqual(findHintsRevealingAnswer(hints, '1/4'), []);
  });

  test('solo marca coincidencias de palabra completa', () => {
    assert.deepEqual(findHintsRevealingAnswer(['Compara cada parte del entero.'], 'parte del'), [1]);
    assert.deepEqual(findHintsRevealingAnswer(['Cuenta los cuartos.'], 'cuarto'), []);
  });
});

describe('validateQuestion', () => {
  const valid = () => ({
    hints: ['Cuenta las partes.', 'El total va abajo.', 'Ejemplo: 1 de 3 es 1/3.'],
    options: [
      { text: '1/4', is_correct: true },
      { text: '4/1', is_correct: false, error_tag: 'inverts_fraction', error_explanation: 'Invierte arriba y abajo.' },
      { text: '1/3', is_correct: false, error_tag: 'counts_unshaded', error_explanation: 'Usa las partes sin pintar como total.' },
    ],
  });

  test('un reactivo bien formado no tiene problemas', () => {
    assert.deepEqual(validateQuestion(valid()), []);
  });

  test('exige exactamente 3 pistas no vacías', () => {
    const q = valid();
    q.hints = ['Una', ' '];
    assert.ok(validateQuestion(q).includes('HINTS_MUST_BE_THREE_LEVELS'));
  });

  test('exige una sola opción correcta', () => {
    const q = valid();
    q.options[1] = { text: '2/8', is_correct: true };
    assert.ok(validateQuestion(q).includes('EXACTLY_ONE_CORRECT_OPTION'));
  });

  test('exige error_tag y explicación en cada distractor', () => {
    const q = valid();
    q.options[2] = { text: '1/3', is_correct: false, error_tag: 'x' };
    assert.ok(validateQuestion(q).includes('DISTRACTOR_WITHOUT_ERROR_TAG'));
  });

  test('rechaza una pista que revela la respuesta', () => {
    const q = valid();
    q.hints[2] = 'Es 1/4.';
    assert.ok(validateQuestion(q).includes('HINT_REVEALS_ANSWER'));
  });
});
