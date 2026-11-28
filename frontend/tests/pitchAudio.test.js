import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BEAT, buildSoundEvents, chordAt, midiToHz, moodAt } from '../src/features/pitch/pitch.audio.js';
import { PITCH_DURATION, PITCH_SCENES } from '../src/features/pitch/pitch.content.js';
import { sceneStart } from '../src/features/pitch/timeline.js';

const fakeTours = { map: { steps: [{ at: 1 }, { at: 5 }] } };

test('efectos ordenados, dentro de la duración y sincronizados con escenas y recorridos', () => {
  const events = buildSoundEvents(fakeTours);
  assert.deepEqual(events.map((e) => e.t), [...events.map((e) => e.t)].sort((a, b) => a - b));
  assert.ok(events.every((e) => e.t >= 0 && e.t < PITCH_DURATION));
  assert.equal(events.filter((e) => e.kind === 'whoosh').length, PITCH_SCENES.length - 1, 'una transición por cambio de escena');
  const mapStart = sceneStart(PITCH_SCENES, PITCH_SCENES.findIndex((s) => s.id === 'map'));
  assert.ok(events.some((e) => e.kind === 'click' && Math.abs(e.t - (mapStart + 2)) < 1e-9), 'clic cuando el cursor llega');
  const closing = sceneStart(PITCH_SCENES, PITCH_SCENES.length - 1);
  for (const kind of ['rise', 'confetti', 'impact']) assert.ok(events.some((e) => e.kind === kind && e.t >= closing), kind);
  assert.equal(events.filter((e) => e.kind === 'twinkle').length, 8);
  assert.equal(buildSoundEvents().filter((e) => e.kind === 'click').length, 0, 'sin recorridos no hay clics');
});

test('la música cambia de ánimo: problema en menor, solución en mayor, cierre triunfal', () => {
  const at = (id) => sceneStart(PITCH_SCENES, PITCH_SCENES.findIndex((s) => s.id === id)) + 0.1;
  assert.equal(moodAt(at('context')), 'minor');
  assert.equal(moodAt(at('map')), 'bright');
  assert.equal(moodAt(at('closing')), 'finale');
  assert.equal(chordAt(0).length, 4);
  assert.notDeepEqual(chordAt(0), chordAt(BEAT * 4), 'cambia de acorde cada compás');
  assert.equal(Math.round(midiToHz(69)), 440);
});
