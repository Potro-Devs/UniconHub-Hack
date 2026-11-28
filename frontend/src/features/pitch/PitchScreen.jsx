import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { PITCH_DURATION, PITCH_EXTRA_SOURCES, PITCH_SCENES, PITCH_SOURCE, TEAM_MEMBERS, TEAM_NAME } from './pitch.content';
import { TOURS } from './pitch.tours';
import { formatPitchTime, getSceneAt, sceneStart } from './timeline';
import { usePitchPlayback } from './usePitchPlayback';
import { usePitchAudio } from './usePitchAudio';
import potroDevsLogo from './assets/potrodevs-logo.png';
import './pitch.css';
import './pitch-showcase.css';

/* Todo se deriva del reloj de la presentación: pausar, saltar y reducir movimiento funcionan igual. */
const Motion = createContext({ elapsed: 0, reduced: false, cq: 12, seconds: 10 });
const unit = (value) => Math.max(0, Math.min(1, value));
const ease = (t) => { const x = unit(t); return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2; };
const lerp = (a, b, t) => a + (b - a) * t;
const VIEW_H = 0.62; // alto / ancho del visor de capturas

function Reveal({ at = 0, className = '', children, style = {}, from = 18, axis = 'y' }) {
  const { elapsed, reduced } = useContext(Motion);
  const progress = reduced ? 1 : ease((elapsed - at) / 0.85);
  const offset = (1 - progress) * from;
  return <div className={`pitch-reveal ${className}`} style={{ opacity: progress, transform: axis === 'y' ? `translateY(${offset}px)` : `translateX(${offset}px)`, ...style }}>{children}</div>;
}
function Mark({ children, className = '' }) { return <span className={`pitch-mark ${className}`}>{children}</span>; }
function Fraction({ top, bottom }) { return <span className="pitch-fraction"><b>{top}</b><b>{bottom}</b></span>; }

/** Axi a un tamaño relativo al escenario (`w` en cqw). Mascot dibuja en píxeles. */
function StageMascot({ w, mood = 'feliz', float = false }) {
  const { cq, elapsed, reduced } = useContext(Motion);
  const bob = float && !reduced ? Math.sin(elapsed * 2.2) * cq * 0.5 : 0;
  return <span className="pv-stage-mascot" style={{ transform: `translateY(${bob}px)` }}><Mascot size={Math.max(20, Math.round(cq * w))} mood={mood} animated={false} /></span>;
}
/** Axi como logo del sistema: mascota + nombre. */
function AxiLogo({ size = 'md', px = 40 }) {
  return <span className={`pv-axi-logo pv-axi-logo--${size}`}><span className="pv-axi-logo-mascot"><Mascot size={Math.round(px)} mood="feliz" animated={false} /></span><b>{APP_NAME}</b></span>;
}

/** Título que aparece palabra por palabra. */
export function AnimatedHeading({ title, accent, headingRef }) {
  const { elapsed, reduced } = useContext(Motion);
  const words = (text, offset) => text.split(' ').map((word, index) => {
    const t = reduced ? 1 : ease((elapsed - 0.25 - (offset + index) * 0.09) / 0.6);
    return <span key={`${word}-${index}`} className="pv-word" style={{ opacity: t, transform: `translateY(${(1 - t) * 0.6}em)` }}>{word}{' '}</span>;
  });
  const titleWords = title.split(' ').length;
  return <h1 ref={headingRef}>{words(title, 0)}<em>{words(accent, titleWords)}</em></h1>;
}

/** Luces de fondo que se mueven lentamente (CSS, se pausan con la presentación). */
function Ambient() { return <div className="pv-ambient" aria-hidden="true"><i /><i /><i /></div>; }

/** Cortina de transición al entrar a cada escena. */
function SceneWipe() {
  const { elapsed, reduced } = useContext(Motion);
  if (reduced || elapsed > 0.9) return null;
  const t = ease(elapsed / 0.9);
  return <div className="pv-wipe" aria-hidden="true" style={{ transform: `translateY(${-t * 101}%)` }}><span style={{ opacity: 1 - t }}><AxiLogo size="wipe" px={48} /></span></div>;
}

/* ───────────── Recorrido guiado por una captura real ───────────── */
function cameraFor(step, shot) {
  if (!step) return { z: 1, tx: 0, ty: 0 };
  const z = step.zoom;
  const cx = step.rect.x + step.rect.w / 2;
  const cy = step.rect.y + step.rect.h / 2;
  const tx = Math.max(0, Math.min(z - 1, cx * z - 0.5));
  const ty = Math.max(0, Math.min(Math.max(0, z * shot.ratio - VIEW_H), cy * z * shot.ratio - VIEW_H / 2));
  return { z, tx, ty };
}
const rectInView = (rect, cam, ratio) => ({
  left: (rect.x * cam.z - cam.tx) * 100,
  top: ((rect.y * cam.z * ratio - cam.ty) / VIEW_H) * 100,
  width: rect.w * cam.z * 100,
  height: ((rect.h * cam.z * ratio) / VIEW_H) * 100,
});

function Tour({ tour }) {
  const { elapsed, reduced } = useContext(Motion);
  const index = tour.steps.reduce((found, step, i) => (elapsed >= step.at ? i : found), -1);
  const step = tour.steps[index];
  const previous = tour.steps[index - 1];
  const activeShot = step?.shot ?? 0;
  const moving = step ? (reduced ? 1 : ease((elapsed - step.at) / 1.1)) : 0;
  return <div className="pv-tour">
    <div className="pv-tour-side">
      <Reveal at={0.4} className="pv-problem"><span>El problema</span><p>{tour.problem}</p></Reveal>
      <ol className="pv-steps">{tour.steps.map((item, i) => {
        const shown = reduced || elapsed >= item.at - 0.15;
        const t = reduced ? 1 : ease((elapsed - item.at + 0.15) / 0.6);
        return <li key={item.title} className={`pv-step ${i === index ? 'pv-step--active' : ''} ${i < index ? 'pv-step--done' : ''}`} style={{ opacity: shown ? t : 0, transform: `translateX(${(1 - t) * -14}px)` }}>
          <b>{i + 1}</b><div><strong>{item.title}</strong><span>{item.text}</span></div>
        </li>;
      })}</ol>
    </div>
    <Reveal at={0.1} className="pv-tour-frame" from={30}>
      <div className="pv-browser-bar" aria-hidden="true"><i /><i /><i /><span>{tour.shots[activeShot].address}</span><em>Prototipo · datos ficticios</em></div>
      <div className="pv-viewport" style={{ aspectRatio: `1 / ${VIEW_H}` }}>
        {tour.shots.map((shot, shotIndex) => {
          const own = tour.steps.filter((s, i) => s.shot === shotIndex && i <= index);
          const current = own.at(-1);
          const before = own.at(-2);
          const target = cameraFor(current, shot);
          const origin = current === step && previous?.shot === shotIndex ? cameraFor(previous, shot) : cameraFor(before, shot);
          const cam = current === step ? { z: lerp(origin.z, target.z, moving), tx: lerp(origin.tx, target.tx, moving), ty: lerp(origin.ty, target.ty, moving) } : target;
          // Transición cruzada: la captura anterior se desvanece mientras entra la nueva.
          const switching = step && previous && previous.shot !== step.shot;
          const fade = switching ? (reduced ? 1 : ease((elapsed - step.at) / 0.8)) : 1;
          const opacity = shotIndex === activeShot ? fade : switching && shotIndex === previous.shot ? 1 - fade : 0;
          return <div key={shot.src} className="pv-shot" style={{ opacity }}>
            <img src={shot.src} alt="" style={{ width: `${cam.z * 100}%`, left: `${-cam.tx * 100}%`, top: `${(-cam.ty / VIEW_H) * 100}%` }} />
          </div>;
        })}
        {step && <Spotlight step={step} index={index} shot={tour.shots[step.shot]} previous={previous} />}
      </div>
    </Reveal>
  </div>;
}

function Spotlight({ step, index, shot, previous }) {
  const { elapsed, reduced } = useContext(Motion);
  const local = elapsed - step.at;
  const box = rectInView(step.rect, cameraFor(step, shot), shot.ratio);
  const glow = reduced ? 1 : ease((local - 0.85) / 0.45);
  // El cursor viaja desde la zona anterior (o desde una esquina) hasta el centro de la actual.
  const from = previous && previous.shot === step.shot ? rectInView(previous.rect, cameraFor(step, shot), shot.ratio) : { left: 88, top: 92, width: 0, height: 0 };
  const travel = reduced ? 1 : ease(local / 1);
  const cx = lerp(from.left + from.width / 2, box.left + box.width / 2, travel);
  const cy = lerp(from.top + from.height / 2, box.top + box.height / 2, travel);
  const click = reduced ? 0 : unit((local - 1) / 0.6);
  return <>
    <div className="pv-spot" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`, opacity: glow }}>
      <span className="pv-spot-badge">{index + 1}</span>
    </div>
    <div className="pv-cursor" style={{ left: `${cx}%`, top: `${cy}%` }} aria-hidden="true">
      {click > 0 && click < 1 && <span className="pv-click" style={{ transform: `scale(${0.4 + click * 1.6})`, opacity: 1 - click }} />}
      <svg viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.6L9.6 19z" /></svg>
    </div>
  </>;
}

/* ───────────── Escenas ───────────── */
function Title() {
  const { elapsed, reduced } = useContext(Motion);
  return <div className="pv-title-art">
    <div className="pv-title-wordmark">
      <Reveal at={0} className="pv-title-kicker"><span className="pitch-kicker">Hackathon · Educación primaria en México</span></Reveal>
      <div className="pv-title-letters" aria-label={APP_NAME}>{APP_NAME.split('').map((letter, i) => {
        const t = reduced ? 1 : ease((elapsed - 0.3 - i * 0.18) / 0.7);
        return <span key={i} aria-hidden="true" style={{ opacity: t, transform: `translateY(${(1 - t) * 40}%) scale(${0.7 + 0.3 * t})` }}>{letter}</span>;
      })}<span className="pv-title-mascot" style={{ opacity: reduced ? 1 : ease((elapsed - 1) / 0.8) }}><StageMascot w={15} mood="celebra" float /></span></div>
      <Reveal at={1.6} className="pv-title-tagline">Cada error abre un siguiente paso.</Reveal>
      <Reveal at={2.4} className="pv-title-pillars"><span>Diagnóstico del error típico</span><span>Pistas sin regalar respuestas</span><span>Funciona en papel</span><span>Aprendemos en equipo</span><span>Español · náhuatl · maya</span></Reveal>
    </div>
    <Reveal at={1.2} className="pv-team-card" from={40} axis="x">
      <div className="pv-team-brand"><span className="pv-team-logo"><img src={potroDevsLogo} alt={`Logo de ${TEAM_NAME}`} width="128" height="128" /></span><div><span>Un proyecto de</span><strong>{TEAM_NAME}</strong></div></div>
      <ul className="pv-team-members" aria-label={`Integrantes de ${TEAM_NAME}`}>{TEAM_MEMBERS.map((name, i) => <li key={name} style={{ opacity: reduced ? 1 : ease((elapsed - 2 - i * 0.35) / 0.6) }}>{name}</li>)}</ul>
    </Reveal>
  </div>;
}

function Opening() {
  const { elapsed, reduced } = useContext(Motion);
  return <div className="pitch-classroom">
    <div className="pitch-classroom-ring" /><div className="pitch-classroom-ring pitch-classroom-ring--outer" />
    <div className="pitch-dot-matrix" aria-label="45 alumnos, distintos puntos de partida">{Array.from({ length: 45 }, (_, index) => <span key={index} className={index % 7 === 0 ? 'pitch-dot-special' : ''} style={{ opacity: reduced ? 1 : 0.18 + 0.82 * unit((elapsed - index * 0.035) / 0.7), transform: `scale(${reduced ? 1 : 0.7 + 0.3 * unit((elapsed - index * 0.035) / 0.7)})` }} />)}</div>
    <Reveal at={3} className="pitch-classroom-caption"><span className="pitch-small-star">✦</span><p>Un salón.<br /><strong>Muchas formas de pensar.</strong></p></Reveal>
    <Reveal at={6} className="pitch-question-tag">¿Por dónde empezamos?</Reveal>
    <Reveal at={7.5} className="pv-opening-axi"><StageMascot w={7.5} mood="pista" float /></Reveal>
  </div>;
}

function Context() {
  const { elapsed, reduced } = useContext(Motion);
  const fill = reduced ? 66 : 66 * ease((elapsed - 0.6) / 1.4);
  const count = Math.round(reduced ? 66 : 66 * ease((elapsed - 0.4) / 1.6));
  return <div className="pitch-context-art">
    <Reveal at={0.1} className="pitch-stat-main"><div className="pitch-stat-number">{count}<span>%</span></div><p>no alcanzó el nivel mínimo<br />en matemáticas</p><span className="pitch-stat-rule" style={{ width: `${fill}%` }} /></Reveal>
    <Reveal at={2.4} className="pitch-stat-note"><Mark>PISA 2022 · MÉXICO</Mark><strong>Estudiantes de 15 años.</strong><p>Un indicador de urgencia.<br />La intervención empieza antes.</p></Reveal>
    <Reveal at={4.5} className="pitch-early"><span>PRIMARIA</span><span className="pitch-early-line" /><b>El momento para acompañar</b></Reveal>
    <a className="pitch-source" href={PITCH_SOURCE.url} target="_blank" rel="noreferrer" title={PITCH_SOURCE.label}>Fuente: OCDE · PISA 2022 ↗<span>No es una medición de alumnos de primaria.</span></a>
  </div>;
}

function Diagnosis() {
  return <div className="pitch-diagnosis-art">
    <Reveal at={0.2} className="pitch-exercise"><div className="pitch-sheet-top"><span>FRACCIONES</span><span>01</span></div><p>¿Cómo sumarías estas partes?</p><div className="pitch-equation"><Fraction top="1" bottom="2" /><span>+</span><Fraction top="1" bottom="3" /><span>=</span><span className="pitch-equation-question">?</span></div><div className="pitch-choice"><span>Respuesta elegida</span><Fraction top="2" bottom="5" /><span className="pitch-choice-dot" /></div><small>Ejemplo ilustrativo · ficha ficticia</small></Reveal>
    <Reveal at={3.6} className="pitch-concept-arrow"><svg viewBox="0 0 160 100" aria-hidden="true"><path d="M5 20C65 20 40 75 145 75m-18-14 18 14-18 13" /></svg></Reveal>
    <Reveal at={5} className="pitch-insight"><Mark>EL ERROR TIENE SIGNIFICADO</Mark><h3>Suma numeradores<br />y denominadores.</h3><div className="pitch-insight-rule" /><p>Necesita comprender<br /><strong>partes del mismo tamaño.</strong></p><span className="pitch-insight-action">→ Una intervención concreta</span></Reveal>
    <Reveal at={8} className="pv-diag-axi"><StageMascot w={7} mood="pista" float /></Reveal>
  </div>;
}

/* Cierre: Axi sube, celebra con confeti y enciende a los 45 alumnos del salón. */
const CONFETTI = Array.from({ length: 46 }, (_, i) => ({
  angle: (i * 137.508) % 360, // ángulo áureo: reparto parejo y determinista
  speed: 16 + (i * 7) % 15,
  spin: (i % 2 ? 1 : -1) * (220 + (i * 53) % 260),
  color: ['#ffcf4a', '#c8006a', '#6552c8', '#2f86d6', '#2e9e86', '#fffaf1'][i % 6],
  shape: i % 3,
}));
const RING = Array.from({ length: 45 }, (_, i) => {
  const a = (i / 45) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(a) * 34, y: 50 + Math.sin(a) * 42, order: (i * 17) % 45 };
});

function Closing() {
  const { elapsed, reduced } = useContext(Motion);
  const t = reduced ? 12 : elapsed;
  // 1) Axi sube con rebote (0–1.4 s)
  const rise = ease(t / 1.4);
  const bounce = reduced ? 0 : Math.sin(Math.min(1, t / 1.4) * Math.PI) * -6 + (1 - rise) * 60;
  // 2) Salta de alegría al celebrar (1.4–3 s) y luego flota
  const jump = !reduced && t > 1.4 && t < 3 ? -Math.sin(((t - 1.4) / 1.6) * Math.PI * 2) * 5 * (1 - (t - 1.4) / 1.6) : 0;
  const sway = reduced ? 0 : Math.sin(t * 1.8) * 3;
  const float = reduced ? 0 : Math.sin(t * 2.1) * 1.2;
  // 3) Confeti (1.5–5 s) con gravedad
  const burst = t - 1.5;
  // 4) Rayos y halo
  const rays = reduced ? 0 : t * 12;
  const glow = ease((t - 0.6) / 1.2);
  // 5) Frase final y equipo
  const motto = ['Cada', 'error', 'abre', 'un', 'siguiente', 'paso.'];
  return <div className="pv-finale">
    <div className="pv-finale-rays" aria-hidden="true" style={{ opacity: glow * 0.9, transform: `translate(-50%,-50%) rotate(${rays}deg)` }} />
    <div className="pv-finale-glow" aria-hidden="true" style={{ opacity: glow, transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * glow + (reduced ? 0 : Math.sin(t * 1.6) * 0.03)})` }} />
    <div className="pv-finale-ring" aria-label="Los 45 alumnos del salón, acompañados">
      {RING.map((dot, i) => {
        const lit = reduced ? 1 : ease((t - 3 - dot.order * 0.06) / 0.4);
        const appear = reduced ? 1 : ease((t - 2.4 - i * 0.012) / 0.5);
        return <span key={i} style={{ left: `${dot.x}%`, top: `${dot.y}%`, opacity: appear, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * appear + 0.35 * lit * (1 - lit) * 4})`, background: lit > 0.5 ? '#ffcf4a' : '#c3b5f4', boxShadow: lit > 0.5 ? `0 0 ${1.2 * lit}cqw #ffcf4acc` : 'none' }} />;
      })}
    </div>
    {!reduced && burst > 0 && burst < 3.6 && <div className="pv-confetti" aria-hidden="true">{CONFETTI.map((piece, i) => {
      const rad = (piece.angle * Math.PI) / 180;
      const d = piece.speed * burst;
      const x = Math.cos(rad) * d;
      const y = Math.sin(rad) * d * 0.8 + 9 * burst * burst; // gravedad
      return <i key={i} className={`pv-confetti-${piece.shape}`} style={{ background: piece.color, opacity: 1 - unit((burst - 2.4) / 1.2), transform: `translate(${x}cqw, ${y}cqw) rotate(${piece.spin * burst}deg)` }} />;
    })}</div>}
    <div className="pv-finale-axi" style={{ transform: `translate(-50%, calc(-50% + ${bounce + jump + float}cqw)) rotate(${sway}deg) scale(${0.6 + 0.4 * rise})`, opacity: rise }}>
      <StageMascot w={17} mood={t > 1.4 ? 'celebra' : 'feliz'} />
    </div>
    <div className="pv-finale-copy">
      <p className="pv-finale-motto" aria-label="Cada error abre un siguiente paso.">{motto.map((word, i) => {
        const w = reduced ? 1 : ease((t - 5.2 - i * 0.16) / 0.55);
        return <span key={word} aria-hidden="true" className={word === 'siguiente' || word === 'paso.' ? 'pv-finale-accent' : ''} style={{ opacity: w, transform: `translateY(${(1 - w) * 0.8}em) scale(${0.9 + 0.1 * w})` }}>{word}</span>;
      })}</p>
      <div className="pv-finale-sign" style={{ opacity: reduced ? 1 : ease((t - 7.4) / 0.8) }}>
        <AxiLogo size="finale" px={44} /><span>45 alumnos. 45 siguientes pasos.</span>
        <b>{TEAM_NAME} · {TEAM_MEMBERS.join(' · ')}</b>
      </div>
    </div>
  </div>;
}

const tourScene = (id) => function TourScene() { return <Tour tour={TOURS[id]} />; };
const ART = { title: Title, opening: Opening, context: Context, map: tourScene('map'), diagnosis: Diagnosis, student: tourScene('student'), paper: tourScene('paper'), teams: tourScene('teams'), languages: tourScene('languages'), school: tourScene('school'), closing: Closing };
const DARK_SCENES = ['title', 'opening', 'closing'];

export default function PitchScreen({ standalone = false } = {}) {
  const playback = usePitchPlayback(PITCH_DURATION);
  const current = getSceneAt(PITCH_SCENES, playback.time);
  const reduced = useReducedMotion();
  const preview = !playback.hasPlayed && playback.time > 0;
  const WorkspaceBrand = standalone ? 'div' : Link;
  const [clean, setClean] = useState(false);
  const [notes, setNotes] = useState(false);
  const [subtitles, setSubtitles] = useState(true);
  // Música y efectos: apagados por defecto; se activan con el botón Sonido o la tecla M.
  const [sound, setSound] = useState(false);
  usePitchAudio({ enabled: sound, playing: playback.playing, time: playback.time });
  const [message, setMessage] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const root = useRef(null);
  const stage = useRef(null);
  const [cq, setCq] = useState(12);
  useEffect(() => {
    if (!stage.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setCq(entry.contentRect.width / 100));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const sceneHeading = useRef(null);
  const move = useCallback((delta) => playback.seek(sceneStart(PITCH_SCENES, Math.max(0, Math.min(PITCH_SCENES.length - 1, current.index + delta)))), [current.index, playback.seek]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select, [contenteditable="true"]') || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'Space') { if (event.target.closest('button, a')) return; event.preventDefault(); playback.toggle(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      else if (event.key === 'Home') { event.preventDefault(); playback.seek(0); }
      else if (event.key === 'End') { event.preventDefault(); playback.seek(PITCH_DURATION); }
      else if (event.key === 'Escape') setClean(false);
      else if (event.key.toLowerCase() === 'c') setClean((value) => !value);
      else if (event.key.toLowerCase() === 'm') setSound((value) => !value);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [move, playback.seek, playback.toggle]);
  useEffect(() => {
    const onFullscreen = () => { setFullscreen(Boolean(document.fullscreenElement)); if (!document.fullscreenElement) setClean(false); };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current.requestFullscreen(); }
    catch { setMessage('Pantalla completa no disponible. Puedes usar el modo limpio y ampliar la ventana.'); }
  };
  const sources = [PITCH_SOURCE, ...PITCH_EXTRA_SOURCES];
  const script = PITCH_SCENES.map((scene, index) => `[${formatPitchTime(sceneStart(PITCH_SCENES, index))}] ${scene.kicker}\n${scene.narration}`).join('\n\n');
  const downloadScript = () => {
    const blob = new Blob([`${APP_NAME} · Guion para narración humana\nDuración: ${formatPitchTime(PITCH_DURATION)}\n\n${script}\n\nFuentes:\n${sources.map((source) => `- ${source.label}: ${source.url}`).join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'pitch-guion.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Guion descargado con tiempos por escena.');
  };
  const Art = ART[current.scene.id];
  const dark = DARK_SCENES.includes(current.scene.id);
  const subtitleChunks = current.scene.narration.match(/(?:\S+\s*){1,16}/g) ?? [];
  const subtitle = subtitleChunks[Math.min(subtitleChunks.length - 1, Math.floor(current.elapsed / current.scene.seconds * subtitleChunks.length))];

  return <main ref={root} className={`pitch-page ${clean ? 'pitch-page--clean' : ''}`}>
    {!clean && <header className="pitch-workspace-header"><WorkspaceBrand {...(standalone ? {} : { to: '/login' })} className="pitch-workspace-brand"><AxiLogo size="md" /><span>ESTUDIO DE PRESENTACIÓN</span></WorkspaceBrand><div><span>{formatPitchTime(PITCH_DURATION)} · Narración humana · {TEAM_NAME}</span><button type="button" onClick={() => setNotes((value) => !value)} aria-expanded={notes}>Guion y notas</button></div></header>}
    <div className="pitch-viewer">
      <section ref={stage} className={`pitch-stage ${dark ? 'pitch-stage--dark' : ''} ${TOURS[current.scene.id] ? 'pitch-stage--tour' : ''} pitch-stage--${current.scene.id}`} aria-label={`Presentación, escena ${current.index + 1} de ${PITCH_SCENES.length}`} style={{ '--pitch-play-state': playback.playing ? 'running' : 'paused' }}>
        <div className="pitch-stage-grain" aria-hidden="true" />
        <div className="pitch-stage-top"><strong className="pv-stage-brand"><AxiLogo size="sm" px={cq * 2.1} /><span> / </span> EDUCACIÓN QUE COMPRENDE</strong><span>{String(current.index + 1).padStart(2, '0')} — {String(PITCH_SCENES.length).padStart(2, '0')}</span></div>
        <Motion.Provider value={{ elapsed: current.elapsed, reduced: reduced || preview, cq }}><div className="pitch-scene" key={current.scene.id}>
          <Ambient /><div className="pitch-scene-copy"><span className="pitch-kicker">{current.scene.kicker}</span><AnimatedHeading title={current.scene.title} accent={current.scene.accent} headingRef={sceneHeading} /></div>
          <div className="pitch-scene-art"><Art /></div>
          <SceneWipe />
        </div></Motion.Provider>
        {subtitles && <p className="pitch-subtitles"><span>{subtitle}</span></p>}
        <div className="pitch-stage-bottom"><span>DIAGNÓSTICO · ACOMPAÑAMIENTO · CONTINUIDAD</span><span>Prototipo · ejemplos ficticios</span></div>
        {playback.time === 0 && !playback.playing && !clean && <button className="pitch-cover-play" type="button" onClick={playback.toggle}><span aria-hidden="true">▶</span> Reproducir presentación <small>{formatPitchTime(PITCH_DURATION)} · activa Sonido para música y efectos</small></button>}
      </section>
      {clean && <button className="pitch-clean-return" type="button" onClick={() => setClean(false)} aria-label="Mostrar controles de presentación">Mostrar controles <kbd>Esc</kbd></button>}
      {!clean && <div className="pitch-controls" aria-label="Controles de presentación">
        <div className="pitch-scrub"><input aria-label="Posición de la presentación" type="range" min="0" max={PITCH_DURATION} step="0.1" value={playback.time} onChange={(event) => playback.seek(Number(event.target.value))} aria-valuetext={`${formatPitchTime(playback.time)} de ${formatPitchTime(PITCH_DURATION)}`} style={{ '--pitch-position': `${playback.time / PITCH_DURATION * 100}%` }} /></div>
        <div className="pitch-control-row"><div className="pitch-transport"><button type="button" onClick={playback.replay} aria-label="Reproducir desde el inicio" title="Reiniciar">↺</button><button type="button" onClick={() => move(-1)} disabled={current.index === 0} aria-label="Escena anterior">‹</button><button type="button" className="pitch-play-button" onClick={playback.toggle} aria-label={playback.playing ? 'Pausar presentación' : 'Reproducir presentación'}>{playback.playing ? 'Ⅱ' : '▶'}</button><button type="button" onClick={() => move(1)} disabled={current.index === PITCH_SCENES.length - 1} aria-label="Escena siguiente">›</button><span className="pitch-time">{formatPitchTime(playback.time)} <i>/ {formatPitchTime(PITCH_DURATION)}</i></span></div><div className="pitch-view-controls"><button type="button" className="pv-sound-toggle" aria-pressed={sound} onClick={() => setSound((value) => !value)} title="Música y efectos (tecla M)"><span aria-hidden="true">{sound ? '🔊' : '🔇'}</span> Sonido</button><button type="button" aria-pressed={subtitles} onClick={() => setSubtitles((value) => !value)}>Subtítulos</button><button type="button" onClick={() => setClean(true)}>Modo limpio <kbd>C</kbd></button><button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>⛶</button></div></div>
        <nav className="pitch-chapters" aria-label="Escenas de la presentación" style={{ '--pitch-scene-count': PITCH_SCENES.length }}>{PITCH_SCENES.map((scene, index) => <button type="button" key={scene.id} onClick={() => playback.seek(sceneStart(PITCH_SCENES, index))} aria-current={index === current.index ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{scene.chapter}</button>)}</nav>
      </div>}
    </div>
    {!clean && <><p className="pitch-workspace-help"><span>Espacio: reproducir / pausar · ← →: cambiar escena · M: sonido</span><span>Modo limpio para presentar o grabar la pantalla. Sin voz incorporada.</span></p>{notes && <aside className="pitch-notes" aria-label="Guion para la persona que presenta"><div className="pitch-notes-heading"><div><span className="pitch-kicker">TELEPROMPTER · ESCENA {current.index + 1}</span><h2>{current.scene.kicker}</h2></div><div><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(script); setMessage('Guion copiado.'); } catch { setMessage('No se pudo copiar. Usa Descargar guion.'); } }}>Copiar guion</button><button type="button" onClick={downloadScript}>Descargar guion</button></div></div><p className="pitch-narration">{current.scene.narration}</p><p className="pitch-notes-source">{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}<span>El dato de PISA corresponde a adolescentes; los ejemplos de la presentación son ficticios. Contenidos por validar con docentes de primaria.</span></p></aside>}<p role="status" className="pitch-status">{message}</p></>}
  </main>;
}
