import { COLORS, LEVELS } from '@/config/brand';
import { errorMessageOf } from '@/shared/api/client';
import { readableTextOn } from '@/features/groups/groups.logic';
import { buttonStyle, card, mutedText, sectionTitle } from '@/shared/styles/ui';

export const stack = { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 };

export function MasteryValue({ percentage, level, label }) {
  const colors = LEVELS.find((item) => item.code === level);
  return <span style={{ display: 'inline-block', borderRadius: '10px', padding: '7px 9px', background: colors?.bg ?? COLORS.bg, color: colors?.fg ?? COLORS.muted, fontSize: '14px', lineHeight: 1.4, fontWeight: 700 }}>
    {percentage == null ? 'Sin evaluar' : `${percentage}% · ${label}`}
  </span>;
}

export function AnalyticsState({ groups, request }) {
  if (groups.status === 'loading') return <p role="status">Cargando grupos…</p>;
  if (groups.status === 'error') return <div role="alert" style={card}><p>No pudimos cargar tus grupos.</p><button type="button" onClick={groups.retry} style={buttonStyle('primary')}>Reintentar</button></div>;
  if (!groups.activeGroup) return <div style={card}><h1 style={sectionTitle}>Todavía no hay grupos</h1><p style={mutedText}>Crea un grupo y agrega alumnos para consultar su progreso.</p></div>;
  if (request.status === 'loading') return <p role="status" aria-live="polite">Cargando resultados…</p>;
  if (request.status === 'error') return <div role="alert" style={card}><p>{errorMessageOf(request.error)}</p><button type="button" onClick={request.retry} style={buttonStyle('primary')}>Reintentar</button></div>;
  return null;
}

export function StudentIdentity({ student }) {
  const background = student.avatarColor || COLORS.primarySoftBg;
  return <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', flex: 'none', borderRadius: '50%', background, color: readableTextOn(background, COLORS.ink, COLORS.onPrimary), fontWeight: 700 }}>{student.initials}</span>
    <span style={{ overflowWrap: 'anywhere' }}>{student.name}</span>
  </span>;
}

export function RecommendedActivity({ activity }) {
  return <section style={{ ...card, background: COLORS.noticeBg }} aria-label="Actividad sugerida">
    <h2 className="font-display" style={sectionTitle}>Actividad sugerida</h2>
    {activity ? <>
      <strong style={{ fontSize: '20px' }}>{activity.title}</strong>
      <p style={{ margin: 0, lineHeight: 1.5 }}>{activity.description}</p>
      <p style={{ ...mutedText, margin: 0 }}>{activity.durationMinutes} minutos · {activity.grouping}</p>
      {activity.materials && <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.45 }}>Materiales: {activity.materials}</p>}
      <p style={{ ...mutedText, margin: 0 }}>Propuesta del catálogo por validar con docente.</p>
    </> : <p style={{ ...mutedText, margin: 0 }}>Aún no hay una actividad sugerida con los resultados disponibles.</p>}
  </section>;
}

export function TypicalErrors({ errors }) {
  return <section style={card}>
    <h2 className="font-display" style={sectionTitle}>Errores típicos detectados</h2>
    <p style={{ ...mutedText, margin: 0 }}>Respuestas acumuladas de evaluaciones completadas en este grupo.</p>
    {errors.length ? <ul style={{ margin: 0, paddingLeft: '20px', ...stack, gap: '10px' }}>{errors.map((error) => <li key={`${error.skillCode}-${error.errorTag}-${error.explanation}`} style={{ lineHeight: 1.5 }}>
      {error.explanation || error.errorTag} <span style={mutedText}>· {error.count} respuestas</span>
    </li>)}</ul> : <p style={{ ...mutedText, margin: 0 }}>No hay errores típicos registrados en evaluaciones completadas.</p>}
  </section>;
}
