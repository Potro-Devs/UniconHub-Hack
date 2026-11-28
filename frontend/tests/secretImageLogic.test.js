import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  addPick,
  emojiFor,
  instructionFor,
  isComplete,
  removeLastPick,
  samePicks,
  SECRET_ALREADY_SAVED_MESSAGE,
  afterSecretError,
} from '../src/features/student-portal/secretImage.logic.js';

describe('imagen secreta: selección', () => {
  test('agrega hasta completar y no se pasa', () => {
    let picks = [];
    picks = addPick(picks, 'cat', 2);
    picks = addPick(picks, 'sun', 2);
    picks = addPick(picks, 'dog', 2);
    assert.deepEqual(picks, ['cat', 'sun']);
    assert.equal(isComplete(picks, 2), true);
    assert.deepEqual(removeLastPick(picks), ['cat']);
  });

  test('confirmar exige el mismo orden', () => {
    assert.equal(samePicks(['cat', 'sun'], ['cat', 'sun']), true);
    assert.equal(samePicks(['cat', 'sun'], ['sun', 'cat']), false);
    assert.equal(samePicks(['cat'], ['cat', 'sun']), false);
  });

  test('cada imagen del catálogo tiene dibujo; una desconocida no rompe', () => {
    for (const code of ['turtle', 'cat', 'dog', 'fish', 'butterfly', 'sun', 'star', 'flower', 'tree']) assert.notEqual(emojiFor(code), '❓', code);
    assert.equal(emojiFor('lion'), '❓');
  });

  test('instrucciones claras según paso, fase y avance', () => {
    assert.equal(instructionFor({ step: 'verify', phase: 'pick', count: 1, picks: [] }), 'Toca tu imagen secreta.');
    assert.equal(instructionFor({ step: 'verify', phase: 'pick', count: 2, picks: ['cat'] }), 'Toca tus 2 imágenes secretas, en orden (2 de 2).');
    assert.match(instructionFor({ step: 'setup', phase: 'pick', count: 1, picks: [] }), /Elige tu imagen secreta/);
    assert.equal(instructionFor({ step: 'setup', phase: 'confirm', count: 2, picks: [] }), 'Tócala otra vez para confirmar (1 de 2).');
  });
});

describe('imagen secreta: cambios de estado del servidor', () => {
  test('ya guardada en otro dispositivo → tocarla; ventana cerrada → pedir ayuda; otros errores → igual', () => {
    const saved = { step: 'verify', message: SECRET_ALREADY_SAVED_MESSAGE };
    assert.deepEqual(afterSecretError('SECRET_ALREADY_SET', 'setup'), saved);
    // Si ya hay una guardada, el servidor responde "no coincide": configurando, significa lo mismo.
    assert.deepEqual(afterSecretError('SECRET_MISMATCH', 'setup'), saved);
    assert.deepEqual(afterSecretError('SECRET_SETUP_CLOSED', 'setup'), { step: 'ask_teacher', message: null });
    assert.deepEqual(afterSecretError('SECRET_MISMATCH', 'verify'), { step: 'verify', message: null });
    assert.deepEqual(afterSecretError(undefined, 'setup'), { step: 'setup', message: null });
  });
});
