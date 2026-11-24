import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { schoolYearToDisplay } from '@/features/groups/groups.logic';
import { AnalyticsState, MasteryValue, RecommendedActivity, StudentIdentity, TypicalErrors, stack } from '@/features/group-map/AnalyticsComponents';
import { useAnalytics } from '@/features/group-map/useAnalytics';
import { buttonStyle, card, mutedText, pageTitle, sectionTitle } from '@/shared/styles/ui';

function dateLabel(value) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
}

/** Uses persistent student IDs, with an explicit group scope on shared links. */
export function StudentProfileScreen() {
  const { studentId } = useParams();
  const [params] = useSearchParams();
  const groups = useTeacherGroups();
  const groupId = params.get('groupId') || groups.activeGroup?.id;
  const request = useAnalytics(studentId ? groupId : null, studentId);
  const navigate = useNavigate();
  const back = <button type="button" style={{ ...buttonStyle('ghost'), alignSelf: 'flex-start' }} onClick={() => { if (params.get('groupId')) groups.setActiveGroupId(params.get('groupId')); navigate('/docente/mapa'); }}>Volver al mapa del grupo</button>;
  if (!studentId) return <div style={stack}>{back}<section style={card}><h1 style={pageTitle}>Selecciona un alumno</h1><p style={mutedText}>Abre su nombre en el mapa del grupo para consultar su perfil.</p></section></div>;
  if (groups.status !== 'ready' || !groups.activeGroup || request.status !== 'ready') return <div style={stack}>{back}<AnalyticsState groups={groups} request={request} /></div>;
  const { student, group, skills, history, recommendedActivity, typicalErrors } = request.data;
  return <div style={stack}>
    {back}
    <header><h1 className="font-display" style={pageTitle}><StudentIdentity student={student} /></h1><p style={{ ...mutedText, margin: '8px 0 0' }}>{group.grade}.º {group.section} · Ciclo {schoolYearToDisplay(group.schoolYear)}</p></header>
    <section style={card} aria-labelledby="student-skills-title"><h2 id="student-skills-title" className="font-display" style={sectionTitle}>Dominio por habilidad</h2>
      <p style={{ ...mutedText, margin: 0 }}>El dominio autónomo pondera las sesiones del historial, dando mayor peso a las recientes. El apoyo corresponde a los aciertos con pistas de la última sesión.</p>
      {skills.map((skill) => <div key={skill.code} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px', paddingTop: '14px', borderTop: `1px solid ${COLORS.border}` }}>
        <strong style={{ flex: '1 1 180px', fontSize: '16px' }}>{skill.name}</strong>
        <MasteryValue percentage={skill.masteryPercentage} level={skill.level} label={skill.label} />
        <div style={{ ...mutedText, flexBasis: '100%' }}>{skill.supportedPercentage == null ? 'Sin sesión registrada.' : `Último corte: ${dateLabel(skill.recordedAt)} · Logrado con apoyo: ${skill.supportedPercentage}% · Autónomo en la última sesión: ${skill.autonomousPercentage}%`}</div>
      </div>)}
    </section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '18px' }}><RecommendedActivity activity={recommendedActivity} /><TypicalErrors errors={typicalErrors} /></div>
    <section style={card} aria-labelledby="student-history-title"><h2 id="student-history-title" className="font-display" style={sectionTitle}>Historial entre grados</h2>
      <p style={{ ...mutedText, margin: 0 }}>Cada registro conserva el resultado de esa sesión y el dominio acumulado en ese momento.</p>
      {!history.length ? <p style={mutedText}>Aún no hay evaluaciones registradas para este alumno.</p> : <ol style={{ listStyle: 'none', padding: 0, margin: 0, ...stack, gap: '12px' }}>{[...history].reverse().map((cut) => <li key={cut.id} style={{ padding: '14px', border: `1px solid ${COLORS.border}`, borderRadius: '14px', ...stack, gap: '7px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px' }}><strong>{cut.skillName}</strong><MasteryValue percentage={cut.masteryPercentage} level={cut.level} label={cut.label} /></div>
        <div style={mutedText}>{cut.grade}.º grado · Ciclo {(cut.schoolYear ? schoolYearToDisplay(cut.schoolYear) : 'no disponible')} · {dateLabel(cut.recordedAt)}</div>
        <div style={{ fontSize: '15px', lineHeight: 1.5 }}>Sesión {cut.sessionIndex} · Autónomo: {cut.autonomousPercentage}% · Logrado con apoyo: {cut.supportedPercentage}%</div>
      </li>)}</ol>}
      <p style={{ ...mutedText, margin: 0 }}>El seguimiento se une con un folio interno que no se muestra. El nombre solo se consulta dentro de la sesión escolar.</p>
    </section>
  </div>;
}
