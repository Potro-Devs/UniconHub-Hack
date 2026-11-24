import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS, LEVELS } from '@/config/brand';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { schoolYearToDisplay } from '@/features/groups/groups.logic';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { errorMessageOf } from '@/shared/api/client';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { buttonStyle, card, pageTitle } from '@/shared/styles/ui';
import { AnalyticsState, AutonomyProgress, MasteryValue, RecommendedActivity, StudentIdentity, TypicalErrors, stack } from './AnalyticsComponents';
import { ApplyActivityForm, InterventionsPanel } from '@/features/interventions/InterventionComponents';
import { useInterventions } from '@/features/interventions/useInterventions';
import { useSession } from '@/shared/state/SessionContext';
import { analyticsApi } from './analytics.api';
import { useAnalytics } from './useAnalytics';
import './analytics-map.css';

const priorGradeNote = (gradeCounts, currentGrade) => {
  const grades = Object.entries(gradeCounts || {})
    .filter(([grade]) => Number(grade) !== currentGrade)
    .map(([grade]) => `${grade}.º`);
  return grades.length ? `Incluye cortes de ${grades.join(', ')}` : null;
};

const dateLabel = (value) => {
  if (!value) return 'Sin evaluaciones registradas';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
};
const privacyNotice = 'El archivo incluye nombres de alumnos. Guárdalo solo en equipos de la escuela y no lo compartas fuera de ella.';

function MetricCard({ icon, title, children, detail, accent = false }) {
  return <section className={`map-metric ${accent ? 'map-metric-accent' : ''}`}><div className="map-metric-label"><span><InterfaceIcon name={icon} size={20} /></span><h2>{title}</h2></div><div className="map-metric-value">{children}</div><p>{detail}</p></section>;
}

function SkillOverview({ skills, studentCount, currentGrade }) {
  return <section className="map-panel" aria-labelledby="skill-overview-title"><div className="map-section-intro"><span className="map-eyebrow">EL GRUPO COMPLETO</span><h2 id="skill-overview-title" className="font-display">¿En qué punto estamos?</h2><p>Dominio autónomo ponderado. El promedio incluye únicamente a quienes tienen evidencia.</p></div>
    <figure className="map-average-chart"><figcaption className="axi-sr-only">Promedio por habilidad, con escala de 0 a 100 por ciento y número de alumnos evaluados.</figcaption>
      {skills.map((skill) => { const color = LEVELS.find((level) => level.code === skill.level)?.solid || COLORS.border; const gradeNote = priorGradeNote(skill.gradeCounts, currentGrade); return <div className="map-average-row" key={skill.code}><div className="map-average-heading"><strong>{skill.name}</strong><span>{skill.evaluatedCount} de {studentCount} con evidencia</span></div><div className="map-average-track" aria-hidden="true"><div style={{ width: `${skill.average ?? 0}%`, background: color }} /></div><div className="map-average-result"><span>{skill.average == null ? 'Sin evaluar' : `${skill.average}% · ${skill.label}`}</span>{gradeNote && <span>{gradeNote}</span>}{skill.needsSupportCount > 0 && <span>{skill.needsSupportCount} necesitan apoyo</span>}</div></div>; })}
      <div className="map-chart-scale" aria-hidden="true"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
    </figure>
  </section>;
}

function SkillDistribution({ skills, studentCount }) {
  const [selected, setSelected] = useState('');
  const skill = skills.find((item) => item.code === selected) || skills[0];
  const segments = [...LEVELS.map((level) => ({ code: level.code, label: level.label, color: level.solid, count: skill?.distribution?.[level.code] ?? 0 })), { code: 'not_evaluated', label: 'Sin evaluar', color: COLORS.border, count: skill?.distribution?.not_evaluated ?? studentCount }];
  return <section className="map-panel" aria-labelledby="distribution-title"><div className="map-section-intro"><span className="map-eyebrow">CADA ALUMNO CUENTA</span><h2 id="distribution-title" className="font-display">Acompañamiento por nivel</h2><p>Distribución del grupo completo en una habilidad. Cada alumno aparece una vez.</p></div>
    <label className="map-select-label">Habilidad de la gráfica<select value={skill?.code || ''} onChange={(event) => setSelected(event.target.value)} disabled={!skills.length}>{skills.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <figure className="map-distribution"><figcaption><strong>{skill?.name || 'Sin habilidades'}</strong><span>{studentCount} alumnos en total</span></figcaption><div className="map-stacked-bar" aria-hidden="true">{segments.map((segment) => segment.count > 0 && <span key={segment.code} style={{ width: `${studentCount ? segment.count / studentCount * 100 : 0}%`, background: segment.color }} />)}</div><ul className="map-distribution-legend">{segments.map((segment) => <li key={segment.code}><span className="map-legend-color" style={{ background: segment.color }} aria-hidden="true" /><span>{segment.label}</span><strong>{segment.count} <span>alumnos</span></strong></li>)}</ul></figure>
    <p className="map-footnote">La evidencia puede incluir grados anteriores. Sin evaluar significa que aún no hay un corte registrado.</p>
  </section>;
}

function StudentResults({ students, skills, width, openProfile, currentGrade }) {
  if (!students.length) return <div className="map-empty"><InterfaceIcon name="groups" size={32} /><h3>No hay alumnos para esta selección</h3><p>Prueba otra habilidad o desactiva el filtro de apoyo.</p></div>;
  if (width < 1280) return <div className="map-student-grid">{students.map((student) => <article className="map-student-card" key={student.id}><button className="map-student-link" type="button" onClick={() => openProfile(student.id)}><StudentIdentity student={student} /><span>Ver perfil</span></button><dl>{skills.map((skill) => { const result = student.skills.find((item) => item.code === skill.code); return <div key={skill.code}><dt>{skill.name}</dt><dd><MasteryValue percentage={result?.masteryPercentage} level={result?.level} label={result?.label} grade={result?.grade} currentGrade={currentGrade} /></dd></div>; })}</dl></article>)}</div>;
  return <div className="map-table-wrap"><table className="map-results-table"><caption className="axi-sr-only">Dominio autónomo por alumno y habilidad. Selecciona un nombre para abrir el perfil.</caption><thead><tr><th scope="col">Alumno</th>{skills.map((skill) => <th scope="col" key={skill.code}>{skill.name}</th>)}</tr></thead><tbody>{students.map((student) => <tr key={student.id}><th scope="row"><button type="button" className="map-student-link" onClick={() => openProfile(student.id)}><StudentIdentity student={student} /></button></th>{skills.map((skill) => { const result = student.skills.find((item) => item.code === skill.code); return <td key={skill.code}><MasteryValue percentage={result?.masteryPercentage} level={result?.level} label={result?.label} grade={result?.grade} currentGrade={currentGrade} /></td>; })}</tr>)}</tbody></table></div>;
}

/** Global summaries remain stable while the roster and downloads follow the same filters. */
export function GroupMapScreen() {
  const groups = useTeacherGroups();
  const request = useAnalytics(groups.activeGroup?.id);
  const interventions = useInterventions(groups.activeGroup?.id);
  const { session } = useSession();
  const navigate = useNavigate();
  const { width } = useBreakpoint();
  const [skillCode, setSkillCode] = useState('');
  const [supportOnly, setSupportOnly] = useState(false);
  const [download, setDownload] = useState({ pending: null, message: '', error: false });
  const filtered = Boolean(skillCode || supportOnly);
  const filterRequest = useAnalytics(filtered ? groups.activeGroup?.id : null, undefined, { skillCode, supportOnly });
  if (groups.status !== 'ready' || !groups.activeGroup || request.status !== 'ready') return <AnalyticsState groups={groups} request={request} />;
  const { skills, students, summary } = request.data;
  const { weakestSkill, coverage } = summary;
  const detailRequest = filtered ? filterRequest : request;
  const visibleStudents = detailRequest.data?.students || [];
  const visibleSkills = skillCode ? skills.filter((skill) => skill.code === skillCode) : skills;
  const filters = { skillCode, supportOnly };
  const openProfile = (id) => navigate(`/docente/perfil/${id}?groupId=${groups.activeGroup.id}`);
  const exportFile = async (format) => {
    setDownload({ pending: format, message: '', error: false });
    try {
      const blob = await analyticsApi.export(groups.activeGroup.id, format, filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `mapa-grupo-${groups.activeGroup.id}.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownload({ pending: null, message: `${format === 'xlsx' ? 'Excel' : 'PDF'} preparado. Incluye el resumen del grupo y el detalle con los filtros seleccionados. ${privacyNotice}`, error: false });
    } catch (error) { setDownload({ pending: null, message: errorMessageOf(error), error: true }); }
  };
  const weakestGradeNote = priorGradeNote(weakestSkill?.gradeCounts, groups.activeGroup.grade);
  return <div className="analytics-map" style={stack}>
    <header className="map-page-header"><div><div className="map-eyebrow">MIRAR, COMPRENDER, ACOMPAÑAR</div><h1 className="font-display" style={pageTitle}>Mapa del grupo</h1><p>{groups.activeGroup.name} · Ciclo {schoolYearToDisplay(groups.activeGroup.schoolYear)} · {summary.studentCount} alumnos</p></div><div className="map-header-actions"><button type="button" style={buttonStyle('ghost')} onClick={() => { request.retry(); if (filtered) filterRequest.retry(); }}><InterfaceIcon name="map" size={18} />Actualizar</button><button type="button" style={buttonStyle('secondary')} disabled={Boolean(download.pending) || detailRequest.status !== 'ready'} onClick={() => exportFile('xlsx')}><InterfaceIcon name="paper" size={18} />{download.pending === 'xlsx' ? 'Preparando…' : 'Excel'}</button><button type="button" style={buttonStyle('primary')} disabled={Boolean(download.pending) || detailRequest.status !== 'ready'} onClick={() => exportFile('pdf')}><InterfaceIcon name="paper" size={18} />{download.pending === 'pdf' ? 'Preparando…' : 'PDF'}</button><span className="map-privacy-note">{privacyNotice}</span></div></header>
    {download.message && <div className={`map-export-message ${download.error ? 'map-export-error' : ''}`} role={download.error ? 'alert' : 'status'}>{download.message}</div>}
    <div className="map-data-note"><span>Resumen del grupo completo</span><span>Último corte registrado: {dateLabel(summary.latestRecordedAt)}</span></div>
    <div className="map-metrics"><MetricCard icon="groups" title="Con evidencia" detail={`${summary.notEvaluatedStudentCount ?? 0} alumnos aún sin cortes en ninguna habilidad.`}>{summary.evaluatedStudentCount ?? 0}<small>de {summary.studentCount} alumnos</small></MetricCard><MetricCard icon="spark" title="Necesitan apoyo" detail="Alumnos únicos con al menos una habilidad en Necesita apoyo." accent>{summary.needsSupportCount}<small>alumnos</small></MetricCard><MetricCard icon="book" title="Prioridad de acompañamiento" detail={weakestSkill ? `${weakestSkill.average}% · ${weakestSkill.label}${weakestGradeNote ? ` · ${weakestGradeNote}` : ''}` : 'Aún no hay habilidades evaluadas.'}><span className="map-metric-skill">{weakestSkill?.name || 'Sin evidencia'}</span></MetricCard><MetricCard icon="paper" title="Cobertura del temario" detail={`${coverage.seen} de ${coverage.total} contenidos vistos · ${coverage.in_progress} en proceso.`}>{coverage.coveragePercentage}%<small>contenidos vistos</small></MetricCard></div>
    <div className="map-chart-grid"><SkillOverview skills={skills} studentCount={summary.studentCount} currentGrade={groups.activeGroup.grade} /><SkillDistribution skills={skills} studentCount={summary.studentCount} /></div>
    <section className="map-panel map-results-panel" aria-labelledby="map-results-title"><div className="map-section-intro"><span className="map-eyebrow">DEL PANORAMA A CADA ALUMNO</span><h2 id="map-results-title" className="font-display">¿A quién acompañamos?</h2><p>Abre un perfil para revisar su historial y los aciertos logrados con apoyo.</p></div>
      <div className="map-filter-toolbar"><label className="map-select-label">Habilidad del detalle<select value={skillCode} onChange={(event) => setSkillCode(event.target.value)}><option value="">Todas las habilidades</option>{skills.map((skill) => <option key={skill.code} value={skill.code}>{skill.name}</option>)}</select></label><label className="map-support-filter"><input type="checkbox" checked={supportOnly} onChange={(event) => setSupportOnly(event.target.checked)} /><span>Solo quienes necesitan apoyo<small>{skillCode ? 'En la habilidad seleccionada' : 'En al menos una habilidad'}</small></span></label>{filtered && <button type="button" style={buttonStyle('ghost')} onClick={() => { setSkillCode(''); setSupportOnly(false); }}>Limpiar filtros</button>}</div>
      <div className="map-roster-meta" aria-live="polite"><strong>{detailRequest.status === 'ready' ? `${visibleStudents.length} de ${summary.studentCount} alumnos mostrados` : 'Actualizando selección…'}</strong><span>Excel y PDF incluyen este detalle filtrado y el resumen completo.</span></div>
      <div aria-busy={detailRequest.status === 'loading'}>{detailRequest.status === 'loading' ? <p role="status" className="map-loading">Consultando resultados…</p> : detailRequest.status === 'error' ? <div role="alert" style={card}><p>{errorMessageOf(detailRequest.error)}</p><button type="button" style={buttonStyle('secondary')} onClick={detailRequest.retry}>Reintentar</button></div> : <StudentResults students={visibleStudents} skills={visibleSkills} width={width} openProfile={openProfile} currentGrade={groups.activeGroup.grade} />}</div>
      <p className="map-footnote">Los porcentajes representan dominio autónomo ponderado del historial. “Logrado con apoyo” se consulta por separado en el perfil. Sin evaluar no equivale a 0%.</p>
    </section>
    <div className="map-actions-grid"><RecommendedActivity activity={summary.recommendedActivity}>{session?.role === 'teacher' && <ApplyActivityForm key={`${groups.activeGroup.id}-${summary.recommendedActivity?.id}`} groupId={groups.activeGroup.id} activity={summary.recommendedActivity} onApplied={interventions.retry} />}</RecommendedActivity><TypicalErrors errors={summary.typicalErrors} /></div>
    <div className="map-actions-grid"><AutonomyProgress progress={summary.autonomyProgress} /><InterventionsPanel request={interventions} /></div>
  </div>;
}
