import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildNextMasteryCut,
  buildStudentSkills,
  computeWeightedMastery,
  countByMasteryLevel,
  countStudentsNeedingSupport,
  findWeakestSkill,
  getMasteryLevel,
  getMasteryLevelIndex,
  selectRecommendedActivity,
  parseAnalyticsSelection,
  selectAnalyticsStudents,
  summarizeGroupSkills,
  summarizeGroupEvidence,
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
  test('selección solo acepta escalares explícitos y apoyo en la habilidad elegida', () => {
    const skills = [{ code: 'fractions' }, { code: 'place_value' }];
    assert.deepEqual(parseAnalyticsSelection({}, skills), { skillCode: null, supportOnly: false });
    assert.deepEqual(parseAnalyticsSelection({ skillCode: 'fractions', supportOnly: 'true' }, skills), { skillCode: 'fractions', supportOnly: true });
    for (const bad of [null, [], { skillCode: '' }, { skillCode: ['fractions'] }, { supportOnly: true }, { supportOnly: ['true'] }, { supportOnly: 'yes' }, { extra: 1 }]) {
      assert.throws(() => parseAnalyticsSelection(bad, skills), (error) => error.code === 'VALIDATION_ERROR');
    }
    const students = [
      { id: 1, skills: [{ code: 'fractions', level: 'needs_support' }, { code: 'place_value', level: 'mastered' }] },
      { id: 2, skills: [{ code: 'fractions', level: null }, { code: 'place_value', level: 'needs_support' }] },
      { id: 3, skills: [{ code: 'fractions', level: 'mastered' }] },
    ];
    assert.deepEqual(selectAnalyticsStudents(students, { skillCode: null, supportOnly: true }).map((student) => student.id), [1, 2]);
    assert.deepEqual(selectAnalyticsStudents(students, { skillCode: 'fractions', supportOnly: true }).map((student) => student.id), [1]);
    assert.deepEqual(selectAnalyticsStudents(students, { skillCode: 'fractions', supportOnly: false }), students);
  });

  test('evidencia y distribución distinguen cero medido de ausencia y grupo vacío', () => {
    const skills = [{ code: 'fractions', name: 'Fracciones' }];
    const students = [
      { skills: [{ code: 'fractions', masteryPercentage: 0, level: 'needs_support', recordedAt: '2026-10-01' }] },
      { skills: [{ code: 'fractions', masteryPercentage: null, level: null, recordedAt: null }] },
    ];
    const summary = summarizeGroupSkills(skills, students)[0];
    assert.equal(summary.average, 0);
    assert.equal(summary.evidencePercentage, 50);
    assert.equal(summary.distribution.needs_support, 1);
    assert.equal(summary.distribution.not_evaluated, 1);
    assert.deepEqual(summarizeGroupEvidence(students), { evaluatedStudentCount: 1, notEvaluatedStudentCount: 1, latestRecordedAt: '2026-10-01' });
    const empty = summarizeGroupSkills(skills, [])[0];
    assert.equal(empty.average, null);
    assert.equal(empty.evidencePercentage, 0);
    assert.equal(Object.values(empty.distribution).reduce((sum, n) => sum + n, 0), 0);
    assert.deepEqual(summarizeGroupEvidence([]), { evaluatedStudentCount: 0, notEvaluatedStudentCount: 0, latestRecordedAt: null });
  });

  test('toma corte por índice, sin mutar historial ni confundir dominio con última sesión', () => {
    const skills = [{ id: 1, code: 'fractions', name: 'Fracciones' }, { id: 2, code: 'place_value', name: 'Valor posicional' }];
    const history = Object.freeze([
      Object.freeze({ skill_id: 1, session_index: 3, mastery_percentage: 66.67, autonomous_percentage: 80, supported_percentage: 20, recorded_at: '2026-11-01', grade: 4 }),
      Object.freeze({ skill_id: 1, session_index: 1, mastery_percentage: 40, autonomous_percentage: 40, supported_percentage: 60, recorded_at: '2026-09-01' }),
    ]);
    const result = buildStudentSkills(skills, history);
    assert.equal(result[0].masteryPercentage, 66.67);
    assert.equal(result[0].autonomousPercentage, 80);
    assert.equal(result[0].supportedPercentage, 20);
    assert.equal(result[0].grade, 4);
    assert.equal(result[1].masteryPercentage, null);
    assert.equal(result[1].label, 'Sin evaluar');
  });

  test('conserva el grado del último corte y lo desglosa para el grupo', () => {
    const skills = [{ id: 1, code: 'fractions', name: 'Fracciones' }];
    const students = [
      { skills: [{ code: 'fractions', masteryPercentage: 40, grade: 2, level: 'in_progress' }] },
      { skills: [{ code: 'fractions', masteryPercentage: 80, grade: 3, level: 'mastered' }] },
    ];
    assert.deepEqual(summarizeGroupSkills(skills, students)[0].gradeCounts, { 2: 1, 3: 1 });
  });

  test('cuenta alumnos únicos aunque necesiten apoyo en varias habilidades', () => {
    assert.equal(countStudentsNeedingSupport([
      { skills: [{ level: 'needs_support' }, { level: 'needs_support' }] },
      { skills: [{ level: 'mastered' }, { level: null }] },
      { skills: [{ level: 'needs_support' }] },
    ]), 2);
  });

  test('sugerencia prioriza error observado de la habilidad y ausencia no fabrica actividad', () => {
    const activities = [
      { id: 1, skill_code: 'fractions', title: 'General', target_error_tag: null },
      { id: 2, skill_code: 'fractions', title: 'Partes iguales', target_error_tag: 'partes_distintas' },
    ];
    assert.equal(selectRecommendedActivity(activities, 'fractions', [{ skillCode: 'fractions', errorTag: 'partes_distintas' }]).id, 2);
    assert.equal(selectRecommendedActivity(activities, 'fractions', []).id, 1);
    assert.equal(selectRecommendedActivity(activities, 'place_value', []), null);
    assert.equal(selectRecommendedActivity(activities, null, []), null);
  });

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
