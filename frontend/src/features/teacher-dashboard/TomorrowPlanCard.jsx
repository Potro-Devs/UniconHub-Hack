import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { useAnalytics } from '@/features/group-map/useAnalytics';
import { ApplyActivityForm } from '@/features/interventions/InterventionComponents';
import { useSession } from '@/shared/state/SessionContext';
import { buttonStyle, card, mutedText } from '@/shared/styles/ui';

const fact = { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: '1 1 200px' };
const factLabel = { fontSize: '13px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: COLORS.muted };

/**
 * "Qué hago mañana": habilidad prioritaria, error más frecuente y actividad del catálogo.
 * El plan lo calcula el servidor (`summary.nextStep`); aquí solo se presenta.
 * Devuelve `fallback` mientras no haya un plan con actividad.
 */
export function TomorrowPlanCard({ group, fallback }) {
  const navigate = useNavigate();
  const { session } = useSession();
  const request = useAnalytics(group.studentCount > 0 ? group.id : null);
  const step = request.status === 'ready' ? request.data.summary.nextStep : null;
  if (!step?.activity) return fallback;
  const { activity, error } = step;
  return <section aria-labelledby="tomorrow-title" style={{ ...card, gap: '18px', border: `2px solid ${COLORS.primary}` }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: COLORS.primaryText }}>Qué hago mañana · {group.name}</div>
      <h2 id="tomorrow-title" className="font-display" style={{ margin: 0, fontSize: '26px', lineHeight: 1.2 }}>{activity.title}</h2>
      <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.5 }}>{activity.description}</p>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
      <div style={fact}><span style={factLabel}>Habilidad prioritaria</span><strong>{step.skillName}</strong><span style={mutedText}>{step.average}% · {step.label}</span></div>
      <div style={fact}><span style={factLabel}>Error más frecuente</span>{error ? <><strong>{error.explanation || error.errorTag}</strong><span style={mutedText}>{error.studentCount} alumnos lo mostraron</span></> : <span style={mutedText}>Sin errores típicos registrados todavía</span>}</div>
      <div style={fact}><span style={factLabel}>Cómo organizarla</span><strong>{activity.durationMinutes} minutos · {activity.grouping}</strong>{activity.materials && <span style={mutedText}>Materiales: {activity.materials}</span>}</div>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
      {session?.role === 'teacher' && <div style={{ flex: '1 1 260px' }}><ApplyActivityForm key={`${group.id}-${activity.id}`} groupId={group.id} activity={activity} /></div>}
      <button type="button" style={buttonStyle('secondary')} onClick={() => navigate('/docente/mapa')}>Ver mapa del grupo</button>
    </div>
    <p style={{ ...mutedText, margin: 0 }}>Actividad del catálogo por validar con docente. Después de aplicarla, asigna una prueba corta para ver si el error disminuyó.</p>
  </section>;
}
