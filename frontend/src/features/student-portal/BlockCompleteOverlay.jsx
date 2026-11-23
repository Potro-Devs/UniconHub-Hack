import { Mascot } from '@/features/mascot';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { CelebrationConfetti } from './CelebrationConfetti';

/**
 * Celebración de cuestionario completado al terminar el bloque de ejercicios (~2.2 s).
 */
export function BlockCompleteOverlay({ axiColor, effortMsg, skip = false, onSkip, onContinue }) {
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '410px',
          background: 'radial-gradient(circle at 50% 42%, #2946B8 0%, #1B2F85 100%)',
          borderRadius: '30px',
          padding: '28px 24px 26px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '12px',
          position: 'relative',
          overflow: 'hidden',
          color: '#FFFFFF',
          boxShadow: '0 18px 44px -12px rgba(24, 32, 58, 0.45)',
          animation: reducedMotion ? 'none' : 'pop .4s ease-out both',
        }}
      >
        {motion && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              border: 0,
              background: 'rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
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

        <div
          style={{
            position: 'relative',
            width: '176px',
            height: '176px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '6px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: '#FCD34D',
              animation: motion ? 'axiSealPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '12px',
              borderRadius: '50%',
              background: '#FDE68A',
              opacity: 0.45,
            }}
          />
          {motion && <CelebrationConfetti variant="cuestionario" />}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Mascot size={146} mood="celebra" color={axiColor} animated={motion} />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            animation: motion ? 'axiTextRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.65s both' : 'none',
          }}
        >
          <div
            className="font-display"
            style={{ fontWeight: 800, fontSize: '26px', lineHeight: 1.15, color: '#FFFFFF' }}
          >
            ¡Terminaste el cuestionario!
          </div>

          <div style={{ fontSize: '15px', lineHeight: 1.4, color: '#DBEAFE', maxWidth: '30ch' }}>
            Qué gran esfuerzo hiciste hoy. Cada pregunta te ayuda a aprender más.
          </div>

          <div style={{ fontSize: '14px', fontWeight: 700, color: '#FDE68A' }}>{effortMsg}</div>

          <button
            type="button"
            onClick={onContinue}
            style={{
              marginTop: '8px',
              minHeight: '52px',
              padding: '0 28px',
              borderRadius: '999px',
              border: 0,
              background: '#FCD34D',
              color: '#1E1B2E',
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: 700,
              fontSize: '19px',
              lineHeight: 1,
              cursor: 'pointer',
              boxShadow: '0 4px 0 #D97706',
            }}
          >
            Ver mi avance
          </button>
        </div>
      </div>
    </div>
  );
}
