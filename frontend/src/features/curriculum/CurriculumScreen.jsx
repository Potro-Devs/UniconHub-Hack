import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { errorMessageOf } from '@/shared/api/client';
import { alertBox, buttonStyle, card, inputStyle, mutedText, noticeBox, pageTitle, sectionTitle } from '@/shared/styles/ui';
import { AssignmentPanel } from './AssignmentPanel';
import { CONTENT_STATUSES, skillsOfContents, toggleSelection } from './curriculum.logic';
import { useCurriculum } from './useCurriculum';
import './curriculum.css';

export function CurriculumGroupState({ status, retry }) {
  if (status === 'loading') return <p role="status" style={mutedText}>Cargando tus grupos…</p>;
  if (status === 'error') return <div role="alert" style={alertBox}><p>No pudimos cargar tus grupos.</p><button type="button" onClick={retry} style={buttonStyle('secondary')}>Reintentar</button></div>;
  return <section style={card}><h1 style={pageTitle} className="font-display">Temario</h1><p style={mutedText}>Elige o crea un grupo para consultar su temario.</p><Link to="/docente/grupos" style={buttonStyle('primary')}>Ir a mis grupos</Link></section>;
}

function CoverageCard({ request }) {
  const { coverage } = request;
  if (!coverage) return null;
  return <section style={card} aria-labelledby="coverage-heading">
    <h2 id="coverage-heading" className="font-display" style={sectionTitle}>Avance del temario</h2>
    <p style={{ margin: 0 }}><strong>{coverage.seen} de {coverage.total}</strong> contenidos vistos · <strong>{coverage.coveragePercentage}%</strong></p>
    <progress value={coverage.coveragePercentage} max={100} aria-label="Cobertura del temario" style={{ width: '100%', height: '16px', accentColor: COLORS.primary }} />
    <div style={{ display: 'flex', gap: '8px 20px', flexWrap: 'wrap', ...mutedText }}>
      <span>Vistos: {coverage.seen}</span><span>En curso: {coverage.in_progress}</span><span>Pendientes: {coverage.pending}</span>
    </div>
    {coverage.bySkill.length > 0 && <details><summary style={{ minHeight: '44px', cursor: 'pointer', padding: '10px 0', fontWeight: 700 }}>Ver avance por habilidad</summary><ul style={{ margin: '6px 0', paddingLeft: '20px', lineHeight: 1.7 }}>{coverage.bySkill.map((skill) => <li key={skill.code}>{skill.name}: {skill.seen} de {skill.total} vistos · {skill.coveragePercentage}%</li>)}</ul></details>}
    {request.coverageError && <div role="alert" style={alertBox}><span>El cambio se guardó, pero no pudimos actualizar la cobertura.</span><button type="button" style={buttonStyle('secondary')} onClick={request.refreshCoverage}>Actualizar cobertura</button></div>}
  </section>;
}

function GroupCurriculum({ group }) {
  const request = useCurriculum(group.id);
  const [params] = useSearchParams();
  const query = params.toString();
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectionNotice, setSelectionNotice] = useState('');
  const headingRef = useRef(null);
  const appliedQuery = useRef(null);
  const skills = useMemo(() => skillsOfContents(request.contents), [request.contents]);
  const focusPanel = () => { headingRef.current?.focus({ preventScroll: true }); headingRef.current?.scrollIntoView({ block: 'start' }); };

  useEffect(() => {
    if (request.status !== 'ready' || appliedQuery.current === query) return;
    appliedQuery.current = query;
    const requested = new URLSearchParams(query);
    const skillCode = requested.get('skill');
    if (skillCode) {
      const skill = skills.find((entry) => entry.code === skillCode);
      if (skill) { setSelectedSkills([skill.code]); setSelectionNotice(`Elegimos ${skill.name} para esta prueba. Puedes cambiar las habilidades.`); }
      else { setSelectedSkills([]); setSelectionNotice('La habilidad del enlace no está en el temario de este grupo. Elige una de las disponibles.'); }
    }
    if (requested.get('assign') === '1') focusPanel();
  }, [request.status, query, skills]);

  return <div className="curriculum-page" style={{ '--curriculum-accent': COLORS.primary }}>
    <header>
      <h1 className="font-display" style={pageTitle}>Temario de {group.grade}.º · {group.name}</h1>
      <p style={{ ...mutedText, margin: '8px 0' }}>Fase {group.phase} · Contenidos y procesos de desarrollo de aprendizaje del grupo.</p>
      <p style={{ ...noticeBox, margin: '8px 0' }}>El temario de ejemplo está por validar con docente de primaria.</p>
    </header>
    {request.status === 'loading' ? <p role="status" style={mutedText}>Cargando temario y cobertura…</p> : request.status === 'error' ? <div role="alert" style={alertBox}>
      <span>{errorMessageOf(request.error)}</span><button type="button" style={buttonStyle('secondary')} onClick={request.reload}>Reintentar temario</button>
    </div> : <>
      <CoverageCard request={request} />
      <button type="button" style={{ ...buttonStyle('secondary'), alignSelf: 'flex-start' }} onClick={focusPanel}>Preparar prueba →</button>
      <div className="curriculum-columns">
        <section className="curriculum-stack" aria-labelledby="contents-heading">
          <h2 id="contents-heading" className="font-display" style={sectionTitle}>Contenidos del grado</h2>
          {request.contents.length === 0 && <p style={card}>Todavía no hay contenidos registrados para este grado.</p>}
          {request.contents.map((content) => {
            const pending = request.pending.includes(content.id);
            return <article key={content.id} style={card}>
              <div style={{ ...mutedText, fontSize: '13px' }}>{content.formativeFieldName} · Fase {content.phase}</div>
              <Link to={`/docente/temario/${content.id}`} className="curriculum-content-title">{content.title} →</Link>
              <p style={{ margin: 0, lineHeight: 1.5 }}><strong>Se espera:</strong> {content.pda}</p>
              {content.skill ? <label className="curriculum-choice" style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px' }}>
                <input type="checkbox" checked={selectedSkills.includes(content.skill.code)} onChange={() => setSelectedSkills((current) => toggleSelection(current, content.skill.code))} />
                <span>Incluir {content.skill.name} en la prueba</span>
              </label> : <p style={mutedText}>Este contenido aún no tiene una habilidad vinculada para evaluar.</p>}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700 }} htmlFor={`content-status-${content.id}`}>
                Avance del contenido
                <select id={`content-status-${content.id}`} value={content.status} disabled={pending} style={inputStyle} onChange={(event) => request.updateContent(content.id, { status: event.target.value }).catch(() => {})}>
                  {CONTENT_STATUSES.map((status) => <option key={status.code} value={status.code}>{status.label}</option>)}
                </select>
              </label>
              {pending && <p role="status" style={{ ...mutedText, margin: 0 }}>Guardando avance…</p>}
              {request.errors[content.id] && <p role="alert" style={{ ...alertBox, margin: 0 }}>{errorMessageOf(request.errors[content.id])} Se restauró el avance anterior.</p>}
            </article>;
          })}
        </section>
        <AssignmentPanel group={group} skills={skills} selectedSkills={selectedSkills} onSkillsChange={setSelectedSkills} headingRef={headingRef} selectionNotice={selectionNotice} />
      </div>
    </>}
  </div>;
}

export function CurriculumScreen() {
  const { activeGroup, status, retry } = useTeacherGroups();
  if (!activeGroup || status !== 'ready') return <CurriculumGroupState status={status} retry={retry} />;
  // Remontar evita conservar borradores y respuestas del grupo que se dejó de consultar.
  return <GroupCurriculum key={activeGroup.id} group={activeGroup} />;
}
