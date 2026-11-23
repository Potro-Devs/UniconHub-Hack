import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { Toast } from '@/shared/components/Toast';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';

const pillStyle = {
  minHeight: '44px',
  padding: '0 14px',
  borderRadius: '999px',
  border: 0,
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
};

/**
 * Contenedor del portal del alumno con fondo cielo y barra superior con Axi.
 */
export function StudentLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const { axiColor, sound, setSound, toast, resetStudentSession, setJoinRoster } = useAppUi();
  const { session, signOut } = useSession();

  const student = session?.role === 'student' ? session.student : null;
  const showBadgesBtn =
    Boolean(student) && pathname !== '/alumno/codigo' && pathname !== '/alumno/nombre';

  // En computadoras compartidas, "Salir" deja lista la pantalla para el siguiente alumno.
  const exit = () => {
    signOut();
    resetStudentSession(0);
    setJoinRoster(null);
    navigate('/alumno/codigo', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'oklch(0.93 0.05 225)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'fixed',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'oklch(0.9 0.06 225)',
          top: '-180px',
          right: '-140px',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'oklch(0.95 0.06 92)',
          bottom: '-110px',
          left: '-90px',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: '780px',
          margin: '0 auto',
          padding: narrow ? '16px 16px 28px' : '24px 28px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: '100vh',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Mascot size={50} color={axiColor} />
          <div
            className="font-display"
            style={{ fontWeight: 800, fontSize: '26px', lineHeight: 1, paddingTop: '3px' }}
          >
            {APP_NAME}
          </div>

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              aria-pressed={sound}
              onClick={() => setSound((prev) => !prev)}
              style={{ ...pillStyle, padding: '0 12px', background: 'rgba(255,255,255,.7)', fontSize: '13px' }}
            >
              {sound ? 'Sonido: sí' : 'Sonido: no'}
            </button>

            {showBadgesBtn && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/alumno/inicio')}
                  style={{ ...pillStyle, background: '#fff' }}
                >
                  ← Inicio
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/alumno/logros')}
                  style={{ ...pillStyle, background: '#fff' }}
                >
                  Mis logros
                </button>
              </>
            )}

            {student && (
              <button type="button" onClick={exit} style={{ ...pillStyle, background: 'rgba(255,255,255,.7)' }}>
                Salir
              </button>
            )}
          </div>
        </header>

        <Outlet />
      </div>

      <Toast message={toast} />
    </div>
  );
}
