import { useEffect, useRef, useState } from 'react';
import { COLORS } from '@/config/brand';
import { buttonStyle } from '@/shared/styles/ui';
import { formatJoinCode, joinCodeForCopy } from './groups.logic';

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Sin permiso de portapapeles: se intenta el método clásico.
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Código de grupo en 3 + 3 con botón `Copiar` (copia sin espacio y lo anuncia con `aria-live`).
 *
 * @param {{ code: string, size?: number, buttonHeight?: number, label?: string }} props
 */
export function JoinCode({ code, size = 32, buttonHeight = 48, label = 'Código del grupo' }) {
  const [state, setState] = useState('idle');
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onCopy = async () => {
    const ok = await copyText(joinCodeForCopy(code));
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState('idle'), 2500);
  };

  const formatted = formatJoinCode(code);
  const spoken = joinCodeForCopy(code).split('').join(' ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
      <span
        className="font-display"
        aria-label={`${label}: ${spoken}`}
        style={{
          fontWeight: 800,
          fontSize: `${size}px`,
          lineHeight: 1.1,
          letterSpacing: '.12em',
          whiteSpace: 'nowrap',
          color: COLORS.ink,
        }}
      >
        {formatted}
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={state === 'copied' ? 'Copiado' : `Copiar ${label.toLowerCase()}`}
        style={{ ...buttonStyle('secondary'), minHeight: `${buttonHeight}px`, minWidth: '44px', padding: '0 14px', fontSize: '15px' }}
      >
        {state === 'copied' ? '✓ Copiado' : 'Copiar'}
      </button>
      <span aria-live="polite" className="axi-sr-only">
        {state === 'copied' ? 'Código copiado' : state === 'failed' ? 'No se pudo copiar. Escribe el código a mano.' : ''}
      </span>
    </div>
  );
}
