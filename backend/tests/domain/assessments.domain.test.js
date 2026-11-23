import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  MIN_QUESTIONS_PER_SKILL,
  assertQuestionsPerSkill,
  assertRequestedSkillsHaveQuestions,
  toTargetDto,
  findHintsRevealingAnswer,
  validateQuestion,
  validateQuestionsPerSkill,
  assertQuestionsForGrade,
  assertStudentsInGroup,
  countTargetsByStatus,
  orderQuestionsByIds,
  orderQuestionsBySkills,
  parseAssignmentInput,
  parseQuestionFilters,
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

const code = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return null;
};

describe('entradas de assessments', () => {
  test('parseQuestionFilters: opcionales, grado 1–6 y habilidad conocida', () => {
    assert.deepEqual(parseQuestionFilters({}), { grade: null, skill: null });
    assert.deepEqual(parseQuestionFilters({ grade: '3', skill: 'fractions' }), { grade: 3, skill: 'fractions' });
    for (const query of [{ grade: '0' }, { grade: '7' }, { grade: ['3'] }, { skill: 'geometry' }]) {
      assert.equal(code(() => parseQuestionFilters(query)), 'VALIDATION_ERROR');
    }
  });

  test('parseAssignmentInput: exactamente una forma de elegir reactivos', () => {
    const base = { title: '  Prueba   uno ', modality: 'paper' };
    assert.deepEqual(parseAssignmentInput({ ...base, skills: ['fractions'] }), {
      title: 'Prueba uno', modality: 'paper', questionIds: null, skills: ['fractions'], studentIds: null,
    });
    assert.equal(code(() => parseAssignmentInput({ ...base, skills: ['fractions'], questionIds: [1, 2, 3] })), 'VALIDATION_ERROR');
    assert.equal(code(() => parseAssignmentInput(base)), 'VALIDATION_ERROR');
    assert.equal(code(() => parseAssignmentInput({ ...base, questionIds: [1, 1, 2] })), 'VALIDATION_ERROR');
    assert.equal(code(() => parseAssignmentInput({ ...base, questionIds: ['1'] })), 'VALIDATION_ERROR');
    assert.equal(code(() => parseAssignmentInput({ ...base, modality: 'online', skills: ['fractions'] })), 'VALIDATION_ERROR');
    assert.equal(code(() => parseAssignmentInput(null)), 'VALIDATION_ERROR');
  });

  test('assertQuestionsForGrade separa inexistentes y de otro grado', () => {
    assert.doesNotThrow(() => assertQuestionsForGrade([1, 2], [{ id: 1, grade: 3 }, { id: 2, grade: 3 }], 3));
    try {
      assertQuestionsForGrade([1, 2, 3], [{ id: 1, grade: 3 }, { id: 2, grade: 4 }], 3);
      assert.fail('debió lanzar');
    } catch (error) {
      assert.deepEqual(error.details, { unknownQuestionIds: [3], wrongGradeQuestionIds: [2] });
    }
  });

  test('orden de reactivos: por ids pedidos o por habilidad y luego id', () => {
    const qs = [{ id: 5, skill: 'fractions' }, { id: 2, skill: 'place_value' }, { id: 3, skill: 'fractions' }];
    assert.deepEqual(orderQuestionsByIds(qs, [3, 5, 2]).map((q) => q.id), [3, 5, 2]);
    assert.deepEqual(orderQuestionsBySkills(qs, ['place_value', 'fractions']).map((q) => q.id), [2, 3, 5]);
  });

  test('assertStudentsInGroup reporta los ids que no están activos', () => {
    assert.doesNotThrow(() => assertStudentsInGroup([1, 2], [2, 1]));
    assert.equal(code(() => assertStudentsInGroup([1, 9], [1])), 'VALIDATION_ERROR');
  });

  test('countTargetsByStatus incluye todos los estados y el total', () => {
    assert.deepEqual(countTargetsByStatus([{ status: 'pending', count: 3 }, { status: 'completed_paper', count: 2 }]), {
      total: 5, pending: 3, in_progress: 0, completed_screen: 0, completed_paper: 2,
    });
  });
});

describe('habilidades pedidas sin reactivos', () => {
  test('reporta solo las ausentes con count 0 y missing 3', () => {
    const qs = [{ skill: 'fractions' }, { skill: 'fractions' }, { skill: 'fractions' }];
    assert.doesNotThrow(() => assertRequestedSkillsHaveQuestions(['fractions'], qs));
    assert.throws(
      () => assertRequestedSkillsHaveQuestions(['fractions', 'reading_comprehension'], qs),
      (err) =>
        err instanceof DomainError &&
        err.code === 'INSUFFICIENT_QUESTIONS_PER_SKILL' &&
        JSON.stringify(err.details.insufficient) ===
          JSON.stringify([{ skill: 'reading_comprehension', count: 0, missing: MIN_QUESTIONS_PER_SKILL }]),
    );
  });

  test('toTargetDto expone solo id, estado y bloqueo', () => {
    assert.deepEqual(toTargetDto({ student_id: 7, status: 'pending', is_screen_locked: 1, internal_folio: 'AXI-X' }), {
      studentId: 7, status: 'pending', isScreenLocked: true,
    });
  });
});
