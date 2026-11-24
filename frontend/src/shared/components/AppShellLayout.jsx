import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { InterfaceIcon } from './InterfaceIcon';
import { MotionToggle } from './MotionToggle';
import { JoinCode } from '@/features/groups/JoinCode';
import { schoolYearToDisplay, sortGroups } from '@/features/groups/groups.logic';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
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
  { id: 'panel', path: '/direccion/panel', label: 'Panel de la escuela', short: 'Panel', matches: ['/direccion/panel'] },
  { id: 'escuela', path: '/direccion/escuela', label: 'Escuela', short: 'Escuela', matches: ['/direccion/escuela'] },
  { id: 'promover', path: '/direccion/promover', label: 'Promover grupos', short: 'Promover', matches: ['/direccion/promover'] },
  { id: 'traslados', path: '/direccion/traslados', label: 'Traslados', short: 'Traslados', matches: ['/direccion/traslados'] },
];

/** Vistas que todavía usan datos locales del prototipo. */
const SAMPLE_DATA_PATHS = ['/docente/temario', '/docente/hoja', '/docente/pistas', '/docente/captura'];

const headerChip = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '44px',
  padding: '6px 12px',
  borderRadius: '999px',
  background: COLORS.bg,
  fontSize: '15px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/** Grupo activo en el encabezado: selector con 2+, texto con 1, `Sin grupo` con 0. */
function ActiveGroupSwitcher() {
  const navigate = useNavigate();
  const { status, groups, activeGroup, setActiveGroupId } = useTeacherGroups();

  if (status === 'loading' && !groups.length) {
    return <div style={{ ...headerChip, color: COLORS.muted, fontWeight: 400 }}>Cargando grupo…</div>;
  }
  if (!groups.length) {
    if (status === 'error') return <div style={{ ...headerChip, color: COLORS.muted, fontWeight: 400 }}>Grupo no disponible</div>;
    return (
      <button
        type="button"
        onClick={() => navigate('/docente/grupos/nuevo')}
        style={{ ...headerChip, border: `1px dashed ${COLORS.borderDashed}`, cursor: 'pointer', color: COLORS.primaryText }}
      >
        Sin grupo · Crear grupo
      </button>
    );
  }
  const year = schoolYearToDisplay(activeGroup.schoolYear);
  if (groups.length === 1) {
    return (
      <div style={headerChip}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeGroup.name} <span style={{ fontWeight: 400, color: COLORS.muted }}>· Ciclo {year}</span>
        </span>
      </div>
    );
  }
  return (
    <select
      value={activeGroup.id}
      onChange={(e) => setActiveGroupId(e.target.value)}
      aria-label={`Grupo activo: ${activeGroup.name}, ciclo ${year}. Cambiar grupo`}
      style={{
        ...headerChip,
        display: 'block',
        border: `1px solid ${COLORS.borderInput}`,
        paddingRight: '28px',
        cursor: 'pointer',
        width: 'auto',
      }}
    >
      {sortGroups(groups).map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} · Ciclo {schoolYearToDisplay(g.schoolYear)}
        </option>
      ))}
    </select>
  );
}

/** Código del grupo activo en la barra lateral. */
function SidebarJoinCode() {
  const navigate = useNavigate();
  const { status, activeGroup } = useTeacherGroups();
  return (
    <div
      style={{
        padding: '14px',
        borderRadius: '16px',
        background: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ fontSize: '13px', color: COLORS.muted }}>Código para tus alumnos</div>
      {activeGroup ? (
        <>
          <JoinCode code={activeGroup.joinCode} size={28} buttonHeight={44} label={`Código de ${activeGroup.name}`} />
          <div style={{ fontSize: '13px', color: COLORS.muted }}>Código de {activeGroup.name}</div>
        </>
      ) : status === 'loading' ? (
        <div className="font-display" aria-label="Cargando código" style={{ fontWeight: 800, fontSize: '28px' }}>
          —
        </div>
      ) : (
        <>
          <div style={{ fontSize: '14px', lineHeight: 1.4 }}>Crea un grupo para obtener su código.</div>
          <button
            type="button"
            onClick={() => navigate('/docente/grupos/nuevo')}
            style={{ alignSelf: 'flex-start', minHeight: '44px', border: 0, background: 'none', padding: 0, fontSize: '15px', fontWeight: 700, color: COLORS.primaryText, cursor: 'pointer' }}
          >
            Crear grupo
          </button>
        </>
      )}
    </div>
  );
}

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

  const isDirector = session?.role === 'director';
  const isDir = isDirector || pathname.startsWith('/direccion');
  // Dirección solo tiene su panel con datos reales; la docente ve la vista previa (Roadmap) sin el panel.
  const navDef = isDirector
    ? DIRECCION_NAV.filter((item) => item.id === 'panel')
    : isDir ? DIRECCION_NAV.filter((item) => item.id !== 'panel') : DOCENTE_NAV;

  const isActive = (item) =>
    item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const isSampleView = SAMPLE_DATA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const userName = session?.user?.fullName ?? '';
  const userIni = initialsOf(userName);

  const logout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="teacher-shell" style={{ height: '100vh', display: 'flex', background: COLORS.bg }}>
      <a className="skip-link" href="#teacher-content">Ir al contenido</a>
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
                  aria-current={active ? 'page' : undefined}
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
                  <InterfaceIcon name={({ panel: 'map', grupos: 'groups', mapa: 'map', temario: 'book', hoja: 'paper', captura: 'pencil', escuela: 'groups', promover: 'star', traslados: 'paper' })[item.id]} size={22} />{item.label}
                </button>
              );
            })}
          </nav>

          <div style={{ marginTop: 'auto' }}>
            <MotionToggle />
            {!isDir && <SidebarJoinCode />}

            {!isDirector && <button
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
            </button>}

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
          <div style={{ minWidth: 0, flex: '0 1 auto', display: 'flex' }}>
            {isDir ? (
              <div style={headerChip}>
                Dirección
                {!isDirector && <span style={{ fontWeight: 400, color: COLORS.muted }}>· Vista previa</span>}
              </div>
            ) : (
              <ActiveGroupSwitcher />
            )}
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

        <main id="teacher-content" tabIndex={-1} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div
            style={{
              maxWidth: '1240px',
              margin: '0 auto',
              padding: wide ? '28px 32px 56px' : '18px 14px 32px',
            }}
          >
            {!wide && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}><MotionToggle /></div>}
            {isSampleView && (
              <div
                style={{
                  display: 'inline-block',
                  marginBottom: '14px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.surface,
                  color: COLORS.muted,
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                Vista con datos de ejemplo
              </div>
            )}
            <Outlet />
          </div>
        </main>

        {narrow && navDef.length > 1 && (
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
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(item.path)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
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
                  <InterfaceIcon name={({ panel: 'map', grupos: 'groups', mapa: 'map', temario: 'book', hoja: 'paper', captura: 'pencil', escuela: 'groups', promover: 'star', traslados: 'paper' })[item.id]} size={20} />{item.short}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <Toast message={toast} hasBottomNav={narrow && navDef.length > 1} />
    </div>
  );
}
