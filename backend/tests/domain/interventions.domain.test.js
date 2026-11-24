import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseInterventionInput, summarizeInterventionOutcome, MAX_INTERVENTION_NOTE_LENGTH } from '../../src/modules/interventions/interventions.domain.js';
import { computeAutonomyTrend, summarizeAutonomyProgress, buildNextStep, AUTONOMY_TREND_THRESHOLD } from '../../src/modules/analytics/analytics.domain.js';

const cut = (session_index, autonomous_percentage, supported_percentage) => ({ session_index, autonomous_percentage, supported_percentage });

describe('parseInterventionInput', () => {
  test('acepta actividad y nota recortada; nota vacía es null', () => {
    assert.deepEqual(parseInterventionInput({ activityId: 4, note: '  Funcionó en parejas ' }), { activityId: 4, note: 'Funcionó en parejas' });
    assert.deepEqual(parseInterventionInput({ activityId: 4, note: '   ' }), { activityId: 4, note: null });
    assert.deepEqual(parseInterventionInput({ activityId: 4 }), { activityId: 4, note: null });
  });
  test('rechaza cuerpos inválidos, ids no enteros, claves extra y notas largas', () => {
    for (const body of [null, [], 'x', {}, { activityId: '4' }, { activityId: 0 }, { activityId: 1.5 },
      { activityId: 1, studentId: 2 }, { activityId: 1, note: 5 }, { activityId: 1, note: 'a'.repeat(MAX_INTERVENTION_NOTE_LENGTH + 1) }]) {
      assert.throws(() => parseInterventionInput(body), { code: 'VALIDATION_ERROR' });
    }
  });
});

describe('summarizeInterventionOutcome', () => {
  test('sin reevaluación queda en espera', () => {
    assert.deepEqual(summarizeInterventionOutcome({ baselineIds: [1, 2, 3], reevaluatedIds: [], stillWithErrorIds: [] }),
      { status: 'awaiting_retest', baselineCount: 3, reevaluatedCount: 0, overcameCount: 0, stillWithErrorCount: 0, awaitingCount: 3 });
  });
  test('compara a los mismos alumnos e ignora a quienes no tenían el error', () => {
    const outcome = summarizeInterventionOutcome({ baselineIds: [1, 2, 3, 4], reevaluatedIds: [1, 2, 3, 9, 1], stillWithErrorIds: [2, 9] });
    assert.deepEqual(outcome, { status: 'measured', baselineCount: 4, reevaluatedCount: 3, overcameCount: 2, stillWithErrorCount: 1, awaitingCount: 1 });
  });
});

describe('computeAutonomyTrend', () => {
  test('necesita al menos dos sesiones', () => {
    assert.equal(computeAutonomyTrend([]), null);
    assert.equal(computeAutonomyTrend([cut(1, 40, 20)]), null);
  });
  test('usa las dos sesiones más recientes sin importar el orden', () => {
    const trend = computeAutonomyTrend([cut(3, 70, 10), cut(1, 10, 0), cut(2, 40, 30)]);
    assert.equal(trend.trend, 'toward_autonomy');
    assert.equal(trend.delta, 30);
    assert.equal(trend.fromSupport, true);
  });
  test('umbral exacto en ambos sentidos', () => {
    assert.equal(computeAutonomyTrend([cut(1, 40, 0), cut(2, 40 + AUTONOMY_TREND_THRESHOLD, 0)]).trend, 'toward_autonomy');
    assert.equal(computeAutonomyTrend([cut(1, 40, 0), cut(2, 49.99, 0)]).trend, 'steady');
    assert.equal(computeAutonomyTrend([cut(1, 40, 0), cut(2, 30, 0)]).trend, 'more_support');
  });
  test('fromSupport exige menos apoyo y más autonomía', () => {
    assert.equal(computeAutonomyTrend([cut(1, 20, 0), cut(2, 60, 0)]).fromSupport, false);
    assert.equal(computeAutonomyTrend([cut(1, 20, 30), cut(2, 60, 30)]).fromSupport, false);
    assert.equal(computeAutonomyTrend([cut(1, 20, 30), cut(2, 25, 0)]).fromSupport, false);
  });
});

describe('summarizeAutonomyProgress', () => {
  const skills = [{ code: 'fractions', name: 'Fracciones' }, { code: 'place_value', name: 'Valor posicional' }];
  const student = (fractions, place) => ({ skills: [
    { code: 'fractions', autonomyTrend: fractions }, { code: 'place_value', autonomyTrend: place }] });
  test('cuenta alumnos únicos y no clasifica a quien tiene una sola sesión', () => {
    const up = computeAutonomyTrend([cut(1, 20, 40), cut(2, 60, 10)]);
    const steady = computeAutonomyTrend([cut(1, 50, 0), cut(2, 52, 0)]);
    const down = computeAutonomyTrend([cut(1, 60, 0), cut(2, 20, 0)]);
    const summary = summarizeAutonomyProgress(skills, [student(up, up), student(steady, down), student(null, null)]);
    assert.equal(summary.comparedStudentCount, 2);
    assert.equal(summary.towardAutonomyStudentCount, 1);
    assert.equal(summary.fromSupportStudentCount, 1);
    assert.deepEqual(summary.skills[0], { code: 'fractions', name: 'Fracciones', comparedCount: 2,
      towardAutonomyCount: 1, steadyCount: 1, moreSupportCount: 0, fromSupportCount: 1 });
    assert.equal(summary.highlight.studentCount, 1);
  });
  test('sin historial no hay destacado', () => {
    assert.equal(summarizeAutonomyProgress(skills, [student(null, null)]).highlight, null);
  });
});

describe('buildNextStep', () => {
  const weakest = { code: 'fractions', name: 'Fracciones', average: 30, label: 'En proceso' };
  test('elige el error de la habilidad con más alumnos distintos', () => {
    const errors = [
      { skillCode: 'place_value', errorTag: 'x', explanation: 'Otro', studentCount: 40 },
      { skillCode: 'fractions', errorTag: 'a', explanation: 'A', studentCount: 3 },
      { skillCode: 'fractions', errorTag: 'b', explanation: 'B', studentCount: 9 },
    ];
    const step = buildNextStep(weakest, errors, { id: 1, title: 'Actividad' });
    assert.deepEqual(step.error, { errorTag: 'b', explanation: 'B', studentCount: 9 });
    assert.equal(step.activity.id, 1);
  });
  test('sin habilidad evaluada no hay plan; sin errores el plan no inventa uno', () => {
    assert.equal(buildNextStep(null, [], null), null);
    assert.equal(buildNextStep(weakest, [], null).error, null);
  });
});
