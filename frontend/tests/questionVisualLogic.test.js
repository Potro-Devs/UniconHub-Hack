import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { describeVisual, toFractionBar } from '../src/shared/components/questionVisual.logic.js';

describe('gráfico del reactivo (vista)', () => {
  test('acepta la barra del servidor y descarta datos inesperados', () => {
    assert.deepEqual(toFractionBar({ type: 'fraction_bar', parts: 8, shaded: 3 }), { parts: 8, shaded: 3 });
    for (const bad of [null, undefined, {}, { type: 'pie' }, { type: 'fraction_bar', parts: 1, shaded: 0 }, { type: 'fraction_bar', parts: 4, shaded: 9 }]) {
      assert.equal(toFractionBar(bad), null, JSON.stringify(bad));
    }
  });

  test('describe el dibujo igual que el servidor', () => {
    assert.equal(describeVisual({ type: 'fraction_bar', parts: 4, shaded: 1 }), 'Dibujo: un entero dividido en 4 partes iguales, con 1 parte pintada.');
    assert.equal(describeVisual({ type: 'fraction_bar', parts: 8, shaded: 3 }), 'Dibujo: un entero dividido en 8 partes iguales, con 3 partes pintadas.');
    assert.equal(describeVisual(null), null);
  });
});
