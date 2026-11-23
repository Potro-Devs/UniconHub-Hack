import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { DEMO_JOIN_CODE } from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useAppUi } from '@/shared/state/AppUiContext';
import { initialsOf } from '@/shared/state/session';
import { useSession } from '@/shared/state/SessionContext';
import { Toast } from './Toast';

const DOCENTE_NAV = [
  { id: 'grupos', path: '/docente/grupos', label: 'Grupos', short: 'Grupos', matches: ['/docente/grupos'] },
  { id: 'mapa', path: '/docente/mapa', label: 'Mapa del grupo', short: 'Mapa', matches: ['/docente/mapa', '/docente/perfil'] },
  { id: 'temario', path: '/docente/temario', label: 'Temario', short: 'Temario', matches: ['/docente/temario'] },
  { id: 'hoja', path: '/docente/hoja', label: 'Hojas impresas', short: 'Hojas', matches: ['/docente/hoja', '/docente/pistas'] },
  { id: 'captura', path: '/docente/captura', label: 'Captura', short: 'Captura', matches: ['/docente/captura'] },
];

const DIRECCION_NAV = [
  { id: 'escuela', path: '/direccion/escuela', label: 'Escuela', short: 'Escuela', matches: ['/direccion/escuela'] },
  { id: 'promover', path: '/direccion/promover', label: 'Promover grupos', short: 'Promover', matches: ['/direccion/promover'] },
  { id: 'traslados', path: '/direccion/traslados', label: 'Traslados', short: 'Traslados', matches: ['/direccion/traslados'] },
];

/**
 * Contenedor principal para las vistas de Docente y Dirección.
 * Replica la barra lateral en escritorio y navegación inferior en móvil.
 */
export function AppShellLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { wide, narrow } = useBreakpoint();
  const { toast } = useAppUi();
  const { session, signOut } = useSession();

  const isDir = pathname.startsWith('/direccion');
  const navDef = isDir ? DIRECCION_NAV : DOCENTE_NAV;

  const isActive = (item) =>
    item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const topA = isDir ? 'Dirección' : '3.º A';
  const topB = isDir ? '· Esc. Prim. Benito Juárez' : '· Ciclo 2026–2027';
  const userName = session?.user?.fullName ?? '';
  const userIni = initialsOf(userName);

  const logout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ height: '100vh', display: 'flex', background: COLORS.bg }}>
      {wide && (
        <aside
          style={{
            width: '232px',
            flex: 'none',
            background: '#fff',
            borderRight: `1px solid ${COLORS.border}`,
            display: 'flex',
            flexDirection: 'column',
            padding: '18px 14px',
            gap: '22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
            <Mascot size={42} />
            <div
              className="font-display"
              style={{ fontWeight: 800, fontSize: '24px', lineHeight: 1, paddingTop: '3px' }}
            >
              {APP_NAME}
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navDef.map((item) => {
              const active = isActive(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  style={{
                    textAlign: 'left',
                    border: 0,
                    borderRadius: '12px',
                    padding: '11px 12px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: active ? COLORS.primarySoftBg : 'transparent',
                    color: active ? 'oklch(0.4 0.2 268)' : COLORS.muted,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div style={{ marginTop: 'auto' }}>
            {!isDir && (
              <div
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  background: COLORS.bg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ fontSize: '12px', color: COLORS.muted }}>Código para tus alumnos</div>
                <div
                  className="font-display"
                  style={{ fontWeight: 800, fontSize: '24px', lineHeight: 1.1, letterSpacing: '.06em' }}
                >
                  {DEMO_JOIN_CODE}
                </div>
                <div style={{ fontSize: '12px', color: COLORS.muted }}>
                  Entran sin correo: código + su nombre.
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate(isDir ? '/docente/grupos' : '/direccion/escuela')}
              style={{
                marginTop: '10px',
                width: '100%',
                textAlign: 'left',
                border: 0,
                background: 'none',
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: COLORS.primaryText,
                cursor: 'pointer',
              }}
            >
              {isDir ? '← Volver a vista Docente' : 'Vista Dirección (Roadmap) →'}
            </button>

            <button
              type="button"
              onClick={logout}
              style={{
                marginTop: '2px',
                width: '100%',
                textAlign: 'left',
                border: 0,
                background: 'none',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '14px',
                color: COLORS.muted,
                cursor: 'pointer',
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: '58px',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '0 18px',
            background: '#fff',
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          {narrow && <Mascot size={36} />}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: COLORS.bg,
              fontSize: '14px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {topA}
            <span style={{ fontWeight: 400, color: COLORS.muted }}>{topB}</span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {wide && <div style={{ fontSize: '14px', color: COLORS.muted }}>{userName}</div>}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'oklch(0.88 0.08 268)',
                color: 'oklch(0.35 0.18 268)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              {userIni}
            </div>
            {!wide && (
              <button
                type="button"
                onClick={logout}
                style={{
                  minHeight: '44px',
                  padding: '0 10px',
                  border: 0,
                  borderRadius: '12px',
                  background: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: COLORS.muted,
                  cursor: 'pointer',
                }}
              >
                Salir
              </button>
            )}
          </div>
        </header>

        <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div
            style={{
              maxWidth: '1240px',
              margin: '0 auto',
              padding: wide ? '28px 32px 56px' : '18px 14px 32px',
            }}
          >
            <Outlet />
          </div>
        </main>

        {narrow && (
          <nav
            style={{
              flex: 'none',
              display: 'flex',
              background: '#fff',
              borderTop: `1px solid ${COLORS.border}`,
              padding: '6px 6px 10px',
            }}
          >
            {navDef.map((item) => {
              const active = isActive(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  style={{
                    flex: 1,
                    minHeight: '48px',
                    border: 0,
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: active ? COLORS.primarySoftBg : 'transparent',
                    color: active ? 'oklch(0.4 0.2 268)' : COLORS.muted,
                  }}
                >
                  {item.short}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <Toast message={toast} hasBottomNav />
    </div>
  );
}
