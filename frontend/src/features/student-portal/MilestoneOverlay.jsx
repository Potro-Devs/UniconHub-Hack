import { COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { CelebrationConfetti } from './CelebrationConfetti';

/**
 * Pantalla 08b: Celebración de hito / sello Dominado.
 */
export function MilestoneOverlay({ axiColor, skip, onSkip, onViewBadges }) {
  const reducedMotion = useReducedMotion();
  const motion = !reducedMotion && !skip;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'oklch(0.42 0.19 268)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px',
        overflow: 'auto',
      }}
    >
      {motion && (
        <button
          type="button"
          onClick={onSkip}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            border: 0,
            background: 'rgba(255,255,255,.18)',
            color: '#fff',
            borderRadius: '999px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          Saltar animación
        </button>
      )}

      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          margin: 'auto',
          color: '#fff',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          animation: reducedMotion ? 'none' : 'pop .45s ease-out both',
        }}
      >
        <div style={{ position: 'relative', width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'oklch(0.85 0.15 88)' }} />
          <div
            style={{
              position: 'absolute',
              inset: '14px',
              borderRadius: '50%',
              border: '4px dashed rgba(255,255,255,.9)',
            }}
          />
          {motion && <CelebrationConfetti variant="hito" />}
          <div style={{ position: 'relative' }}>
            <Mascot size={180} mood="celebra" color={axiColor} animated={motion} />
          </div>
        </div>

        <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>
          Hito · sello nuevo
        </div>

        <div className="font-display" style={{ fontWeight: 800, fontSize: '40px', lineHeight: 1.05 }}>
          ¡Dominaste Resolución de problemas!
        </div>

        <div style={{ fontSize: '19px', lineHeight: 1.4, maxWidth: '32ch' }}>
          Ya resuelves problemas con números hasta 1 000 sin ayuda.
        </div>

        <span
          style={{
            padding: '7px 14px',
            borderRadius: '999px',
            background: '#fff',
            color: 'oklch(0.36 0.18 268)',
            fontSize: '16px',
            fontWeight: 700,
          }}
        >
          Dominado · 88%
        </span>

        <button
          type="button"
          onClick={onViewBadges}
          style={{
            marginTop: '6px',
            width: '100%',
            maxWidth: '320px',
            height: '62px',
            borderRadius: '20px',
            border: 0,
            background: '#fff',
            color: COLORS.ink,
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '21px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 5px 0 oklch(0.32 0.15 268)',
          }}
        >
          Ver mis logros
        </button>
      </div>
    </div>
  );
}
