import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PITCH_SCENES } from '../src/features/pitch/pitch.content.js';

// pitch.tours.js importa imágenes (Vite); aquí se valida su contenido como texto.
const source = readFileSync(new URL('../src/features/pitch/pitch.tours.js', import.meta.url), 'utf8');
const normalizeLines = (text) => text.replace(/\r\n/g, '\n');
const lineEndings = [['LF', normalizeLines(source)], ['CRLF', normalizeLines(source).replace(/\n/g, '\r\n')]];

function validateSteps(raw) {
  const text = normalizeLines(raw);
  const blocks = text.split(/\n  (?=\w+: \{\n)/).slice(1);
  assert.ok(blocks.length >= 6, 'se validan al menos seis recorridos');
  for (const block of blocks) {
    const id = block.match(/^(\w+):/)[1];
    const scene = PITCH_SCENES.find((candidate) => candidate.id === id);
    assert.ok(scene, `escena ${id}`);
    const times = [...block.matchAll(/at: ([\d.]+)/g)].map((m) => Number(m[1]));
    assert.ok(times.length > 0, `${id}: contiene pasos`);
    assert.deepEqual(times, [...times].sort((a, b) => a - b), `${id}: pasos en orden`);
    assert.ok(times.at(-1) + 2 <= scene.seconds, `${id}: el último paso alcanza a verse`);
  }
}

for (const [ending, raw] of lineEndings) {
  test(`${ending}: cada recorrido apunta a capturas que existen y a escenas del guion`, () => {
    const text = normalizeLines(raw);
    const images = [...text.matchAll(/from '\.\/assets\/screens\/([\w-]+\.jpg)'/g)].map((m) => m[1]);
    assert.ok(images.length >= 6);
    for (const image of images) assert.ok(existsSync(new URL(`../src/features/pitch/assets/screens/${image}`, import.meta.url)), image);
    const tourIds = [...text.matchAll(/^  (\w+): \{$/gm)].map((m) => m[1]);
    assert.ok(tourIds.length >= 6, 'se reconocen al menos seis escenas');
    for (const id of tourIds) assert.ok(PITCH_SCENES.some((scene) => scene.id === id), `escena ${id}`);
  });

  test(`${ending}: zonas dentro de la imagen y pasos dentro de la duración de su escena`, () => {
    const text = normalizeLines(raw);
    const rects = [...text.matchAll(/rect: \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+) \}/g)].map((m) => m.slice(1).map(Number));
    assert.ok(rects.length >= 20);
    for (const [x, y, w, h] of rects) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0, 'positivos');
      assert.ok(x + w <= 1.001 && y + h <= 1.001, `dentro de la imagen: ${[x, y, w, h]}`);
    }
    validateSteps(raw);
  });
}

test('el análisis no acepta recorridos vacíos ni pasos fuera de orden o duración en LF y CRLF', () => {
  assert.throws(() => validateSteps('export const TOURS = {};'), /al menos seis recorridos/);
  for (const [, raw] of lineEndings) {
    assert.throws(() => validateSteps(raw.replace('at: 1.4', 'at: 999')), /pasos en orden/);
    assert.throws(() => validateSteps(raw.replace('at: 14.4', 'at: 999')), /último paso alcanza a verse/);
  }
});
