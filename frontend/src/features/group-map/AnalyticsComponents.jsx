import { COLORS, LEVELS } from '@/config/brand';
import { errorMessageOf } from '@/shared/api/client';
import { readableTextOn } from '@/features/groups/groups.logic';
import { buttonStyle, card, mutedText, sectionTitle } from '@/shared/styles/ui';

export const stack = { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 };

export function MasteryValue({ percentage, level, label, grade, currentGrade }) {
  const colors = LEVELS.find((item) => item.code === level);
  const gradeNote = grade != null && currentGrade != null && grade !== currentGrade ? ` · de ${grade}.º` : '';
  return <span style={{ display: 'inline-block', borderRadius: '10px', padding: '7px 9px', background: colors?.bg ?? COLORS.bg, color: colors?.fg ?? COLORS.muted, fontSize: '14px', lineHeight: 1.4, fontWeight: 700 }}>
    {percentage == null ? 'Sin evaluar' : `${percentage}% · ${label}${gradeNote}`}
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

export function RecommendedActivity({ activity, children }) {
  return <section style={{ ...card, background: COLORS.noticeBg }} aria-label="Actividad sugerida">
    <h2 className="font-display" style={sectionTitle}>Actividad sugerida</h2>
    {activity ? <>
      <strong style={{ fontSize: '20px' }}>{activity.title}</strong>
      <p style={{ margin: 0, lineHeight: 1.5 }}>{activity.description}</p>
      <p style={{ ...mutedText, margin: 0 }}>{activity.durationMinutes} minutos · {activity.grouping}</p>
      {activity.materials && <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.45 }}>Materiales: {activity.materials}</p>}
      <p style={{ ...mutedText, margin: 0 }}>Propuesta del catálogo por validar con docente.</p>
      {children}
    </> : <p style={{ ...mutedText, margin: 0 }}>Aún no hay una actividad sugerida con los resultados disponibles.</p>}
  </section>;
}

export function TypicalErrors({ errors }) {
  return <section style={card}>
    <h2 className="font-display" style={sectionTitle}>Errores típicos detectados</h2>
    <p style={{ ...mutedText, margin: 0 }}>Respuestas acumuladas de evaluaciones completadas en este grupo.</p>
    {errors.length ? <ul style={{ margin: 0, paddingLeft: '20px', ...stack, gap: '10px' }}>{errors.map((error) => <li key={`${error.skillCode}-${error.errorTag}-${error.explanation}`} style={{ lineHeight: 1.5 }}>
      {error.explanation || error.errorTag} <span style={mutedText}>· {error.studentCount != null ? `${error.studentCount} alumnos · ` : ''}{error.count} respuestas</span>
    </li>)}</ul> : <p style={{ ...mutedText, margin: 0 }}>No hay errores típicos registrados en evaluaciones completadas.</p>}
  </section>;
}

const TREND_STYLE = {
  toward_autonomy: { symbol: '↑', bg: COLORS.playfulTeal, fg: COLORS.successFg },
  steady: { symbol: '→', bg: COLORS.surfaceSubtle, fg: COLORS.muted },
  more_support: { symbol: '↺', bg: COLORS.noticeBg, fg: COLORS.noticeFg },
};

/** Tendencia con símbolo y texto: el color nunca es el único indicador. */
export function AutonomyTrendBadge({ trend }) {
  if (!trend) return <span style={{ ...mutedText, fontSize: '14px' }}>Una sola sesión: aún sin comparación</span>;
  const style = TREND_STYLE[trend.trend];
  const sign = trend.delta > 0 ? '+' : '';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '10px', padding: '6px 9px', background: style.bg, color: style.fg, fontSize: '14px', fontWeight: 700, lineHeight: 1.4 }}>
    <span aria-hidden="true">{style.symbol}</span>{trend.label} · autónomo {trend.previousAutonomous}% → {trend.latestAutonomous}% ({sign}{trend.delta} pts)
  </span>;
}

/** Conducta observable de avance: resolver sin pistas lo que antes requería apoyo. */
export function AutonomyProgress({ progress }) {
  if (!progress) return null;
  const { highlight } = progress;
  return <section style={card} aria-labelledby="autonomy-title">
    <h2 id="autonomy-title" className="font-display" style={sectionTitle}>Avance hacia la autonomía</h2>
    <p style={{ ...mutedText, margin: 0 }}>Compara la sesión más reciente con la anterior en cada habilidad (pueden ser de grados distintos). Se considera avance subir {progress.threshold} puntos o más en aciertos sin pistas.</p>
    {progress.comparedStudentCount === 0 ? <p style={{ ...mutedText, margin: 0 }}>Aún no hay alumnos con dos sesiones en una misma habilidad.</p> : <>
      <p style={{ margin: 0, fontSize: '18px', lineHeight: 1.5 }}>
        <strong>{progress.fromSupportStudentCount}</strong> alumnos pasaron de necesitar pistas a resolver más por su cuenta
        {highlight ? <> · destaca <strong>{highlight.skillName}</strong> ({highlight.studentCount} alumnos)</> : null}.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {progress.skills.filter((skill) => skill.comparedCount > 0).map((skill) => <div key={skill.code} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}><strong>{skill.name}</strong><span style={mutedText}>{skill.comparedCount} alumnos comparados</span></div>
          <div aria-hidden="true" style={{ display: 'flex', height: '12px', borderRadius: '8px', overflow: 'hidden', background: COLORS.surfaceSubtle }}>
            {[['towardAutonomyCount', TREND_STYLE.toward_autonomy.fg], ['steadyCount', COLORS.border], ['moreSupportCount', COLORS.primaryAccent]].map(([key, color]) => skill[key] > 0 && <span key={key} style={{ width: `${skill[key] / skill.comparedCount * 100}%`, background: color }} />)}
          </div>
          <span style={{ fontSize: '15px', lineHeight: 1.5 }}>↑ Avanzan: <strong>{skill.towardAutonomyCount}</strong> · → Se mantienen: <strong>{skill.steadyCount}</strong> · ↺ Usaron más apoyo: <strong>{skill.moreSupportCount}</strong></span>
        </div>)}
      </div>
    </>}
  </section>;
}
