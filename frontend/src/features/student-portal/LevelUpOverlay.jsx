import { COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { CelebrationConfetti } from './CelebrationConfetti';

/**
 * Pantalla 08: Celebración de subida de nivel con control de movimiento y salto.
 */
export function LevelUpOverlay({ axiColor, skip, onSkip, onContinue }) {
  const reducedMotion = useReducedMotion();
  const motion = !reducedMotion && !skip;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgba(24,32,58,.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          margin: 'auto',
          background: '#fff',
          borderRadius: '34px',
          padding: '26px 24px 24px',
          textAlign: 'center',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: reducedMotion ? 'none' : 'pop .45s ease-out both',
        }}
      >
        {motion && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              border: 0,
              background: COLORS.bg,
              borderRadius: '999px',
              padding: '7px 12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              zIndex: 2,
            }}
          >
            Saltar animación
          </button>
        )}

        <div style={{ position: 'relative', height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              position: 'absolute',
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              background: 'oklch(0.95 0.06 92)',
            }}
          />
          {motion && <CelebrationConfetti variant="nivel" />}
          <div style={{ position: 'relative' }}>
            <Mascot size={150} mood="celebra" color={axiColor} animated={motion} />
          </div>
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: COLORS.primaryText,
          }}
        >
          Subiste de nivel
        </div>

        <div className="font-display" style={{ fontWeight: 800, fontSize: '32px', lineHeight: 1.1 }}>
          ¡Subiste en Fracciones!
        </div>

        <div style={{ fontSize: '18px', lineHeight: 1.35 }}>
          Ya reconoces cuántas partes forman un entero.
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            fontSize: '15px',
            fontWeight: 700,
            marginTop: '4px',
          }}
        >
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'oklch(0.94 0.08 90)',
              color: 'oklch(0.4 0.09 75)',
            }}
          >
            En proceso · 44%
          </span>
          <span>→</span>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'oklch(0.91 0.07 165)',
              color: 'oklch(0.38 0.1 165)',
            }}
          >
            Logrado · 58%
          </span>
        </div>

        <div style={{ height: '16px', borderRadius: '999px', background: '#E6EBF3', overflow: 'hidden', margin: '4px 0 6px' }}>
          <div
            style={{
              height: '100%',
              width: '58%',
              borderRadius: '999px',
              background: 'oklch(0.68 0.14 165)',
              animation: motion ? 'grow 1s ease-out .6s both' : 'none',
            }}
          />
        </div>

        <button
          type="button"
          onClick={onContinue}
          style={{
            height: '60px',
            borderRadius: '20px',
            border: 0,
            background: COLORS.ink,
            color: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '21px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 5px 0 oklch(0.4 0.05 260)',
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
