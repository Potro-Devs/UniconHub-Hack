import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PITCH_DURATION, PITCH_EXTRA_SOURCES, PITCH_SCENES, PITCH_SOURCE, TEAM_MEMBERS, TEAM_NAME } from '../src/features/pitch/pitch.content.js';
import { clampTime, formatPitchTime, getSceneAt, sceneStart } from '../src/features/pitch/timeline.js';

test('pitch tiene once escenas contiguas que completan 168 segundos (menos de 3 minutos)', () => {
  assert.equal(PITCH_SCENES.length, 11);
  assert.equal(new Set(PITCH_SCENES.map((scene) => scene.id)).size, 11);
  assert.equal(PITCH_DURATION, 168);
  assert.ok(PITCH_DURATION < 180);
  assert.deepEqual(PITCH_SCENES.map((_, index) => sceneStart(PITCH_SCENES, index)), [0, 12, 24, 38, 58, 74, 90, 108, 128, 142, 156]);
  assert.ok(PITCH_SCENES.every((scene) => typeof scene.chapter === 'string' && scene.chapter.trim()));
  for (const scene of PITCH_SCENES) {
    assert.ok(Number.isFinite(scene.seconds) && scene.seconds > 0);
    assert.ok(scene.title.trim() && scene.narration.trim());
  }
  assert.equal(sceneStart(PITCH_SCENES, PITCH_SCENES.length), PITCH_DURATION);
});

test('cada borde cambia a la escena siguiente y el final conserva la última completa', () => {
  for (let index = 0; index < PITCH_SCENES.length; index += 1) {
    const start = sceneStart(PITCH_SCENES, index);
    const selected = getSceneAt(PITCH_SCENES, start);
    assert.equal(selected.index, index);
    assert.equal(selected.scene, PITCH_SCENES[index]);
    assert.equal(selected.start, start);
    assert.equal(selected.elapsed, 0);
    if (index > 0) {
      const before = getSceneAt(PITCH_SCENES, start - 0.001);
      assert.equal(before.index, index - 1);
      assert.ok(before.elapsed > before.scene.seconds - 0.002);
    }
  }
  const final = getSceneAt(PITCH_SCENES, PITCH_DURATION);
  assert.equal(final.index, PITCH_SCENES.length - 1);
  assert.equal(final.elapsed, PITCH_SCENES.at(-1).seconds);
  assert.equal(getSceneAt([], 0), null);
});

test('seek limita valores y evita NaN; posición local y global se mantienen coherentes', () => {
  assert.equal(clampTime(-10, PITCH_DURATION), 0);
  assert.equal(clampTime(1000, PITCH_DURATION), PITCH_DURATION);
  assert.equal(clampTime(NaN, PITCH_DURATION), 0);
  assert.equal(clampTime('texto', PITCH_DURATION), 0);
  assert.equal(clampTime('37.5', PITCH_DURATION), 37.5);
  for (const candidate of [-1, 0, 7.5, 12, 37.5, 56, 73.99, 106, 156, 167.5, 168, 200]) {
    const position = clampTime(candidate, PITCH_DURATION);
    const current = getSceneAt(PITCH_SCENES, position);
    assert.equal(current.start + current.elapsed, position);
    assert.ok(current.elapsed >= 0 && current.elapsed <= current.scene.seconds);
    assert.ok(position / PITCH_DURATION >= 0 && position / PITCH_DURATION <= 1);
  }
  assert.equal(getSceneAt(PITCH_SCENES, 0).elapsed, 0);
  assert.equal(getSceneAt(PITCH_SCENES, 168).elapsed / PITCH_SCENES.at(-1).seconds, 1);
});

test('reloj presenta minutos y segundos de forma consistente con duración y seek', () => {
  for (const [seconds, display] of [[-1, '0:00'], [0, '0:00'], [9.9, '0:09'], [59.9, '0:59'], [60, '1:00'], [168, '2:48']]) {
    assert.equal(formatPitchTime(seconds), display);
  }
});

test('guion narrado tiene longitud realizable y atribuye PISA a estudiantes de quince años', () => {
  const words = PITCH_SCENES.flatMap((scene) => scene.narration.trim().split(/\s+/));
  assert.ok(words.length >= 250 && words.length <= 420, `${words.length} palabras para 168 segundos`);
  const source = new URL(PITCH_SOURCE.url);
  assert.equal(source.protocol, 'https:');
  assert.equal(source.hostname, 'www.oecd.org');
  assert.match(source.pathname, /pisa-2022/);
  assert.match(source.pathname, /mexico/);
  assert.match(PITCH_SOURCE.label, /PISA 2022/);
  assert.match(PITCH_SOURCE.label, /15 años/);
  assert.match(PITCH_SCENES.find((scene) => scene.id === 'context').narration, /quince años/);
});

test('portada con el equipo y escenas de diferenciadores, usuarios y lenguas', () => {
  assert.equal(TEAM_NAME, 'PotroDevs');
  assert.deepEqual(TEAM_MEMBERS, ['Raúl Treviño Licona', 'Lizbeth Ocampo Blanco', 'Osvaldo Estrada Lara']);
  assert.equal(PITCH_SCENES[0].id, 'title');
  for (const id of ['map', 'diagnosis', 'student', 'paper', 'teams', 'languages', 'school', 'closing']) assert.ok(PITCH_SCENES.some((scene) => scene.id === id), id);
  for (const source of PITCH_EXTRA_SOURCES) assert.equal(new URL(source.url).protocol, 'https:');
});
