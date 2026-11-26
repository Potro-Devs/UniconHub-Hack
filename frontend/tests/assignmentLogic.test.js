import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assignmentState, nextUnanswered, splitStem } from '../src/features/student-portal/assignmentLogic.js';

describe('ejercicio del alumno (lógica pura)', () => {
  test('estado visible de cada prueba', () => {
    assert.equal(assignmentState({ status: 'pending', modality: 'screen', isScreenLocked: false, assignmentStatus: 'active' }), 'ready');
    assert.equal(assignmentState({ status: 'in_progress', modality: 'screen', isScreenLocked: false, assignmentStatus: 'active' }), 'ready');
    assert.equal(assignmentState({ status: 'completed_screen', modality: 'screen', assignmentStatus: 'closed' }), 'completed');
    assert.equal(assignmentState({ status: 'pending', modality: 'paper', isScreenLocked: true, assignmentStatus: 'active' }), 'paper');
    assert.equal(assignmentState({ status: 'completed_paper', modality: 'paper', isScreenLocked: true }), 'paper');
    assert.equal(assignmentState({ status: 'pending', modality: 'screen', isScreenLocked: false, assignmentStatus: 'closed' }), 'closed');
  });

  test('siguiente pregunta sin contestar, dando la vuelta', () => {
    const qs = [{ answered: true }, { answered: false }, { answered: true }, { answered: false }];
    assert.equal(nextUnanswered(qs), 1);
    assert.equal(nextUnanswered(qs, 2), 3);
    assert.equal(nextUnanswered(qs, 4), 1);
    assert.equal(nextUnanswered([{ answered: true }]), -1);
    assert.equal(nextUnanswered([]), -1);
  });

  test('separa texto y pregunta en reactivos de lectura', () => {
    assert.deepEqual(splitStem('Los ajolotes\n\nViven en Xochimilco.\n\n¿Dónde viven?'),
      { passage: ['Los ajolotes', 'Viven en Xochimilco.'], prompt: '¿Dónde viven?' });
    assert.deepEqual(splitStem('¿Cuánto es 3 × 4?'), { passage: null, prompt: '¿Cuánto es 3 × 4?' });
  });
});
