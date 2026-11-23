import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assertValidCurriculumStatus,
  computeCoverage,
  phaseForGrade,
} from '../../src/modules/curriculum/curriculum.domain.js';
import {
  buildPaperCapture,
  buildPaperResponses,
  summarizeCaptureStatus,
} from '../../src/modules/paper-mode/paper-mode.domain.js';

describe('curriculum', () => {
  test('phaseForGrade: Fase 3 (1.º–2.º), 4 (3.º–4.º), 5 (5.º–6.º)', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(phaseForGrade), [3, 3, 4, 4, 5, 5]);
    assert.throws(() => phaseForGrade(7), RangeError);
  });

  test('solo acepta pending, in_progress y seen', () => {
    assert.doesNotThrow(() => assertValidCurriculumStatus('seen'));
    assert.throws(() => assertValidCurriculumStatus('visto'), (err) => err.code === 'INVALID_CURRICULUM_STATUS');
  });

  test('computeCoverage cuenta los contenidos sin registro como pendientes', () => {
    assert.deepEqual(computeCoverage(10, [{ status: 'seen' }, { status: 'seen' }, { status: 'seen' }, { status: 'in_progress' }]), {
      total: 10,
      pending: 6,
      in_progress: 1,
      seen: 3,
      coveragePercentage: 30,
    });
    assert.equal(computeCoverage(0, []).coveragePercentage, 0);
  });
});

describe('paper-mode', () => {
  const questions = [
    { id: 1, options: [{ id: 11, is_correct: 1 }, { id: 12, is_correct: 0, error_tag: 'inverts_fraction' }] },
    { id: 2, options: [{ id: 21, is_correct: 1 }, { id: 22, is_correct: 0, error_tag: 'counts_unshaded' }] },
    { id: 3, options: [{ id: 31, is_correct: 1 }, { id: 32, is_correct: 0, error_tag: 'adds_denominators' }] },
  ];

  test('clasifica la hoja sin pistas y registra los no contestados', () => {
    const responses = buildPaperResponses(questions, { 1: 11, 2: 22 });
    assert.deepEqual(
      responses.map((r) => [r.question_id, r.selected_option_id, r.outcome_status, r.error_tag, r.max_hint_level_used, r.source]),
      [
        [1, 11, 'correct_autonomous', null, 0, 'paper'],
        [2, 22, 'incorrect', 'counts_unshaded', 0, 'paper'],
        [3, null, 'unanswered', null, 0, 'paper'],
      ],
    );
  });

  test('rechaza reactivos u opciones ajenos a la prueba', () => {
    assert.throws(() => buildPaperResponses(questions, { 9: 11 }), (err) => err.code === 'UNKNOWN_QUESTION');
    assert.throws(() => buildPaperResponses(questions, { 1: 21 }), (err) => err.code === 'UNKNOWN_OPTION');
  });

  test('capturar una hoja bloquea la pantalla del alumno', () => {
    const capture = buildPaperCapture({ questions, answers: { 1: 11 } });
    assert.equal(capture.responses.length, 3);
    assert.deepEqual(capture.targetState, { status: 'completed_paper', is_screen_locked: 1 });
  });

  test('un alumno ausente no genera respuestas', () => {
    assert.deepEqual(buildPaperCapture({ questions, absent: true }), { responses: [], targetState: null });
  });

  test('summarizeCaptureStatus', () => {
    assert.deepEqual(
      summarizeCaptureStatus([{ status: 'completed_paper' }, { status: 'pending' }, { status: 'completed_paper' }]),
      { total: 3, captured: 2, pending: 1 },
    );
  });
});
