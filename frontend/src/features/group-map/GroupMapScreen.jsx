import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { schoolYearToDisplay } from '@/features/groups/groups.logic';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { buttonStyle, card, mutedText, pageTitle, sectionTitle } from '@/shared/styles/ui';
import { AnalyticsState, MasteryValue, RecommendedActivity, StudentIdentity, TypicalErrors, stack } from './AnalyticsComponents';
import { useAnalytics } from './useAnalytics';

const priorGradeNote = (gradeCounts, currentGrade) => {
  const grades = Object.entries(gradeCounts || {})
    .filter(([grade]) => Number(grade) !== currentGrade)
    .map(([grade]) => `${grade}.º`);
  return grades.length ? `Incluye cortes de ${grades.join(', ')}` : null;
};

/** All mastery, labels and recommendations come from the API. */
export function GroupMapScreen() {
  const groups = useTeacherGroups();
  const request = useAnalytics(groups.activeGroup?.id);
  const navigate = useNavigate();
  const { width } = useBreakpoint();
  const [supportOnly, setSupportOnly] = useState(false);
  if (groups.status !== 'ready' || !groups.activeGroup || request.status !== 'ready') {
    return <AnalyticsState groups={groups} request={request} />;
  }
  const { skills, students, summary } = request.data;
  const { weakestSkill, coverage } = summary;
  const visibleStudents = supportOnly
    ? students.filter((student) => student.skills.some((skill) => skill.level === 'needs_support'))
    : students;
  const openProfile = (id) => navigate(`/docente/perfil/${id}?groupId=${groups.activeGroup.id}`);
  return <div style={stack}>
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
      <div><h1 className="font-display" style={pageTitle}>Mapa del grupo</h1>
        <p style={{ ...mutedText, margin: '6px 0 0' }}>{groups.activeGroup.name} · Ciclo {schoolYearToDisplay(groups.activeGroup.schoolYear)} · {summary.studentCount} alumnos</p>
      </div>
      <button type="button" style={buttonStyle('secondary')} onClick={request.retry}>Actualizar resultados</button>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
      <section style={card}><h2 style={{ ...mutedText, margin: 0 }}>Habilidad que requiere más acompañamiento</h2>
        {weakestSkill ? <><strong className="font-display" style={{ fontSize: '25px' }}>{weakestSkill.name}</strong><MasteryValue percentage={weakestSkill.average} level={weakestSkill.level} label={weakestSkill.label} /><p style={{ ...mutedText, margin: 0 }}>{priorGradeNote(weakestSkill.gradeCounts, groups.activeGroup.grade)}</p></> : <p style={mutedText}>Todavía no hay habilidades evaluadas.</p>}
      </section>
      <section style={card}><h2 style={{ ...mutedText, margin: 0 }}>Alumnos que necesitan apoyo</h2>
        <strong className="font-display" style={{ fontSize: '30px' }}>{summary.needsSupportCount} <span style={{ fontSize: '18px', fontWeight: 400 }}>de {summary.studentCount}</span></strong>
        <p style={{ ...mutedText, margin: 0 }}>Con al menos una habilidad en “Necesita apoyo”.</p>
      </section>
      <section style={card}><h2 style={{ ...mutedText, margin: 0 }}>Cobertura del temario</h2>
        <strong className="font-display" style={{ fontSize: '30px' }}>{coverage.coveragePercentage}%</strong>
        <p style={{ ...mutedText, margin: 0 }}>{coverage.seen} de {coverage.total} contenidos vistos · {coverage.in_progress} en proceso</p>
      </section>
    </div>
    <RecommendedActivity activity={summary.recommendedActivity} />
    <section style={stack} aria-labelledby="map-results-title">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <h2 id="map-results-title" className="font-display" style={sectionTitle}>Resultados por habilidad</h2>
        <label style={{ display: 'flex', alignItems: 'center', minHeight: '48px', gap: '10px', fontSize: '15px', cursor: 'pointer' }}>
          <input type="checkbox" checked={supportOnly} onChange={(event) => setSupportOnly(event.target.checked)} style={{ width: '20px', height: '20px' }} />Solo quienes necesitan apoyo
        </label>
      </div>
      <p style={{ ...mutedText, margin: 0 }}>Dominio autónomo ponderado del historial. “Logrado con apoyo” se registra por separado en el perfil. Sin evaluar indica que aún no hay evidencia.</p>
      {!visibleStudents.length ? <div style={card}><p style={{ ...mutedText, margin: 0 }}>{students.length ? 'Ningún alumno coincide con este filtro.' : 'Todavía no hay alumnos inscritos en este grupo.'}</p></div> : width < 1024 ?
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))', gap: '14px' }}>
          {visibleStudents.map((student) => <article key={student.id} style={card}>
            <button type="button" onClick={() => openProfile(student.id)} style={{ ...buttonStyle('ghost'), padding: 0, justifyContent: 'flex-start', textAlign: 'left' }}><StudentIdentity student={student} /></button>
            <dl style={{ margin: 0, ...stack, gap: '12px' }}>{student.skills.map((skill) => <div key={skill.code} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <dt style={{ fontSize: '15px' }}>{skill.name}</dt><dd style={{ margin: 0 }}><MasteryValue percentage={skill.masteryPercentage} level={skill.level} label={skill.label} grade={skill.grade} currentGrade={groups.activeGroup.grade} /></dd>
            </div>)}</dl>
          </article>)}
        </div> :
        <div style={{ ...card, padding: '6px 12px' }}><table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '15px' }}>
          <caption style={{ ...mutedText, textAlign: 'left', padding: '12px 4px' }}>{visibleStudents.length} alumnos · Selecciona un nombre para ver su historial</caption>
          <thead><tr><th scope="col" style={{ padding: '12px 4px', textAlign: 'left', width: '21%' }}>Alumno</th>{skills.map((skill) => {
            return <th scope="col" key={skill.code} style={{ padding: '12px 4px', textAlign: 'left', overflowWrap: 'anywhere' }}>{skill.name}<div style={{ marginTop: '8px' }}><MasteryValue percentage={skill.average} level={skill.level} label={skill.label} /></div>{priorGradeNote(skill.gradeCounts, groups.activeGroup.grade) && <small>{priorGradeNote(skill.gradeCounts, groups.activeGroup.grade)}</small>}</th>;
          })}</tr></thead>
          <tbody>{visibleStudents.map((student) => <tr key={student.id} style={{ borderTop: `1px solid ${COLORS.border}` }}><th scope="row" style={{ padding: '10px 4px', textAlign: 'left' }}><button type="button" style={{ ...buttonStyle('ghost'), padding: 0, textAlign: 'left', justifyContent: 'flex-start', fontSize: '15px' }} onClick={() => openProfile(student.id)}><StudentIdentity student={student} /></button></th>{student.skills.map((skill) => <td key={skill.code} style={{ padding: '10px 4px', verticalAlign: 'middle' }}><MasteryValue percentage={skill.masteryPercentage} level={skill.level} label={skill.label} grade={skill.grade} currentGrade={groups.activeGroup.grade} /></td>)}</tr>)}</tbody>
        </table></div>}
    </section>
    <TypicalErrors errors={summary.typicalErrors} />
  </div>;
}
