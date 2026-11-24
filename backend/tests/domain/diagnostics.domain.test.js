import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assertCanAnswerOnScreen,
  canRecordMasteryCut,
  classifyResponse,
  evaluateAchievements,
  initialTargetState,
  paperCapturedTargetState,
  scoreSession,
  summarizeErrorTags,
} from '../../src/modules/diagnostics/diagnostics.domain.js';

const correct = { is_correct: 1, error_tag: null };
const distractor = { is_correct: 0, error_tag: 'inverts_fraction' };

describe('classifyResponse', () => {
  test('correcta sin pistas → correct_autonomous', () => {
    assert.deepEqual(classifyResponse({ selectedOption: correct, maxHintLevelUsed: 0 }), {
      outcome_status: 'correct_autonomous',
      error_tag: null,
      max_hint_level_used: 0,
    });
  });

  for (const level of [1, 2, 3]) {
    test(`correcta con pista nivel ${level} → achieved_with_support`, () => {
      assert.equal(
        classifyResponse({ selectedOption: correct, maxHintLevelUsed: level }).outcome_status,
        'achieved_with_support',
      );
    });
  }

  test('distractor → incorrect con su error_tag', () => {
    const result = classifyResponse({ selectedOption: distractor, maxHintLevelUsed: 2 });
    assert.equal(result.outcome_status, 'incorrect');
    assert.equal(result.error_tag, 'inverts_fraction');
  });

  test('sin opción → unanswered', () => {
    assert.equal(classifyResponse({ selectedOption: null }).outcome_status, 'unanswered');
  });

  test('rechaza niveles de pista fuera de 0–3', () => {
    for (const bad of [-1, 4, 1.5]) {
      assert.throws(
        () => classifyResponse({ selectedOption: correct, maxHintLevelUsed: bad }),
        (err) => err.code === 'INVALID_HINT_LEVEL',
      );
    }
  });

  test('rechaza un distractor sin error_tag', () => {
    assert.throws(
      () => classifyResponse({ selectedOption: { is_correct: 0, error_tag: null } }),
      (err) => err.code === 'DISTRACTOR_WITHOUT_ERROR_TAG',
    );
  });
});

describe('scoreSession', () => {
  test('separa el dominio autónomo de "Logrado con apoyo"', () => {
    const responses = [
      'correct_autonomous', 'correct_autonomous', 'correct_autonomous',
      'achieved_with_support', 'achieved_with_support',
      'incorrect', 'incorrect', 'unanswered',
    ].map((outcome_status) => ({ outcome_status }));

    assert.deepEqual(scoreSession(responses), {
      total: 8,
      correctAutonomous: 3,
      achievedWithSupport: 2,
      incorrect: 2,
      unanswered: 1,
      autonomousPercentage: 37.5,
      supportedPercentage: 25,
      sessionPercentage: 37.5,
    });
  });

  test('sin respuestas devuelve 0%', () => {
    assert.equal(scoreSession([]).sessionPercentage, 0);
  });

  test('rechaza estados desconocidos', () => {
    assert.throws(() => scoreSession([{ outcome_status: 'wrong' }]), (err) => err.code === 'INVALID_OUTCOME_STATUS');
  });
});

describe('summarizeErrorTags', () => {
  test('ordena los errores típicos por frecuencia', () => {
    const result = summarizeErrorTags([
      { error_tag: 'b' }, { error_tag: 'a' }, { error_tag: 'b' }, { error_tag: null }, {},
    ]);
    assert.deepEqual(result, [{ error_tag: 'b', count: 2 }, { error_tag: 'a', count: 1 }]);
  });
});

describe('bloqueo pantalla vs. papel', () => {
  test('asignar en papel bloquea la pantalla desde el inicio', () => {
    assert.deepEqual(initialTargetState('paper'), { status: 'pending', is_screen_locked: 1 });
    assert.deepEqual(initialTargetState('screen'), { status: 'pending', is_screen_locked: 0 });
  });

  test('capturar en papel deja completed_paper bloqueado', () => {
    assert.deepEqual(paperCapturedTargetState(), { status: 'completed_paper', is_screen_locked: 1 });
  });

  test('permite contestar en pantalla una prueba pendiente', () => {
    assert.doesNotThrow(() =>
      assertCanAnswerOnScreen({ modality: 'screen' }, { status: 'in_progress', is_screen_locked: 0 }),
    );
  });

  const lockedCases = [
    ['modalidad papel', { modality: 'paper' }, { status: 'pending', is_screen_locked: 1 }],
    ['pantalla bloqueada', { modality: 'screen' }, { status: 'pending', is_screen_locked: 1 }],
    ['ya capturada en papel', { modality: 'screen' }, { status: 'completed_paper', is_screen_locked: 1 }],
  ];
  for (const [name, assignment, target] of lockedCases) {
    test(`bloquea (${name}) con SCREEN_LOCKED`, () => {
      assert.throws(() => assertCanAnswerOnScreen(assignment, target), (err) => err.code === 'SCREEN_LOCKED');
    });
  }

  test('no deja repetir una prueba terminada en pantalla', () => {
    assert.throws(
      () => assertCanAnswerOnScreen({ modality: 'screen' }, { status: 'completed_screen', is_screen_locked: 0 }),
      (err) => err.code === 'ALREADY_COMPLETED',
    );
  });
});

describe('evaluateAchievements', () => {
  const codes = (r) => r.celebrations.map((c) => `${c.code}:${c.size}`);

  test('fin de bloque → small', () => {
    assert.deepEqual(codes(evaluateAchievements({ blockCompleted: true, currentPercentage: 40 })), ['block_completed:small']);
  });

  test('subir de nivel → medium + mejora → large', () => {
    const r = evaluateAchievements({ previousPercentage: 44, currentPercentage: 58 });
    assert.deepEqual(codes(r), ['level_up:medium', 'improved_vs_previous:large']);
    assert.equal(r.message, null);
  });

  test('mejora sin cambiar de nivel → large', () => {
    assert.deepEqual(codes(evaluateAchievements({ previousPercentage: 52, currentPercentage: 60 })), [
      'improved_vs_previous:large',
    ]);
  });

  test('alcanzar Dominado → large', () => {
    assert.deepEqual(codes(evaluateAchievements({ previousPercentage: 70, currentPercentage: 80 })), [
      'level_up:medium',
      'reached_mastered:large',
    ]);
    assert.deepEqual(codes(evaluateAchievements({ currentPercentage: 90 })), ['reached_mastered:large']);
  });

  test('sin subida → mensaje constructivo y sin celebración', () => {
    const r = evaluateAchievements({ previousPercentage: 60, currentPercentage: 55 });
    assert.deepEqual(r.celebrations, []);
    assert.match(r.message, /todavía se está formando/);
    for (const banned of ['reprobado', 'malo', 'deficiente', 'bajo']) {
      assert.ok(!r.message.toLowerCase().includes(banned));
    }
  });

  test('primera evaluación sin Dominado → sin mensaje', () => {
    assert.deepEqual(evaluateAchievements({ currentPercentage: 40 }), { celebrations: [], message: null });
  });
});

describe('canRecordMasteryCut', () => {
  test('requiere al menos 3 reactivos contestados (excluye unanswered)', () => {
    assert.equal(
      canRecordMasteryCut([
        { outcome_status: 'correct_autonomous' },
        { outcome_status: 'incorrect' },
        { outcome_status: 'unanswered' },
      ]),
      false,
    );
    assert.equal(
      canRecordMasteryCut([
        { outcome_status: 'correct_autonomous' },
        { outcome_status: 'achieved_with_support' },
        { outcome_status: 'incorrect' },
      ]),
      true,
    );
  });
});
