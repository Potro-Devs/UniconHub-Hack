import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { Toast } from '@/shared/components/Toast';
import { DEMO_JOIN_CODE } from '@/shared/data/seedData';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useAppUi } from '@/shared/state/AppUiContext';
import { useSession } from '@/shared/state/SessionContext';
import { getQuizItems } from './studentPortalStats';

const NAV_ITEMS = [
  { to: '/alumno/inicio', label: 'Inicio', mobileLabel: 'Inicio', icon: 'home' },
  { to: '/alumno/clases', label: 'Mis clases', mobileLabel: 'Clases', icon: 'classes' },
  { to: '/alumno/progreso', label: 'Mi progreso', mobileLabel: 'Progreso', icon: 'progress' },
  { to: '/alumno/logros', label: 'Mis logros', mobileLabel: 'Logros', icon: 'achievements' },
];

function NavIcon({ kind, active }) {
  const stroke = active ? COLORS.primarySoftFg : COLORS.muted;
  const props = {
    width: 19,
    height: 19,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    style: { flexShrink: 0 },
  };

  if (kind === 'home') {
    return (
      <svg {...props}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
      </svg>
    );
  }
  if (kind === 'classes') {
    return (
      <svg {...props}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v15H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M8 8h7" />
        <path d="M8 12h5" />
      </svg>
    );
  }
  if (kind === 'progress') {
    return (
      <svg {...props}>
        <path d="M4 19h16" />
        <path d="M6 15l4-4 3 2.5L19 7" />
        <path d="M15 7h4v4" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="m12 3 2.6 5.3 5.9.8-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.8z" />
    </svg>
  );
}

/**
 * Contenedor principal autenticado del portal del estudiante:
 * barra lateral en escritorio y navegación inferior táctil en móvil.
 */
export function StudentShellLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { narrow, wide } = useBreakpoint();
  const { session, signOut } = useSession();
  const {
    axiColor,
    joinCode,
    completedQuizzes,
    toast,
    resetStudentSession,
    setJoinRoster,
  } = useAppUi();

  const student = session?.student ?? {
    displayName: 'Sofía Ramírez',
    initials: 'SR',
    avatarColor: COLORS.primary,
  };
  const group = session?.group;
  const groupLabel =
    group?.grade && group?.section
      ? `${group.grade}.º ${group.section} · Primaria`
      : group?.name || '3.º A · Primaria';
  const activeCode = joinCode || DEMO_JOIN_CODE;
  const pendingCount = getQuizItems(completedQuizzes).filter(
    (q) => q.resolvedStatus === 'pending_screen',
  ).length;

  const isActive = (to) => pathname === to || pathname.startsWith(`${to}/`);

  const handleSignOut = () => {
    signOut();
    resetStudentSession(0);
    setJoinRoster(null);
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
        background: COLORS.bg,
        color: COLORS.ink,
      }}
    >
      {wide && (
        <aside
          aria-label="Navegación del estudiante"
          style={{
            width: '232px',
            flex: 'none',
            overflowY: 'auto',
            background: '#fff',
            borderRight: `1px solid ${COLORS.border}`,
            display: 'flex',
            flexDirection: 'column',
            padding: '18px 14px',
            gap: '16px',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/alumno/inicio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'none',
              border: 0,
              padding: '4px 6px',
              minHeight: '44px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Mascot size={36} color={axiColor} />
            <span
              className="font-display"
              style={{ fontWeight: 800, fontSize: '24px', lineHeight: 1, color: COLORS.ink }}
            >
              {APP_NAME}
            </span>
          </button>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.to);
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    minHeight: '46px',
                    padding: '0 12px',
                    borderRadius: '12px',
                    border: 0,
                    background: active ? COLORS.primarySoftBg : 'transparent',
                    color: active ? COLORS.primarySoftFg : COLORS.ink,
                    fontWeight: active ? 700 : 600,
                    fontSize: '15px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <NavIcon kind={item.icon} active={active} />
                  <span>{item.label}</span>
                  {item.icon === 'home' && pendingCount > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        minWidth: '22px',
                        height: '22px',
                        padding: '0 7px',
                        borderRadius: '999px',
                        background: COLORS.primary,
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                background: COLORS.surfaceSubtle,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '14px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Tu grupo principal
              </div>
              <div className="font-display" style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.2 }}>
                {groupLabel}
              </div>
              <div style={{ fontSize: '13px', color: COLORS.muted }}>
                Código <strong style={{ color: COLORS.ink }}>{activeCode}</strong>
              </div>
              <button
                type="button"
                onClick={() => navigate('/alumno/clases')}
                style={{
                  marginTop: '6px',
                  minHeight: '36px',
                  padding: '4px 0',
                  border: 0,
                  background: 'none',
                  color: COLORS.primaryText,
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                + Ingresar otro código
              </button>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '12px',
                border: `1px solid ${COLORS.border}`,
                background: '#fff',
                color: COLORS.muted,
                fontSize: '14px',
                fontWeight: 700,
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
            minHeight: '58px',
            flex: 'none',
            background: '#fff',
            borderBottom: `1px solid ${COLORS.border}`,
            padding: narrow ? '10px 14px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {narrow ? (
            <button
              type="button"
              onClick={() => navigate('/alumno/inicio')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 0,
                background: 'none',
                padding: '2px 0',
                minHeight: '44px',
                cursor: 'pointer',
              }}
            >
              <Mascot size={34} color={axiColor} />
              <span
                className="font-display"
                style={{ fontWeight: 800, fontSize: '20px', lineHeight: 1, color: COLORS.ink }}
              >
                {APP_NAME}
              </span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: COLORS.primarySoftBg,
                  color: COLORS.primarySoftFg,
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {groupLabel}
              </span>
              <span style={{ fontSize: '13px', color: COLORS.muted, fontWeight: 600 }}>
                Ciclo {group?.schoolYear || '2026–2027'}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px 4px 5px',
                borderRadius: '999px',
                background: COLORS.surfaceSubtle,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: student.avatarColor || COLORS.primary,
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {student.initials || 'SR'}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: COLORS.ink,
                  maxWidth: narrow ? '130px' : '220px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {student.displayName}
              </span>
            </div>

            {narrow && (
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  border: `1px solid ${COLORS.border}`,
                  background: '#fff',
                  color: COLORS.muted,
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Salir
              </button>
            )}
          </div>
        </header>

        <main
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            width: '100%',
            padding: narrow ? '16px 14px 28px' : '24px 28px 36px',
          }}
        >
          <div style={{ maxWidth: '1040px', margin: '0 auto', width: '100%' }}>
            <Outlet />
          </div>
        </main>

        {narrow && (
          <nav
            aria-label="Menú inferior del estudiante"
            style={{
              flex: 'none',
              background: '#fff',
              borderTop: `1px solid ${COLORS.border}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              padding: '4px 6px',
            }}
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.to);
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    minHeight: '54px',
                    border: 0,
                    borderRadius: '12px',
                    background: active ? COLORS.primarySoftBg : 'transparent',
                    color: active ? COLORS.primarySoftFg : COLORS.muted,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <NavIcon kind={item.icon} active={active} />
                  <span>{item.mobileLabel}</span>
                  {item.icon === 'home' && pendingCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: 'calc(50% - 20px)',
                        minWidth: '18px',
                        height: '18px',
                        padding: '0 5px',
                        borderRadius: '999px',
                        background: COLORS.primary,
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <Toast message={toast} hasBottomNav={narrow} />
    </div>
  );
}
