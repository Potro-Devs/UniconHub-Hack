import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatGameNumber, isAnswerReady } from '../src/features/learning-games/games.logic.js';

describe('juegos: lógica de la vista', () => {
  test('formatGameNumber muestra enteros y decimales sin ceros sobrantes', () => {
    assert.equal(formatGameNumber(100), '100');
    assert.equal(formatGameNumber(0.25), '0.25');
    assert.equal(formatGameNumber(2.5), '2.5');
    assert.equal(formatGameNumber(1.2), '1.2');
  });

  test('Comprobar se activa solo con la respuesta completa', () => {
    assert.equal(isAnswerReady('grammar_fix', { wordIndex: null, optionIndex: null }), false);
    assert.equal(isAnswerReady('grammar_fix', { wordIndex: 2, optionIndex: null }), false);
    assert.equal(isAnswerReady('grammar_fix', { wordIndex: 0, optionIndex: 0 }), true);
    assert.equal(isAnswerReady('mental_math', [1]), false);
    assert.equal(isAnswerReady('mental_math', [1, 3]), true);
    // Los demás juegos se pueden comprobar en cualquier momento (también "sin pintar nada").
    assert.equal(isAnswerReady('symmetry', [[false]]), true);
    assert.equal(isAnswerReady('fractions', 0), true);
  });
});
