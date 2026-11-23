import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 09: Acceso del alumno mediante código de grupo.
 */
export function StudentCodeScreen() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { axiColor, code, setCode } = useAppUi();

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '20px 0',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <div
          className="font-display"
          style={{
            padding: '14px 20px',
            borderRadius: '22px',
            background: '#fff',
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: 1.3,
            textAlign: 'center',
            maxWidth: '340px',
          }}
        >
          ¡Hola! Soy {APP_NAME}. Escribe el código de tu grupo.
        </div>
        <Mascot size={180} color={axiColor} animate={!reducedMotion} />
      </div>

      <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-label="Código de grupo"
          style={{
            height: '72px',
            borderRadius: '20px',
            border: `3px solid ${COLORS.ink}`,
            background: '#fff',
            textAlign: 'center',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 800,
            fontSize: '34px',
            lineHeight: 1,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => navigate('/alumno/nombre')}
          style={{
            height: '64px',
            borderRadius: '20px',
            border: 0,
            background: COLORS.ink,
            color: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 5px 0 oklch(0.4 0.05 260)',
          }}
        >
          Entrar
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{
            border: 0,
            background: 'none',
            padding: '6px 0',
            fontSize: '14px',
            fontWeight: 700,
            color: '#3A4565',
            cursor: 'pointer',
          }}
        >
          ← Acceso docente
        </button>
      </div>
    </div>
  );
}
