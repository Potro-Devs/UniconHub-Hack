import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME, COLORS, KID_COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { buttonStyle, mutedText } from '@/shared/styles/ui';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useSpeech } from '@/shared/hooks/useSpeech';
import { StudentProgressState, studentCard, studentDate } from './StudentProgressState';
import { useStudentProgress } from './useStudentProgress';

const AXI_COLORS = [['rosa', 'Rosa'], ['azul', 'Azul'], ['amarillo', 'Amarillo'], ['lila', 'Lila']];
const CELEBRATION_MS = 3000; // §4.7: máximo 3 segundos

const SIZES = {
  large: { label: 'Un gran paso', bg: KID_COLORS.warm, fg: KID_COLORS['warm-ink'], border: '#F3D27A' },
  medium: { label: 'Tu avance', bg: KID_COLORS['reading-bg'], fg: KID_COLORS['reading-ink'], border: '#8DC8BB' },
  small: { label: 'Un paso más', bg: KID_COLORS['mission-bg'], fg: KID_COLORS.primary, border: KID_COLORS['mission-border'] },
};
const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';
const CODES = {
  block_completed: { icon: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'M8 12.5l2.5 2.5L16 9.5'], headline: '¡Terminaste tu prueba!', says: 'Llegar hasta el final también es aprender. ¡Lo lograste!' },
  level_up: { icon: ['M12 19V5', 'M6 11l6-6 6 6'], headline: '¡Subiste de nivel!', says: 'Tu esfuerzo se nota. Vamos juntos por el siguiente paso.' },
  improved_vs_previous: { icon: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'], headline: '¡Mejoraste!', says: 'Hoy te fue mejor que la vez anterior. ¡Sigue así!' },
  reached_mastered: { icon: [STAR], headline: '¡Llegaste a Dominado!', says: 'Ya conoces muy bien este tema. Puedes ayudar a alguien de tu grupo.' },
};
const FALLBACK_CODE = { icon: [STAR], headline: '¡Un logro más!', says: 'Cada paso cuenta. ¡Sigue a tu ritmo!' };
const TILTS = ['-1.5deg', '1.2deg', '1deg', '-1.2deg', '-0.8deg'];

function sticker(achievement, index) {
  return {
    ...achievement,
    tone: SIZES[achievement.size] ?? SIZES.small,
    copy: CODES[achievement.code] ?? FALLBACK_CODE,
    // block_completed no tiene habilidad: se muestra el nombre de la prueba.
    subtitle: achievement.skillName ?? achievement.description ?? '',
    date: studentDate(achievement.awardedAt),
    tilt: TILTS[index % TILTS.length],
  };
}

function StickerIcon({ paths, size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths.map((d) => <path key={d} d={d} />)}
  </svg>;
}

/** Logros propios persistidos; consultar la colección no vuelve a disparar el logro, solo repite su celebración. */
export function StudentAchievementsScreen() {
  const { axiColor, setAxiColor } = useAppUi();
  const request = useStudentProgress();
  const [openId, setOpenId] = useState(null);
  const returnFocusRef = useRef(null);
  const stickers = request.status === 'ready' ? request.data.achievements.map(sticker) : [];
  const selected = stickers.find((s) => s.id === openId) ?? null;

  const open = (id, event) => { returnFocusRef.current = event.currentTarget; setOpenId(id); };
  const close = useCallback(() => { setOpenId(null); returnFocusRef.current?.focus(); }, []);

  return <div className="kid-page kid-collection student-real-data achievements-album">
    <div className="album-head">
      <header>
        <p className="album-eyebrow">MI ÁLBUM</p>
        <h1 className="font-display">Mis logros</h1>
        <p style={mutedText}>Cada estampa es un paso de tu camino. Tócala para celebrarla otra vez con {APP_NAME}.</p>
      </header>
      <div className="album-legend" aria-label="Tipos de estampa">
        {Object.values(SIZES).map((s) => <span key={s.label} style={{ background: s.bg, color: s.fg }}>{s.label}</span>)}
      </div>
    </div>
    <StudentProgressState request={request} loadingText="Buscando tus logros…" />
    {request.status === 'ready' && (stickers.length === 0 ? <article style={studentCard}>
      <Mascot size={84} color={axiColor} mood="feliz" animated={false} />
      <h2>Tus próximos pasos irán apareciendo aquí</h2>
      <p style={mutedText}>Puedes empezar con una prueba de tu grupo. Pedir una pista también forma parte de aprender.</p>
      <Link to="/alumno/inicio" style={buttonStyle('primary')}>Ver mis actividades</Link>
    </article> : <section aria-label="Mis logros obtenidos" className="album-grid">
      {stickers.map((s) => <button type="button" key={s.id} className="album-sticker" data-achievement-size={s.size}
        onClick={(event) => open(s.id, event)} aria-label={`${s.title}, ${s.subtitle}, ${s.date}. Ver celebración`}
        style={{ background: s.tone.bg, borderColor: s.tone.border, boxShadow: `0 6px 0 ${s.tone.border}`, '--tilt': s.tilt }}>
        <span className="album-sticker-icon"><StickerIcon paths={s.copy.icon} size={30} color={s.tone.fg} /></span>
        <span className="album-sticker-title font-display">{s.title}</span>
        {s.subtitle && <span className="album-sticker-sub">{s.subtitle}</span>}
        <span className="album-sticker-date" style={{ color: s.tone.fg }}>{s.date}</span>
      </button>)}
      <div className="album-next">
        <StickerIcon paths={['M12 5v14', 'M5 12h14']} size={32} color="currentColor" />
        <span>Tu próxima estampa aparecerá aquí</span>
      </div>
    </section>)}
    <section style={studentCard} aria-labelledby="mascot-color-title">
      <h2 id="mascot-color-title" style={{ fontSize: '22px' }}>Elige el color de {APP_NAME}</h2>
      <p style={{ ...mutedText, margin: 0 }}>Una preferencia para acompañarte en tu espacio.</p>
      <div className="student-mascot-colors">{AXI_COLORS.map(([color, label]) => <button type="button" key={color} aria-pressed={axiColor === color} onClick={() => setAxiColor(color)} style={{ ...buttonStyle('secondary'), padding: '12px 8px', flexDirection: 'column', minHeight: '100px', border: `3px solid ${axiColor === color ? COLORS.primary : COLORS.border}` }}><Mascot size={62} color={color} animated={false} />{label}</button>)}</div>
    </section>
    <Link to="/alumno/resumen" style={{ ...buttonStyle('secondary'), alignSelf: 'flex-start' }}>Ver mi progreso</Link>
    {selected && <StickerCelebration key={selected.id} sticker={selected} axiColor={axiColor} onClose={close} />}
  </div>;
}

/** Repite la celebración de una estampa: ≤ 3 s, se puede saltar, sonido apagado por defecto, respeta reduced-motion. */
function StickerCelebration({ sticker: s, axiColor, onClose }) {
  const reducedMotion = useReducedMotion();
  const { sound, setSound } = useAppUi();
  const { supported, speak, stop } = useSpeech();
  const [playing, setPlaying] = useState(!reducedMotion);
  const closeRef = useRef(null);
  const speech = `${s.copy.headline} ${s.description ?? ''} ${APP_NAME} dice: ${s.copy.says}`;

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => setPlaying(false), CELEBRATION_MS);
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  useEffect(() => {
    if (sound) speak(speech, `achievement-${s.id}`, { toggle: false }); else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound]);
  useEffect(() => () => stop(), [stop]);

  return <div className={`album-celebrate ${playing ? 'is-playing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="album-cel-title">
    {playing && <button type="button" className="album-ctl album-skip" onClick={() => { setPlaying(false); closeRef.current?.focus({ preventScroll: true }); }}>Saltar animación</button>}
    {supported && <button type="button" className="album-ctl album-sound" aria-pressed={sound} onClick={() => setSound((v) => !v)}>
      <StickerIcon paths={['M4 9h4l5-4v14l-5-4H4z', sound ? 'M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12' : 'M16 9.5l5 5M21 9.5l-5 5']} size={20} color="currentColor" />
      {sound ? 'Sonido encendido' : 'Sonido apagado'}
    </button>}
    <div className="album-cel-body">
      <div className="album-cel-stage">
        <div className="album-rays" aria-hidden="true" />
        <div className="album-cel-sticker" style={{ background: s.tone.bg, borderColor: s.tone.border, boxShadow: `0 10px 0 ${s.tone.border}, 0 24px 50px rgba(0,0,0,.35)` }}>
          <span className="album-sticker-icon big"><StickerIcon paths={s.copy.icon} size={46} color={s.tone.fg} /></span>
          <span className="album-sticker-title font-display">{s.title}</span>
          {s.subtitle && <span className="album-sticker-sub">{s.subtitle}</span>}
          <span className="album-sticker-date" style={{ color: s.tone.fg }}>{s.date}</span>
        </div>
        <div className="album-cel-axi"><Mascot size={170} mood="celebra" color={axiColor} animated={playing} /></div>
      </div>
      <div className="album-cel-text">
        <span className="album-cel-chip" style={{ background: s.tone.bg, color: s.tone.fg }}>{s.tone.label}</span>
        <h2 id="album-cel-title" className="font-display">{s.copy.headline}</h2>
        {s.description && <p>{s.description}</p>}
        <p className="album-cel-says"><strong>{APP_NAME} dice:</strong> {s.copy.says}</p>
        <div className="album-cel-actions">
          <button type="button" ref={closeRef} className="album-ctl album-back" onClick={onClose}>Volver a mi álbum</button>
        </div>
      </div>
    </div>
  </div>;
}
