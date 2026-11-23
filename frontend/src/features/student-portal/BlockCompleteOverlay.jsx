import { COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';

/**
 * Celebración breve al terminar el bloque de ejercicios.
 */
export function BlockCompleteOverlay({ axiColor, effortMsg, onContinue }) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgba(24,32,58,.35)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#fff',
          borderRadius: '28px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          animation: reducedMotion ? 'none' : 'rise .3s ease-out both',
        }}
      >
        <Mascot size={84} color={axiColor} />
        <div style={{ flex: '1 1 200px' }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '24px', lineHeight: 1.15 }}>
            Terminaste los 4 ejercicios
          </div>
          <div style={{ fontSize: '16px', marginTop: '4px' }}>{effortMsg}</div>
        </div>
        <button
          type="button"
          onClick={onContinue}
          style={{
            width: '100%',
            height: '56px',
            borderRadius: '18px',
            border: 0,
            background: COLORS.ink,
            color: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          Ver mi avance
        </button>
      </div>
    </div>
  );
}
