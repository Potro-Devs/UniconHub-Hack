import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildPaperResponses, parsePaperCaptureInput } from '../../src/modules/paper-mode/paper-mode.domain.js';
import { createPaperModeService } from '../../src/modules/paper-mode/paper-mode.service.js';

const rejects = (body) =>
  assert.throws(() => parsePaperCaptureInput(body), (err) => err.code === 'VALIDATION_ERROR', JSON.stringify(body));

describe('parsePaperCaptureInput', () => {
  test('acepta claves enteras canónicas y opciones enteras o null', () => {
    assert.deepEqual(parsePaperCaptureInput({ answers: { 12: 5, 7: null } }), { answers: { 12: 5, 7: null }, hintLevels: {}, supportUsed: false, absent: false });
    assert.deepEqual(
      parsePaperCaptureInput({ answers: { 12: 5 }, hintLevels: { 12: 3, 7: 0 } }),
      { answers: { 12: 5 }, hintLevels: { 12: 3, 7: 0 }, supportUsed: false, absent: false },
    );
  });

  test('rechaza claves no canónicas que podrían pisar a otra ("01" vs "1")', () => {
    for (const key of ['01', '1.0', ' 1 ', '1e2', '+1', '0', '-1', '0x1', '']) rejects({ answers: { [key]: 1 } });
  });

  test('rechaza ids fuera del rango seguro de enteros', () => {
    rejects({ answers: { 1: 2 ** 53 } });
    rejects({ answers: { [String(2 ** 53)]: 1 } });
  });

  test('absent: true no exige respuestas', () => {
    assert.deepEqual(parsePaperCaptureInput({ absent: true }), { answers: {}, hintLevels: {}, supportUsed: false, absent: true });
  });
});

describe('casilla general "Usó tarjetas" (supportUsed)', () => {
  // Reactivo 1: opción 11 correcta, 12 distractor. Reactivo 2: 21 correcta. Reactivo 3: 31 correcta.
  const questions = [
    { id: 1, options: [{ id: 11, is_correct: 1, error_tag: null }, { id: 12, is_correct: 0, error_tag: 'e' }] },
    { id: 2, options: [{ id: 21, is_correct: 1, error_tag: null }] },
    { id: 3, options: [{ id: 31, is_correct: 1, error_tag: null }] },
  ];
  const outcome = (rs) => rs.map((r) => [r.question_id, r.outcome_status, r.max_hint_level_used]);

  test('valida que sea sí o no', () => {
    rejects({ answers: {}, supportUsed: 'sí' });
    assert.equal(parsePaperCaptureInput({ answers: {}, supportUsed: true }).supportUsed, true);
  });

  test('con la casilla marcada, todo acierto es "Logrado con apoyo"; lo no contestado no recibe nivel', () => {
    assert.deepEqual(outcome(buildPaperResponses(questions, { 1: 11, 2: 21 }, {}, true)), [
      [1, 'achieved_with_support', 1],
      [2, 'achieved_with_support', 1],
      [3, 'unanswered', 0],
    ]);
  });

  test('un nivel explícito por reactivo (incluido 0) tiene prioridad sobre la casilla general', () => {
    assert.deepEqual(outcome(buildPaperResponses(questions, { 1: 11, 2: 21, 3: 31 }, { 1: 0, 2: 3 }, true)), [
      [1, 'correct_autonomous', 0],
      [2, 'achieved_with_support', 3],
      [3, 'achieved_with_support', 1],
    ]);
  });

  test('sin la casilla, los aciertos son autónomos', () => {
    assert.deepEqual(outcome(buildPaperResponses(questions, { 1: 12, 2: 21 })), [
      [1, 'incorrect', 0],
      [2, 'correct_autonomous', 0],
      [3, 'unanswered', 0],
    ]);
  });
});

describe('captureStudent (servicio, sin HTTP)', () => {
  const forbidden = () => {
    throw new Error('no debe consultarse');
  };
  /** Repositorios mínimos: asignación en papel activa, grupo del docente 1 y alumno pendiente. */
  const makeService = (overrides = {}) =>
    createPaperModeService({
      repository: { findTarget: () => ({ id: 10, status: 'pending' }), listOptionsOfAssignment: forbidden, markTargetCaptured: forbidden },
      assessmentsRepository: { findAssignmentById: () => ({ id: 1, group_id: 2, modality: 'paper', status: 'active' }) },
      diagnosticsRepository: { listQuestionsOfAssignment: forbidden, insertResponse: forbidden },
      groupsRepository: { findGroupOfTeacher: () => ({ id: 2, grade: 3, section: 'A' }), findGroupOfSchool: () => ({ id: 2, grade: 3 }) },
      transaction: forbidden,
      ...overrides,
    });
  const teacher = { role: 'teacher', sub: '1', schoolId: 1 };

  test('alumno que faltó: responde sin leer reactivos ni opciones', () => {
    const result = makeService().captureStudent(teacher, '1', '5', { absent: true });
    assert.deepEqual(result, { assignmentId: 1, studentId: 5, captured: false, status: 'pending' });
  });

  test('director o alumno → 403 aunque se llame al servicio sin la ruta', () => {
    for (const role of ['director', 'student']) {
      assert.throws(
        () => makeService().captureStudent({ role, sub: '1', schoolId: 1, groupId: 2 }, '1', '5', { absent: true }),
        (err) => err.status === 403 && err.code === 'FORBIDDEN',
        role,
      );
    }
  });
});
