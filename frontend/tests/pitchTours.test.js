import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PITCH_SCENES } from '../src/features/pitch/pitch.content.js';

// pitch.tours.js importa imágenes (Vite); aquí se valida su contenido como texto.
const source = readFileSync(new URL('../src/features/pitch/pitch.tours.js', import.meta.url), 'utf8');

test('cada recorrido apunta a capturas que existen y a escenas del guion', () => {
  const images = [...source.matchAll(/from '\.\/assets\/screens\/([\w-]+\.jpg)'/g)].map((m) => m[1]);
  assert.ok(images.length >= 6);
  for (const image of images) assert.ok(existsSync(new URL(`../src/features/pitch/assets/screens/${image}`, import.meta.url)), image);
  const tourIds = [...source.matchAll(/^  (\w+): \{$/gm)].map((m) => m[1]);
  for (const id of tourIds) assert.ok(PITCH_SCENES.some((scene) => scene.id === id), `escena ${id}`);
});

test('zonas dentro de la imagen y pasos dentro de la duración de su escena', () => {
  const rects = [...source.matchAll(/rect: \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+) \}/g)].map((m) => m.slice(1).map(Number));
  assert.ok(rects.length >= 20);
  for (const [x, y, w, h] of rects) {
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0, 'positivos');
    assert.ok(x + w <= 1.001 && y + h <= 1.001, `dentro de la imagen: ${[x, y, w, h]}`);
  }
  const blocks = source.split(/\n  (?=\w+: \{\n)/).slice(1);
  for (const block of blocks) {
    const id = block.match(/^(\w+):/)[1];
    const seconds = PITCH_SCENES.find((scene) => scene.id === id).seconds;
    const times = [...block.matchAll(/at: ([\d.]+)/g)].map((m) => Number(m[1]));
    assert.deepEqual(times, [...times].sort((a, b) => a - b), `${id}: pasos en orden`);
    assert.ok(times.at(-1) + 2 <= seconds, `${id}: el último paso alcanza a verse`);
  }
});
