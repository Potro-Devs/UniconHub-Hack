import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { Toast } from '@/shared/components/Toast';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Pantalla 00: Acceso docente, botones de acceso rápido demo y entrada a portal alumno.
 */
export function LoginScreen() {
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const { loginEmail, setLoginEmail, loginPass, setLoginPass, toast } = useAppUi();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexWrap: 'wrap',
        background: COLORS.bg,
      }}
    >
      {/* Panel izquierdo de bienvenida */}
      <div
        style={{
          flex: '1 1 360px',
          minHeight: narrow ? '340px' : 'auto',
          background: COLORS.primary,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          padding: '36px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background: 'oklch(0.55 0.2 268)',
            top: '-150px',
            left: '-120px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'oklch(0.46 0.19 268)',
            bottom: '-80px',
            right: '-60px',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Mascot size={210} animate={!reducedMotion} />
          <div className="font-display" style={{ fontWeight: 800, fontSize: '60px', lineHeight: 1 }}>
            {APP_NAME}
          </div>
          <div
            style={{
              fontSize: '18px',
              maxWidth: '30ch',
              textAlign: 'center',
              lineHeight: 1.4,
              textWrap: 'pretty',
            }}
          >
            Saber en qué punto va cada alumno, y que su diagnóstico lo acompañe de grado en grado.
          </div>
        </div>
      </div>

      {/* Panel derecho de inicio de sesión */}
      <div
        style={{
          flex: '1 1 360px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '32px', lineHeight: 1.1 }}>
            Entra como docente
          </h1>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
            Correo
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={{
                height: '50px',
                borderRadius: '14px',
                border: `1px solid ${COLORS.borderInput}`,
                background: '#fff',
                padding: '0 14px',
                fontSize: '16px',
                fontWeight: 400,
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
            Contraseña
            <input
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              style={{
                height: '50px',
                borderRadius: '14px',
                border: `1px solid ${COLORS.borderInput}`,
                background: '#fff',
                padding: '0 14px',
                fontSize: '16px',
                fontWeight: 400,
                outline: 'none',
              }}
            />
          </label>

          <button
            type="button"
            className="axi-btn-primary"
            onClick={() => navigate('/docente/grupos')}
            style={{
              height: '54px',
              borderRadius: '16px',
              border: 0,
              background: COLORS.primary,
              color: '#fff',
              fontSize: '17px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Entrar
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: COLORS.muted, fontSize: '13px' }}>
            <span style={{ flex: 1, height: '1px', background: COLORS.border }} />
            o
            <span style={{ flex: 1, height: '1px', background: COLORS.border }} />
          </div>

          <button
            type="button"
            onClick={() => navigate('/docente/grupos')}
            style={{
              height: '50px',
              borderRadius: '16px',
              border: `1px solid ${COLORS.borderInput}`,
              background: '#fff',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Acceso de demostración
          </button>

          <button
            type="button"
            onClick={() => navigate('/alumno/codigo')}
            style={{
              border: 0,
              background: 'none',
              padding: '4px 0',
              fontSize: '14px',
              fontWeight: 700,
              color: COLORS.primaryText,
              cursor: 'pointer',
            }}
          >
            ¿Eres alumno? Entra con el código de tu grupo →
          </button>

          <button
            type="button"
            onClick={() => navigate('/direccion/escuela')}
            style={{
              border: 0,
              background: 'none',
              padding: '2px 0',
              fontSize: '13px',
              color: COLORS.muted,
              cursor: 'pointer',
            }}
          >
            Vista Dirección (Roadmap) →
          </button>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}
