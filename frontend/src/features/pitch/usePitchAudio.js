import { useEffect, useMemo, useRef } from 'react';
import { BEAT, buildSoundEvents, chordAt, midiToHz, moodAt } from './pitch.audio';
import { TOURS } from './pitch.tours';

const LOOKAHEAD = 0.3; // segundos que se programan por adelantado
const TICK_MS = 40;

/** Sintetizador mínimo: tonos con envolvente y ruido filtrado, todo hacia `dest`. */
function createSynth(ctx, dest, live) {
  const track = (node, end) => { live.add(node); node.onended = () => live.delete(node); node.stop(end); };
  const tone = (freq, at, dur, { type = 'sine', gain = 0.1, attack = 0.01, release = 0.25, cutoff = 0, detune = 0 } = {}) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + attack);
    env.gain.setValueAtTime(gain, at + Math.max(attack, dur - release));
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let last = env;
    if (cutoff) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; env.connect(lp); last = lp; }
    osc.connect(env); last.connect(dest);
    osc.start(at); track(osc, at + dur + 0.05);
  };
  const noise = (at, dur, { gain = 0.2, from = 300, to = 3000, q = 0.8, type = 'bandpass' } = {}) => {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(from, at); filter.frequency.exponentialRampToValueAtTime(to, at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at); env.gain.exponentialRampToValueAtTime(gain, at + dur * 0.35); env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter); filter.connect(env); env.connect(dest);
    src.start(at); track(src, at + dur + 0.05);
  };
  return { tone, noise };
}

/** Reverberación suave generada (respuesta al impulso de ruido con caída). */
function createReverb(ctx) {
  const length = ctx.sampleRate * 2.2;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const convolver = ctx.createConvolver(); convolver.buffer = impulse;
  return convolver;
}

function playEffect(synth, event, at) {
  const { tone, noise } = synth;
  switch (event.kind) {
    case 'whoosh': noise(at, 0.7, { gain: 0.18, from: 250, to: 4200, q: 0.6 }); break;
    case 'pop': tone(midiToHz(72 + [0, 4, 7][event.step % 3]), at, 0.22, { type: 'triangle', gain: 0.16, release: 0.18 }); break;
    case 'click': tone(1800, at, 0.05, { type: 'square', gain: 0.05, attack: 0.002, release: 0.04, cutoff: 3500 }); tone(900, at + 0.012, 0.05, { type: 'square', gain: 0.035, attack: 0.002, release: 0.04, cutoff: 2500 }); break;
    case 'chime': { const notes = [84, 86, 88, 91, 93]; tone(midiToHz(notes[event.step % notes.length]), at, 0.9, { type: 'sine', gain: 0.07, attack: 0.005, release: 0.8 }); tone(midiToHz(notes[event.step % notes.length] + 12), at, 0.6, { type: 'sine', gain: 0.025, attack: 0.005, release: 0.5 }); break; }
    case 'rise': noise(at, 1.4, { gain: 0.12, from: 200, to: 6000, q: 1.2 }); [60, 64, 67, 72].forEach((n, i) => tone(midiToHz(n), at + i * 0.22, 0.5, { type: 'triangle', gain: 0.06, release: 0.4 })); break;
    case 'confetti': noise(at, 0.35, { gain: 0.25, from: 1200, to: 8000, q: 0.5, type: 'highpass' }); [84, 88, 91, 96, 100].forEach((n, i) => tone(midiToHz(n), at + 0.05 + i * 0.06, 0.5, { type: 'sine', gain: 0.05, release: 0.45 })); break;
    case 'twinkle': tone(midiToHz([91, 93, 96, 98, 100, 103, 105, 108][event.step % 8]), at, 0.7, { type: 'sine', gain: 0.045, attack: 0.004, release: 0.65 }); break;
    case 'impact': tone(55, at, 1.6, { type: 'sine', gain: 0.32, attack: 0.005, release: 1.4 }); noise(at, 0.5, { gain: 0.14, from: 120, to: 60, q: 0.7, type: 'lowpass' }); [48, 55, 60, 64, 67, 72].forEach((n) => tone(midiToHz(n), at, 2.6, { type: 'triangle', gain: 0.045, attack: 0.02, release: 2.2, detune: (n % 3) * 3 })); break;
    default: break;
  }
}

/** Una corchea de música (pad y bajo al inicio de compás, arpegio en corcheas). */
function playMusicStep(synth, time, at) {
  const { tone } = synth;
  const step = Math.round(time / (BEAT / 2));
  const mood = moodAt(time);
  const [root, ...triad] = chordAt(time);
  const barLength = BEAT * 4;
  if (step % 8 === 0) {
    triad.forEach((note, i) => tone(midiToHz(note), at, barLength * 1.05, { type: 'triangle', gain: mood === 'minor' ? 0.022 : 0.026, attack: 0.5, release: 1, cutoff: 1800, detune: (i - 1) * 6 }));
    tone(midiToHz(root), at, barLength * 0.9, { type: 'sine', gain: 0.07, attack: 0.03, release: 0.6 });
  }
  const sparse = mood === 'minor' && step % 2 === 1; // apertura y contexto: más pausado
  if (!sparse) {
    const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
    const note = triad[pattern[step % 8]] + 12;
    tone(midiToHz(note), at, 0.42, { type: mood === 'finale' ? 'triangle' : 'sine', gain: mood === 'finale' ? 0.035 : 0.028, attack: 0.008, release: 0.36 });
  }
}

/**
 * Reproduce la banda sonora sincronizada con el reloj del pitch. Solo suena si `enabled`
 * (apagado por defecto) y mientras la presentación se reproduce.
 */
export function usePitchAudio({ enabled, playing, time }) {
  const events = useMemo(() => buildSoundEvents(TOURS), []);
  const timeRef = useRef(time);
  timeRef.current = time;
  const audio = useRef(null);

  useEffect(() => {
    if (!enabled || !playing) return undefined;
    if (!audio.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return undefined;
      const ctx = new Ctx();
      const master = ctx.createGain(); master.gain.value = 0.9;
      const dry = ctx.createGain(); dry.gain.value = 1;
      const wet = ctx.createGain(); wet.gain.value = 0.28;
      const reverb = createReverb(ctx);
      dry.connect(master); wet.connect(reverb); reverb.connect(master); master.connect(ctx.destination);
      const input = ctx.createGain(); input.connect(dry); input.connect(wet);
      const live = new Set();
      audio.current = { ctx, input, live, synth: createSynth(ctx, input, live) };
    }
    const { ctx, synth, live } = audio.current;
    ctx.resume?.();
    let cursor = timeRef.current; // hasta dónde ya se programó
    let lastNow = timeRef.current;
    let lastReal = performance.now();
    const interval = setInterval(() => {
      const now = timeRef.current;
      const realDelta = (performance.now() - lastReal) / 1000;
      // Un salto (adelantar o retroceder) reinicia la programación sin disparar lo saltado.
      if (Math.abs(now - lastNow - realDelta) > 0.35) cursor = now;
      lastNow = now; lastReal = performance.now();
      const until = now + LOOKAHEAD;
      const toCtx = (t) => ctx.currentTime + Math.max(0, t - now) + 0.02;
      const eighth = BEAT / 2;
      for (let beat = Math.ceil(cursor / eighth - 1e-6) * eighth; beat < until; beat += eighth) {
        if (beat >= cursor - 1e-6) playMusicStep(synth, beat, toCtx(beat));
      }
      for (const event of events) if (event.t >= cursor && event.t < until) playEffect(synth, event, toCtx(event.t));
      cursor = until;
    }, TICK_MS);
    return () => {
      clearInterval(interval);
      // Al pausar o silenciar, se cortan las notas pendientes.
      for (const node of live) { try { node.stop(); } catch { /* ya detenido */ } }
      live.clear();
    };
  }, [enabled, playing, events]);

  useEffect(() => () => { audio.current?.ctx.close?.(); audio.current = null; }, []);
}
