import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildNextMasteryCut,
  computeWeightedMastery,
  countByMasteryLevel,
  findWeakestSkill,
  getMasteryLevel,
  getMasteryLevelIndex,
} from '../../src/modules/analytics/analytics.domain.js';

describe('getMasteryLevel · escala de 25%', () => {
  const cases = [
    [0, 'needs_support', 'Necesita apoyo'],
    [24.99, 'needs_support', 'Necesita apoyo'],
    [25, 'in_progress', 'En proceso'],
    [49.99, 'in_progress', 'En proceso'],
    [50, 'achieved', 'Logrado'],
    [74.99, 'achieved', 'Logrado'],
    [75, 'mastered', 'Dominado'],
    [100, 'mastered', 'Dominado'],
  ];
  for (const [pct, code, label] of cases) {
    test(`${pct}% → ${code}`, () => {
      assert.equal(getMasteryLevel(pct).code, code);
      assert.equal(getMasteryLevel(pct).label, label);
    });
  }

  test('evalúa sobre el valor redondeado a 2 decimales', () => {
    assert.equal(getMasteryLevel(24.994).code, 'needs_support');
    assert.equal(getMasteryLevel(24.996).code, 'in_progress');
  });

  test('rechaza valores fuera de 0–100', () => {
    for (const bad of [-1, 100.01, NaN, Infinity, '50', null]) {
      assert.throws(() => getMasteryLevel(bad), RangeError);
    }
  });

  test('ninguna etiqueta usa términos punitivos', () => {
    const labels = [0, 25, 50, 75].map((p) => getMasteryLevel(p).label.toLowerCase());
    for (const banned of ['reprobado', 'malo', 'deficiente', 'bajo']) {
      assert.ok(labels.every((l) => !l.includes(banned)), `etiqueta con "${banned}"`);
    }
  });

  test('getMasteryLevelIndex devuelve 0–3', () => {
    assert.deepEqual([10, 30, 60, 90].map(getMasteryLevelIndex), [0, 1, 2, 3]);
  });
});

describe('computeWeightedMastery · w_i = i', () => {
  test('sin sesiones devuelve null', () => {
    assert.equal(computeWeightedMastery([]), null);
  });

  test('una sesión es su propio porcentaje', () => {
    assert.equal(computeWeightedMastery([62.5]), 62.5);
  });

  test('pondera más las sesiones recientes', () => {
    // (1·40 + 2·60 + 3·80) / 6 = 400 / 6 = 66.67
    assert.equal(computeWeightedMastery([40, 60, 80]), 66.67);
    // (1·80 + 2·60 + 3·40) / 6 = 320 / 6 = 53.33
    assert.equal(computeWeightedMastery([80, 60, 40]), 53.33);
  });

  test('rechaza porcentajes inválidos', () => {
    assert.throws(() => computeWeightedMastery([50, 120]), RangeError);
  });
});

describe('buildNextMasteryCut', () => {
  test('primer corte usa session_index 1', () => {
    const cut = buildNextMasteryCut([], { sessionPercentage: 30, autonomousPercentage: 30, supportedPercentage: 20 });
    assert.deepEqual(cut, {
      session_index: 1,
      session_percentage: 30,
      autonomous_percentage: 30,
      supported_percentage: 20,
      mastery_percentage: 30,
      mastery_level: 'in_progress',
    });
  });

  test('ordena los cortes previos y continúa el índice', () => {
    const previous = [
      { session_index: 2, session_percentage: 60 },
      { session_index: 1, session_percentage: 40 },
    ];
    const cut = buildNextMasteryCut(previous, { sessionPercentage: 80, autonomousPercentage: 80, supportedPercentage: 10 });
    assert.equal(cut.session_index, 3);
    assert.equal(cut.mastery_percentage, 66.67);
    assert.equal(cut.mastery_level, 'achieved');
  });
});

describe('agregados del mapa del grupo', () => {
  test('findWeakestSkill ignora habilidades sin datos', () => {
    const weakest = findWeakestSkill([
      { skill: 'fractions', average: null },
      { skill: 'multiplication', average: 52 },
      { skill: 'place_value', average: 63 },
    ]);
    assert.deepEqual(weakest, { skill: 'multiplication', average: 52 });
    assert.equal(findWeakestSkill([{ skill: 'fractions', average: null }]), null);
  });

  test('countByMasteryLevel cuenta por nivel y sin evaluar', () => {
    assert.deepEqual(countByMasteryLevel([10, 24.99, 25, 60, 75, null]), {
      needs_support: 2,
      in_progress: 1,
      achieved: 1,
      mastered: 1,
      not_evaluated: 1,
    });
  });
});
