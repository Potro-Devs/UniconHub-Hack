import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { JoinCode } from '@/features/groups/JoinCode';
import { sortGroups, schoolYearToDisplay } from '@/features/groups/groups.logic';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { useSession } from '@/shared/state/SessionContext';
import { buttonStyle, card, mutedText, pill, sectionTitle } from '@/shared/styles/ui';
import { TomorrowPlanCard } from './TomorrowPlanCard';

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
  gap: '16px',
};

function todayLabel() {
  const text = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function NextStepBanner({ group }) {
  const navigate = useNavigate();
  // Respaldo cuando aún no hay plan con actividad (ver TomorrowPlanCard).
  const next =
    group.studentCount === 0
      ? {
          title: 'Agrega a tus alumnos',
          body: `Pega la lista de ${group.name} para que puedan entrar con el código del grupo.`,
          cta: 'Agregar alumnos',
          to: `/docente/grupos/${group.id}`,
        }
      : {
          title: 'Marca en qué van del temario',
          body: `Así podrás elegir qué evaluar con ${group.name}.`,
          cta: 'Ir al temario',
          to: '/docente/temario',
        };

  return (
    <section
      aria-labelledby="next-step-title"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '16px',
        padding: '22px 24px',
        borderRadius: '24px',
        background: COLORS.primary,
        color: COLORS.onPrimary,
      }}
    >
      <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Siguiente paso
        </div>
        <h2 id="next-step-title" className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: '24px', lineHeight: 1.2 }}>
          {next.title}
        </h2>
        <div style={{ fontSize: '16px', lineHeight: 1.4 }}>{next.body}</div>
      </div>
      <button
        type="button"
        onClick={() => navigate(next.to)}
        style={{ ...buttonStyle('secondary'), border: 0, color: COLORS.primarySoftFg }}
      >
        {next.cta}
      </button>
    </section>
  );
}

function GroupCard({ group, isActive, onUse }) {
  const navigate = useNavigate();
  return (
    <article className="teacher-group-card" style={card} aria-labelledby={`group-${group.id}-name`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 id={`group-${group.id}-name`} className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '34px', lineHeight: 1 }}>
            {group.name}
          </h3>
          <div style={{ ...mutedText, marginTop: '6px' }}>
            Ciclo {schoolYearToDisplay(group.schoolYear)} · Fase {group.phase}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{group.studentCount} alumnos</div>
        </div>
        {isActive && <span style={pill}>✓ Grupo activo</span>}
      </div>

      <div>
        <div style={{ fontSize: '14px', color: COLORS.muted, marginBottom: '4px' }}>Código para tus alumnos</div>
        <JoinCode code={group.joinCode} size={26} label={`Código de ${group.name}`} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 'auto' }}>
        <button type="button" onClick={() => navigate(`/docente/grupos/${group.id}`)} style={{ ...buttonStyle('primary'), flex: '1 1 140px' }}>
          Ver grupo
        </button>
        {!isActive && (
          <button type="button" onClick={() => onUse(group.id)} style={{ ...buttonStyle('secondary'), flex: '1 1 140px' }}>
            Usar este grupo
          </button>
        )}
      </div>
    </article>
  );
}

function SkeletonCard() {
  const bar = (w, h) => <div className="axi-skeleton" style={{ width: w, height: h, borderRadius: '10px', background: COLORS.skeleton }} />;
  return (
    <div aria-hidden="true" style={{ ...card, minHeight: '220px' }}>
      {bar('40%', '34px')}
      {bar('70%', '16px')}
      {bar('55%', '28px')}
      {bar('100%', '48px')}
    </div>
  );
}

function CreateGroupTile() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="axi-dashed-hover"
      onClick={() => navigate('/docente/grupos/nuevo')}
      style={{
        minHeight: '200px',
        border: `2px dashed ${COLORS.borderDashed}`,
        borderRadius: '22px',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        color: COLORS.muted,
      }}
    >
      <span aria-hidden="true" className="font-display" style={{ fontWeight: 700, fontSize: '34px', lineHeight: 1 }}>
        +
      </span>
      <span style={{ fontSize: '16px', fontWeight: 700 }}>Crear grupo</span>
      <span style={{ fontSize: '15px' }}>Grado, grupo y ciclo</span>
    </button>
  );
}

/**
 * Pantalla 01: grupos del docente (`GET /groups`) con siguiente paso sugerido.
 */
export function TeacherGroupsScreen() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { status, groups, activeGroup, setActiveGroupId, retry } = useTeacherGroups();
  const canEdit = session?.role === 'teacher';

  const sorted = sortGroups(groups);
  const loading = status === 'loading';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '15px', color: COLORS.muted }}>{todayLabel()}</div>
        <h1 className="font-display" style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '32px', lineHeight: 1.1 }}>
          Hola, {session?.user?.fullName ?? ''}
        </h1>
      </div>

      {status === 'ready' && activeGroup && <TomorrowPlanCard key={activeGroup.id} group={activeGroup} fallback={<NextStepBanner group={activeGroup} />} />}

      {status === 'ready' && activeGroup && <nav className="teacher-workflow" aria-label="Herramientas para acompañar al grupo">
        {[
          { to: '/docente/temario', icon: 'book', title: 'Preparar', description: 'Temario y próximas evaluaciones' },
          canEdit && { to: '/docente/captura', icon: 'pencil', title: 'Registrar', description: 'Respuestas de las hojas impresas' },
          { to: '/docente/mapa', icon: 'map', title: 'Acompañar', description: 'Resultados e historial de aprendizaje' },
        ].filter(Boolean).map((item) => <button type="button" key={item.to} onClick={() => navigate(item.to)}><span><InterfaceIcon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}
      </nav>}

      <section aria-labelledby="groups-title" aria-busy={loading} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 id="groups-title" className="font-display" style={sectionTitle}>
          {canEdit ? 'Tus grupos' : 'Grupos de la escuela'}
        </h2>
        {!canEdit && <p style={{ ...mutedText, margin: 0 }}>Vista de solo lectura: puedes consultar resultados e historial, pero no modificar grupos.</p>}

        {loading && (
          <>
            <span role="status" className="axi-sr-only">
              Cargando tus grupos…
            </span>
            <div style={GRID}>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        )}

        {status === 'error' && (
          <div role="alert" style={{ ...card, alignItems: 'flex-start' }}>
            <div style={{ fontSize: '16px', lineHeight: 1.45 }}>No pudimos cargar tus grupos. Revisa tu conexión e intenta de nuevo.</div>
            <button type="button" onClick={retry} style={buttonStyle('primary')}>
              Reintentar
            </button>
          </div>
        )}

        {status === 'ready' && sorted.length === 0 && (
          <div style={{ ...card, alignItems: 'center', textAlign: 'center', padding: '32px 20px' }}>
            <Mascot size={120} />
            <h3 className="font-display" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
              {canEdit ? 'Aún no tienes grupos' : 'La escuela aún no tiene grupos'}
            </h3>
            {canEdit && <p style={{ ...mutedText, margin: 0, maxWidth: '420px' }}>
              Crea tu grupo para compartir el código con tus alumnos y empezar su diagnóstico.
            </p>}
            {canEdit && <button type="button" onClick={() => navigate('/docente/grupos/nuevo')} style={buttonStyle('primary', { tall: true })}>
              Crear mi primer grupo
            </button>}
          </div>
        )}

        {status === 'ready' && sorted.length > 0 && (
          <div style={GRID}>
            {sorted.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isActive={activeGroup?.id === group.id}
                onUse={setActiveGroupId}
              />
            ))}
            {canEdit && <CreateGroupTile />}
          </div>
        )}
      </section>
    </div>
  );
}
