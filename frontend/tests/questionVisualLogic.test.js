import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { chocolateGrid, circleSlices, describeVisual, toVisual } from '../src/shared/components/questionVisual.logic.js';

describe('gráfico del reactivo (vista)', () => {
  test('acepta los gráficos del servidor y descarta datos inesperados', () => {
    assert.deepEqual(toVisual({ type: 'fraction_bar', parts: 8, shaded: 3 }), { type: 'fraction_bar', theme: 'plain', parts: 8, shaded: 3 });
    assert.deepEqual(toVisual({ type: 'fraction_circle', theme: 'pizza', parts: 4, shaded: 1 }), { type: 'fraction_circle', theme: 'pizza', parts: 4, shaded: 1 });
    for (const bad of [null, undefined, {}, { type: 'pie' }, { type: 'fraction_bar', parts: 1, shaded: 0 }, { type: 'fraction_bar', parts: 4, shaded: 9 },
      { type: 'fraction_circle', parts: 4, shaded: 1 }, { type: 'fraction_bar', theme: 'pastel', parts: 4, shaded: 1 },
      { type: 'constructor', parts: 4, shaded: 1 }, { type: 'toString', theme: 'plain', parts: 4, shaded: 1 }]) {
      assert.equal(toVisual(bad), null, JSON.stringify(bad));
    }
  });

  test('describe el dibujo igual que el servidor', () => {
    assert.equal(describeVisual({ type: 'fraction_bar', parts: 4, shaded: 1 }), 'Dibujo: un entero dividido en 4 partes iguales, con 1 parte pintada.');
    assert.equal(describeVisual({ type: 'fraction_bar', parts: 8, shaded: 3 }), 'Dibujo: un entero dividido en 8 partes iguales, con 3 partes pintadas.');
    assert.equal(describeVisual({ type: 'fraction_circle', theme: 'pizza', parts: 8, shaded: 3 }), 'Dibujo: una pizza partida en 8 rebanadas iguales; 3 tienen champiñones.');
    assert.equal(describeVisual({ type: 'fraction_circle', theme: 'pastel', parts: 4, shaded: 1 }), 'Dibujo: un pastel partido en 4 rebanadas iguales; 1 tiene fresas.');
    assert.equal(describeVisual({ type: 'fraction_bar', theme: 'chocolate', parts: 8, shaded: 1 }), 'Dibujo: una barra de chocolate de 8 cuadritos iguales; se comió 1.');
    assert.equal(describeVisual(null), null);
  });

  test('rebanadas: empiezan arriba, una por parte, y el ingrediente queda dentro de su rebanada', () => {
    const slices = circleSlices(4);
    assert.equal(slices.length, 4);
    assert.deepEqual(slices[0].edge, [100, 10]);
    assert.deepEqual(slices[1].edge, [190, 100]);
    const [x, y] = slices[0].topping;
    assert.ok(x > 100 && y < 100, 'la primera rebanada (de las 12 a las 3) lleva el ingrediente arriba a la derecha');
    assert.equal(slices[0].path, 'M 100 100 L 100 10 A 90 90 0 0 1 190 100 Z');
  });

  test('chocolate: 8 cuadritos en 4 × 2 y 4 en una fila', () => {
    assert.deepEqual(chocolateGrid(8), { columns: 4, rows: 2 });
    assert.deepEqual(chocolateGrid(4), { columns: 4, rows: 1 });
  });
});
