import { useEffect, useRef, useState } from 'react';
import { COLORS } from '@/config/brand';
import { authApi } from '@/features/auth/auth.api';
import { readableTextOn } from '@/features/groups/groups.logic';
import { errorMessageOf } from '@/shared/api/client';
import { FormMessage } from '@/shared/components/FormMessage';
import {
  HELP_AFTER_FAILED_ATTEMPTS,
  addPick,
  emojiFor,
  instructionFor,
  isComplete,
  removeLastPick,
  samePicks,
} from './secretImage.logic';

/**
 * Paso 3 del acceso del alumno: confirmar que es él y tocar su imagen secreta.
 * - `verify`: toca su imagen (o sus 2 en orden).
 * - `setup`: la elige la primera vez y la confirma tocándola otra vez.
 * - `ask_teacher`: aún no tiene imagen y la docente no abrió la ventana.
 * Sin bloqueos ni castigos: tras varios intentos solo sugiere pedir ayuda (AGENTS.md §1.5).
 */
export function StudentSecretStep({ joinCode, selection, onSignedIn, onBack }) {
  const { step, imageCount: count, images, student } = selection;
  const [phase, setPhase] = useState('pick'); // 'pick' | 'confirm' (solo setup)
  const [picks, setPicks] = useState([]);
  const [firstPicks, setFirstPicks] = useState(null);
  const [failed, setFailed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const headingRef = useRef(null);

  useEffect(() => { headingRef.current?.focus(); }, []);

  const submit = async (chosen) => {
    setBusy(true);
    setMessage(null);
    try {
      onSignedIn(await authApi.confirmSecret(joinCode, student.id, chosen));
    } catch (err) {
      setBusy(false);
      setPicks([]);
      if (err?.code === 'SECRET_MISMATCH') setFailed((n) => n + 1);
      setMessage(errorMessageOf(err));
    }
  };

  const choose = (code) => {
    if (busy) return;
    setMessage(null);
    const next = addPick(picks, code, count);
    setPicks(next);
    if (!isComplete(next, count)) return;
    if (step === 'verify') { submit(next); return; }
    if (phase === 'pick') {
      setFirstPicks(next);
      setPicks([]);
      setPhase('confirm');
      return;
    }
    if (samePicks(next, firstPicks)) { submit(next); return; }
    setMessage('No coincidió. Vamos a elegirla de nuevo, con calma.');
    setPicks([]);
    setFirstPicks(null);
    setPhase('pick');
  };

  const card = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span
        aria-hidden="true"
        style={{
          width: '56px', height: '56px', flex: 'none', borderRadius: '50%', background: student.avatarColor,
          color: readableTextOn(student.avatarColor, COLORS.ink, COLORS.onPrimary),
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800,
        }}
      >
        {student.initials}
      </span>
      <h1 ref={headingRef} tabIndex={-1} className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '30px', lineHeight: 1.1, outline: 'none' }}>
        ¿Eres {student.displayName}?
      </h1>
    </div>
  );
  const backButton = (
    <button type="button" onClick={onBack} disabled={busy} style={{ alignSelf: 'flex-start', border: 0, background: 'none', minHeight: '44px', padding: '6px 0', fontSize: '15px', fontWeight: 700, color: '#3A4565', cursor: 'pointer' }}>
      ← No soy yo
    </button>
  );

  if (step === 'ask_teacher') {
    return (
      <div className="kid-access" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {card}
        <div role="status" style={{ padding: '18px', borderRadius: '18px', background: '#fff', fontSize: '18px', lineHeight: 1.45 }}>
          Todavía no tienes imagen secreta. <strong>Pídele ayuda a tu maestra o maestro</strong> para elegirla.
        </div>
        {backButton}
      </div>
    );
  }

  return (
    <div className="kid-access" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {card}
      <p aria-live="polite" style={{ margin: 0, fontSize: '18px', lineHeight: 1.4 }}>{instructionFor({ step, phase, count, picks })}</p>

      {/* Casillas: cuántas lleva (sin mostrar cuáles, por si alguien mira la pantalla). */}
      <div aria-hidden="true" style={{ display: 'flex', gap: '10px' }}>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} style={{ width: '44px', height: '44px', borderRadius: '14px', border: `2px solid ${COLORS.borderInput}`, background: i < picks.length ? COLORS.primary : '#fff' }} />
        ))}
      </div>

      <FormMessage message={message} />
      {failed >= HELP_AFTER_FAILED_ATTEMPTS && (
        <div role="status" style={{ padding: '12px 14px', borderRadius: '14px', background: '#fff', fontSize: '16px', lineHeight: 1.4 }}>
          ¿No la recuerdas? Está bien: <strong>pídele ayuda a tu maestra o maestro</strong>.
        </div>
      )}

      <div role="group" aria-label="Imágenes" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', maxWidth: '420px' }}>
        {images.map((img) => (
          <button
            key={img.code}
            type="button"
            onClick={() => choose(img.code)}
            disabled={busy}
            aria-label={img.label}
            style={{
              minHeight: '88px', borderRadius: '20px', border: `2px solid ${COLORS.border}`, background: '#fff',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
              cursor: busy ? 'wait' : 'pointer', fontSize: '14px', fontWeight: 700, color: COLORS.ink,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '38px', lineHeight: 1 }}>{emojiFor(img.code)}</span>
            {img.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        {picks.length > 0 && !busy && (
          <button type="button" className="kid-button" onClick={() => setPicks(removeLastPick(picks))} style={{ minHeight: '48px' }}>
            Borrar la última
          </button>
        )}
        {busy && <span role="status">Entrando…</span>}
      </div>
      {backButton}
    </div>
  );
}
