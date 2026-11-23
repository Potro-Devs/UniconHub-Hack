import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { Toast } from '@/shared/components/Toast';
import { STUDENTS } from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useAppUi } from '@/shared/state/AppUiContext';

/**
 * Contenedor del portal del alumno con fondo cielo y barra superior con Axi.
 */
export function StudentLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { narrow } = useBreakpoint();
  const { axiColor, sound, setSound, stuIdx, toast } = useAppUi();

  const stu = stuIdx != null ? STUDENTS[stuIdx] : null;
  const showBadgesBtn =
    Boolean(stu) && pathname !== '/alumno/codigo' && pathname !== '/alumno/nombre';

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

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setSound((prev) => !prev)}
              style={{
                height: '40px',
                padding: '0 12px',
                borderRadius: '999px',
                border: 0,
                background: 'rgba(255,255,255,.7)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {sound ? 'Sonido: sí' : 'Sonido: no'}
            </button>

            {showBadgesBtn && (
              <button
                type="button"
                onClick={() => navigate('/alumno/sellos')}
                style={{
                  height: '40px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  border: 0,
                  background: '#fff',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {stu.short} · sellos
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
