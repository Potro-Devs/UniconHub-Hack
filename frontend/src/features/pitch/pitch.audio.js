/**
 * Banda sonora del pitch: música original y efectos sintetizados con Web Audio (sin archivos
 * ni derechos de terceros). Las partes puras (eventos y armonía) se prueban con node --test.
 */
import { PITCH_SCENES } from './pitch.content.js';

export const BPM = 96;
export const BEAT = 60 / BPM; // 0.625 s

const sceneStarts = () => {
  let start = 0;
  return PITCH_SCENES.map((scene) => { const s = { id: scene.id, start, end: start + scene.seconds }; start += scene.seconds; return s; });
};

/** Ánimo de la música por escena: el problema en menor, la solución en mayor, el cierre triunfal. */
export const SCENE_MOOD = Object.freeze({ title: 'bright', opening: 'minor', context: 'minor', closing: 'finale' });

// Acordes en notas MIDI (raíz grave + tríada).
const PROGRESSIONS = Object.freeze({
  minor: [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]], // Am F C G
  bright: [[48, 55, 60, 64], [43, 55, 59, 62], [45, 57, 60, 64], [41, 57, 60, 65]], // C G Am F
  finale: [[41, 57, 60, 65], [43, 55, 59, 62], [48, 55, 60, 64], [48, 55, 60, 67]], // F G C C
});

export function moodAt(time) {
  const scene = sceneStarts().find((s) => time >= s.start && time < s.end) ?? sceneStarts().at(-1);
  return SCENE_MOOD[scene.id] ?? 'bright';
}

/** Acorde que suena en un tiempo dado (cambia cada compás de 4 tiempos). */
export function chordAt(time) {
  const bar = Math.floor(time / (BEAT * 4));
  const progression = PROGRESSIONS[moodAt(time)];
  return progression[bar % progression.length];
}

/**
 * Efectos sincronizados con la animación. `tours` viene de pitch.tours.js (se inyecta para
 * poder probar esta función sin importar imágenes).
 */
export function buildSoundEvents(tours = {}) {
  const events = [];
  for (const scene of sceneStarts()) {
    if (scene.start > 0) events.push({ t: scene.start + 0.05, kind: 'whoosh' });
    if (scene.id === 'title') ['A', 'x', 'i'].forEach((_, i) => events.push({ t: scene.start + 0.35 + i * 0.18, kind: 'pop', step: i }));
    const tour = tours[scene.id];
    if (tour) {
      for (const [i, step] of tour.steps.entries()) {
        events.push({ t: scene.start + step.at + 1, kind: 'click' });
        events.push({ t: scene.start + step.at + 0.9, kind: 'chime', step: i });
      }
    }
    if (scene.id === 'closing') {
      events.push({ t: scene.start + 0.1, kind: 'rise' });
      events.push({ t: scene.start + 1.5, kind: 'confetti' });
      for (let i = 0; i < 8; i += 1) events.push({ t: scene.start + 3.1 + i * 0.36, kind: 'twinkle', step: i });
      events.push({ t: scene.start + 5.2, kind: 'impact' });
    }
  }
  return events.sort((a, b) => a.t - b.t);
}

export const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
