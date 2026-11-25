import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COLORS, TEAM_LEARNING_NAME } from '@/config/brand';
import { MasteryValue, StudentIdentity } from '@/features/group-map/AnalyticsComponents';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { errorMessageOf } from '@/shared/api/client';
import { InterfaceIcon } from '@/shared/components/InterfaceIcon';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useSession } from '@/shared/state/SessionContext';
import { buttonStyle, card, mutedText, noticeBox, pageTitle } from '@/shared/styles/ui';
import { tutoringApi } from './tutoring.api';
import { assignTutor, groupRows, rowsFromProposal, sessionBody, tutorOptions } from './tutoring.logic';
import { useRequest } from './useTutoring';
import './tutoring.css';

const PRIVACY = 'Las tarjetas incluyen nombres de alumnos. Imprímelas y guárdalas solo dentro de la escuela.';

async function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StateMessage({ request, label }) {
  if (request.status === 'loading') return <p role="status" aria-live="polite">Cargando {label}…</p>;
  if (request.status === 'error') return <div role="alert" style={card}><p style={{ margin: 0 }}>{errorMessageOf(request.error)}</p><button type="button" style={buttonStyle('primary')} onClick={request.retry}>Reintentar</button></div>;
  return null;
}

function NetworkSummary({ network }) {
  const [open, setOpen] = useState(false);
  const pct = network.studentCount ? Math.round(network.teachSomethingCount / network.studentCount * 100) : 0;
  return <section className="tut-panel tut-network" aria-labelledby="network-title">
    <div className="tut-network-hero">
      <span className="tut-eyebrow">TODOS ENSEÑAN ALGO</span>
      <h2 id="network-title" className="font-display"><strong>{network.teachSomethingCount}</strong> de {network.studentCount} alumnos ya pueden enseñar algo</h2>
      <div className="tut-meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <p>Puede guiar quien resuelve la habilidad por su cuenta (Dominado) o quien ya demostró 3 de 3 sin ayuda al practicar en equipo.{network.tutorsWhoWereTuteesCount > 0 && ` ${network.tutorsWhoWereTuteesCount} compañeros guía de hoy recibieron acompañamiento antes.`}</p>
    </div>
    <ul className="tut-skill-counts">{network.skills.map((skill) => <li key={skill.code}><span>{skill.name}</span><strong>{skill.canTeachCount}</strong><small>pueden enseñar</small></li>)}</ul>
    <button type="button" style={buttonStyle('ghost')} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Ocultar' : 'Ver'} qué puede enseñar cada alumno</button>
    {open && <ul className="tut-teachers">{network.students.map((student) => <li key={student.id}><StudentIdentity student={student} />
      <span>{student.canTeach.length ? student.canTeach.map((skill) => skill.name).join(', ') : 'Aún practicando; pronto enseñará algo'}</span></li>)}</ul>}
  </section>;
}

function SkillPicker({ skills, value, onChange }) {
  return <div className="tut-skill-picker" role="group" aria-label="Habilidad de la sesión">
    {skills.map((skill) => <button key={skill.code} type="button" aria-pressed={skill.code === value} className="tut-skill-chip" onClick={() => onChange(skill.code)}>
      <strong>{skill.name}</strong><span>{skill.tutorCount} pueden guiar · {skill.tuteeCount} por acompañar</span>
    </button>)}
  </div>;
}

function TuteeRow({ tutee, rows, tutors, maxPerTutor, originalTutorId, currentTutorId, onChange, editable }) {
  const options = tutorOptions(tutors, rows, tutee.id, maxPerTutor);
  const showOvercame = tutee.tutorOvercameError && currentTutorId === originalTutorId;
  return <li className="tut-tutee">
    <div className="tut-tutee-head"><span className="tut-role">Compañero que practica</span><StudentIdentity student={tutee} /><MasteryValue percentage={tutee.masteryPercentage} level={tutee.level} label={tutee.label} /></div>
    <p className="tut-error">{tutee.explanation ? <>Error a trabajar: <strong>{tutee.explanation}</strong></> : 'Sin error típico registrado: practicar la habilidad paso a paso.'}</p>
    {showOvercame && <span className="tut-badge">★ Su compañero guía superó este mismo error</span>}
    {editable && <label className="tut-select">Lo acompaña
      <select value={currentTutorId ?? ''} onChange={(event) => onChange(tutee.id, event.target.value === '' ? null : Number(event.target.value))}>
        <option value="">Mesa docente</option>
        {options.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.name}</option>)}
      </select></label>}
  </li>;
}

function PairsEditor({ proposal, groupId, canEdit, onSaved, onOpenMaterial }) {
  // Las ediciones pertenecen a una propuesta: si llega otra, se parte de ella en el mismo render.
  const [edit, setEdit] = useState(() => ({ source: proposal, rows: rowsFromProposal(proposal) }));
  const rows = edit.source === proposal ? edit.rows : rowsFromProposal(proposal);
  const [state, setState] = useState({ pending: false, error: '' });
  const [adjusting, setAdjusting] = useState(false);
  const active = useRef(true);
  const saving = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const people = useMemo(() => new Map([...proposal.tutors, ...proposal.pairs.flatMap((pair) => pair.tutees), ...proposal.teacherTable]
    .map((student) => [student.id, student])), [proposal]);
  const tutees = useMemo(() => new Map([...proposal.pairs.flatMap((pair) => pair.tutees.map((tutee) => [tutee.id, { ...tutee, originalTutorId: pair.tutor.id }])),
    ...proposal.teacherTable.map((tutee) => [tutee.id, { ...tutee, originalTutorId: null }])]), [proposal]);
  const grouped = groupRows(rows);
  const change = (tuteeId, tutorId) => {
    if (saving.current || state.saved) return;
    setEdit({ source: proposal, rows: assignTutor(rows, tuteeId, tutorId, proposal.maxPerTutor) });
  };
  const row = (id) => <TuteeRow key={id} tutee={tutees.get(id)} rows={rows} tutors={proposal.tutors} maxPerTutor={proposal.maxPerTutor}
    originalTutorId={tutees.get(id).originalTutorId} currentTutorId={rows.find((r) => r.tuteeId === id).tutorId} onChange={change} editable={canEdit && !state.pending && !state.saved} />;
  const save = async () => {
    if (saving.current || state.saved) return;
    saving.current = true;
    setState({ pending: true, error: '' });
    try {
      const session = await tutoringApi.createSession(groupId, sessionBody(proposal.skill.code, rows));
      if (!active.current) return;
      setState({ pending: false, error: '', saved: true });
      onSaved(session);
    } catch (error) {
      if (active.current) setState({ pending: false, error: errorMessageOf(error) });
    } finally { saving.current = false; }
  };
  if (!rows.length) return <p style={noticeBox}>En {proposal.skill.name} nadie necesita acompañamiento ahora, o aún no hay evidencia. Elige otra habilidad.</p>;
  const idle = proposal.tutors.filter((tutor) => !grouped.pairs.some((pair) => pair.tutorId === tutor.id) && !tutees.has(tutor.id));
  return <div className="tut-editor">
    <div className="tut-proposal-summary">
      <div><span className="tut-eyebrow">2 · EQUIPOS LISTOS PARA REVISAR</span><h3>La propuesta se forma automáticamente</h3><p>Según la evidencia de aprendizaje de tu grupo. Cada compañero guía acompaña hasta a {proposal.maxPerTutor} compañeros.</p></div>
      <dl className="tut-counts"><div><dt>Equipos</dt><dd>{grouped.pairs.length}</dd></div><div><dt>Compañeros que practican</dt><dd>{rows.length}</dd></div><div><dt>Mesa docente</dt><dd>{grouped.teacherTable.length}</dd></div></dl>
      {state.error && <p role="alert" style={{ margin: 0, color: COLORS.alertFg }}>{state.error}</p>}
      {state.saved ? <div className="tut-saved"><p role="status">✓ Equipos guardados. Tu material está listo en el paso 3.</p><button type="button" style={buttonStyle('secondary')} onClick={onOpenMaterial}>Ir al material</button></div> : canEdit ? <button type="button" style={buttonStyle('primary', { tall: true, fullWidth: true })} disabled={state.pending} onClick={save}><InterfaceIcon name="paper" size={20} />{state.pending ? 'Guardando equipos…' : 'Guardar equipos y preparar material'}</button> : <p style={mutedText}>Vista de consulta: solo el docente del grupo guarda equipos.</p>}
    </div>
    {!proposal.tutors.length && <p style={noticeBox}>Hoy el grupo trabaja en la mesa docente. Al reunir nueva evidencia podrán formarse equipos con compañeros guía.</p>}
    <ul className="tut-preview" aria-label="Vista previa de equipos">{grouped.pairs.map((pair, index) => <li key={pair.tutorId}><span className="tut-preview-number">{index + 1}</span><div><strong>{people.get(pair.tutorId).name}</strong><span>Compañero guía</span><p>{pair.tuteeIds.map((id) => tutees.get(id).name).join(' · ')}</p></div></li>)}{grouped.teacherTable.length > 0 && <li className="tut-preview-teacher"><InterfaceIcon name="book" /><div><strong>Mesa docente</strong><p>{grouped.teacherTable.map((id) => tutees.get(id).name).join(' · ')}</p></div></li>}</ul>
    <button type="button" className="tut-adjust-toggle" aria-expanded={adjusting} onClick={() => setAdjusting((value) => !value)}>{adjusting ? 'Cerrar ajustes de equipos' : 'Ajustar equipos'}<span aria-hidden="true">{adjusting ? '−' : '+'}</span></button>
    {adjusting && <div className="tut-adjustments">
    {grouped.pairs.length > 0 && <ol className="tut-pairs">{grouped.pairs.map((pair) => {
      const tutor = people.get(pair.tutorId);
      return <li key={pair.tutorId} className="tut-pair">
        <div className="tut-tutor"><span className="tut-role">Compañero guía</span><StudentIdentity student={tutor} />
          <span style={mutedText}>{tutor.readyToTeach ? 'Demostró 3 de 3 al practicar en equipo' : `${tutor.masteryPercentage}% · ${tutor.label}`}</span></div>
        <ul className="tut-tutees" aria-label={`Compañeros de ${tutor.name}`}>{pair.tuteeIds.map(row)}</ul>
      </li>;
    })}</ol>}
    {grouped.teacherTable.length > 0 && <section className="tut-pair tut-teacher-table" aria-labelledby="teacher-table-title">
      <div className="tut-tutor"><span className="tut-role">Mesa docente</span><h3 id="teacher-table-title">Los acompañas tú ({grouped.teacherTable.length})</h3>
        <span style={mutedText}>Quienes más apoyo necesitan trabajan contigo mientras las parejas avanzan.</span></div>
      <ul className="tut-tutees">{grouped.teacherTable.map(row)}</ul>
    </section>}
    {idle.length > 0 && <p style={mutedText}>Compañeros guía disponibles: {idle.map((tutor) => tutor.name).join(', ')}. Puedes asignarlos arriba.</p>}
    </div>}
  </div>;
}

function DemonstrationButtons({ pair, groupId, editable, onRecorded }) {
  const [state, setState] = useState({ pending: null, error: '' });
  const record = async (correct) => {
    setState({ pending: correct, error: '' });
    try { const result = await tutoringApi.recordDemonstration(groupId, pair.id, correct); setState({ pending: null, error: '' }); onRecorded(pair, result); }
    catch (error) { setState({ pending: null, error: errorMessageOf(error) }); }
  };
  return <div className="tut-demo">
    <div className="tut-demo-buttons" role="group" aria-label={`Aciertos sin ayuda de ${pair.tutee.name}`}>
      {[0, 1, 2, 3].map((value) => <button key={value} type="button" aria-pressed={pair.demonstration?.correct === value}
        disabled={!editable || state.pending !== null} onClick={() => record(value)}>{state.pending === value ? '…' : value}</button>)}
      <span>de 3</span>
    </div>
    {pair.demonstration && <span className={`tut-result tut-result-${pair.demonstration.code}`}>{pair.demonstration.code === 'ready_to_teach' ? '★ ' : ''}{pair.demonstration.label}</span>}
    {state.error && <span role="alert" style={{ color: COLORS.alertFg }}>{state.error}</span>}
  </div>;
}

function SessionCard({ session, groupId, editable, onRecorded, highlighted }) {
  const [download, setDownload] = useState({ pending: null, message: '', error: false });
  const done = session.pairs.filter((pair) => pair.demonstration).length;
  const getPdf = async (part) => {
    setDownload({ pending: part, message: '', error: false });
    const filename = part === 'key' ? `hoja-docente-equipo-${session.id}.pdf` : `tarjetas-equipo-${session.id}.pdf`;
    const ready = part === 'key' ? 'Hoja docente lista: incluye la clave, no la repartas.' : 'Tarjetas listas para repartir a los compañeros guía.';
    try { await saveBlob(await tutoringApi.pdf(groupId, session.id, part), filename); setDownload({ pending: null, message: `${ready} ${PRIVACY}`, error: false }); }
    catch (error) { setDownload({ pending: null, message: errorMessageOf(error), error: true }); }
  };
  return <article className={`tut-panel tut-session ${highlighted ? 'tut-session-new' : ''}`} aria-labelledby={`session-${session.id}`}>
    <header className="tut-session-head"><div><span className="tut-eyebrow">SESIÓN {session.id}</span>
      <h3 id={`session-${session.id}`} className="font-display">{session.skillName}</h3>
      <span style={mutedText}>{new Date(`${session.createdAt.replace(' ', 'T')}Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })} · {done} de {session.pairs.length} demostraciones capturadas</span></div>
      <div className="tut-session-actions">
        <button type="button" style={buttonStyle(highlighted ? 'primary' : 'secondary')} disabled={Boolean(download.pending)} onClick={() => getPdf('cards')}><InterfaceIcon name="paper" size={18} />{download.pending === 'cards' ? 'Preparando…' : 'Descargar tarjetas de equipo'}</button>
        <button type="button" style={buttonStyle('secondary')} disabled={Boolean(download.pending)} onClick={() => getPdf('key')}><InterfaceIcon name="pencil" size={18} />{download.pending === 'key' ? 'Preparando…' : 'Descargar hoja docente'}</button>
      </div>
    </header>
    {download.message && <p role={download.error ? 'alert' : 'status'} style={{ margin: 0, ...mutedText, color: download.error ? COLORS.alertFg : COLORS.muted }}>{download.message}</p>}
    <details className="tut-disclosure"><summary>Registrar práctica individual <span>{done}/{session.pairs.length}</span></summary>
    <p style={mutedText}>Al terminar, cada compañero resuelve sin ayuda 3 reactivos. Con 3 de 3 podrá guiar en otra sesión; esta práctica no modifica el dominio del mapa.</p>
    <ul className="tut-demo-list">{session.pairs.map((pair) => <li key={pair.id}>
      <div className="tut-demo-who"><StudentIdentity student={pair.tutee} /><span style={mutedText}>con {pair.tutor ? pair.tutor.name : 'el docente'}{pair.tutorInactive ? ' (su compañero guía ya no está en el grupo)' : ''}</span></div>
      <DemonstrationButtons pair={pair} groupId={groupId} editable={editable} onRecorded={onRecorded} />
    </li>)}</ul></details>
  </article>;
}

function ErrorsSpread({ errors, skills }) {
  if (!errors.length) return null;
  const skillName = (code) => skills.find((skill) => skill.code === code)?.name ?? code;
  return <section className="tut-panel" aria-labelledby="spread-title"><span className="tut-eyebrow">CÓMO SE EXTIENDE EL SABER</span>
    <h2 id="spread-title" className="font-display">Errores trabajados en equipo</h2>
    <ul className="tut-spread">{errors.map((error) => <li key={`${error.skillCode}-${error.errorTag}`}>
      <strong>{error.explanation || 'Práctica general de la habilidad'}</strong><span style={mutedText}>{skillName(error.skillCode)}</span>
      <dl><div><dt>Acompañados</dt><dd>{error.tutoredCount}</dd></div><div><dt>Demostraron</dt><dd>{error.demonstratedCount}</dd></div>
        <div><dt>Ya pueden enseñarlo</dt><dd>{error.readyToTeachCount}</dd></div><div><dt>Van avanzando</dt><dd>{error.progressingCount}</dd></div></dl>
    </li>)}</ul>
    <p style={{ ...mutedText, margin: 0 }}>La demostración es evidencia para formar nuevas parejas; no cambia el dominio oficial del mapa del grupo.</p>
  </section>;
}

/** Equipos automáticos, tarjetas impresas y práctica individual. */
export function TutoringScreen() {
  const groups = useTeacherGroups();
  const { session } = useSession();
  const groupId = groups.activeGroup?.id;
  const [skillCode, setSkillCode] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [planVersion, setPlanVersion] = useState(0);
  const activeGroup = useRef(groupId);
  const materialSection = useRef(null);
  const openedMaterial = useRef(null);
  const reducedMotion = useReducedMotion();
  const openMaterial = useCallback(() => {
    materialSection.current?.focus({ preventScroll: true });
    materialSection.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [reducedMotion]);
  activeGroup.current = groupId;
  const proposal = useRequest(groupId ? `${groupId}|${skillCode}` : null, (options) => tutoringApi.proposal(groupId, skillCode, options));
  const sessions = useRequest(groupId ? String(groupId) : null, (options) => tutoringApi.sessions(groupId, options));
  const [demoOverrides, setDemoOverrides] = useState({});
  useEffect(() => { setSkillCode(''); setCreatedSession(null); setDemoOverrides({}); }, [groupId]);
  useEffect(() => { if (sessions.status === 'ready') setDemoOverrides({}); }, [sessions.status, sessions.data]);
  useEffect(() => {
    const savedKey = createdSession?.groupId === groupId ? `${groupId}|${createdSession.session.id}` : null;
    if (savedKey && openedMaterial.current !== savedKey) openMaterial();
    openedMaterial.current = savedKey;
  }, [createdSession, groupId, openMaterial]);

  if (groups.status === 'loading') return <p role="status">Cargando grupos…</p>;
  if (!groups.activeGroup) return <div style={card}><h1 style={pageTitle}>{TEAM_LEARNING_NAME}</h1><p style={mutedText}>Crea un grupo y agrega alumnos para formar equipos.</p></div>;
  const canEdit = session?.role === 'teacher';
  const onSaved = (created) => {
    if (activeGroup.current !== groupId) return;
    setCreatedSession({ groupId, session: created });
    sessions.retry();
  };
  // La captura se ve al instante; la red se actualiza en segundo plano. La propuesta solo se
  // recarga si cambió quién puede ser tutor (entrar o salir de 3 de 3).
  const onRecorded = (pair, result) => {
    if (activeGroup.current !== groupId) return;
    setDemoOverrides((current) => ({ ...current, [pair.id]: result.demonstration }));
    sessions.retry();
    if ([pair.demonstration?.code, result.demonstration?.code].includes('ready_to_teach')) proposal.retry();
  };
  const justCreated = createdSession?.groupId === groupId ? createdSession.session : null;
  const listedSessions = sessions.data?.sessions ?? [];
  const allSessions = justCreated && !listedSessions.some((item) => item.id === justCreated.id) ? [justCreated, ...listedSessions] : listedSessions;
  const sessionList = allSessions.map((item) => ({ ...item,
    pairs: item.pairs.map((pair) => pair.id in demoOverrides ? { ...pair, demonstration: demoOverrides[pair.id] } : pair) })) ?? [];
  const recentSession = sessionList.find((item) => item.id === justCreated?.id) ?? sessionList[0];
  const history = sessionList.filter((item) => item.id !== recentSession?.id);

  return <div className="tutoring">
    <header className="tut-header"><span className="tut-hero-icon"><InterfaceIcon name="groups" size={28} /></span><div><span className="tut-eyebrow">ACOMPAÑARSE TAMBIÉN ES APRENDER</span>
      <h1 className="font-display" style={pageTitle}>{TEAM_LEARNING_NAME}</h1>
      <p>Elige una habilidad. Te proponemos los equipos de {groups.activeGroup.name} para que prepares la clase en pocos pasos.</p></div></header>

    <section className="tut-panel" aria-labelledby="pairs-title"><span className="tut-eyebrow">1 · ELIGE LA HABILIDAD</span>
      <h2 id="pairs-title" className="font-display">¿Qué habilidad trabajarán?</h2>
      {proposal.status === 'ready' ? <>
        <SkillPicker skills={proposal.data.skills} value={proposal.data.skill.code} onChange={setSkillCode} />
        <PairsEditor key={`${groupId}|${proposal.data.skill.code}|${planVersion}`} proposal={proposal.data} groupId={groupId} canEdit={canEdit} onSaved={onSaved} onOpenMaterial={openMaterial} />
      </> : <StateMessage request={proposal} label="la propuesta" />}
    </section>

    <section ref={materialSection} tabIndex={-1} className="tut-sessions" aria-labelledby="sessions-title"><div><span className="tut-eyebrow">3 · PREPARA LA CLASE</span>
      <h2 id="sessions-title" className="font-display">Material para tus equipos</h2>
      <p style={{ ...mutedText, margin: 0 }}>Imprime las tarjetas y acompaña la práctica. Los alumnos trabajan en papel.</p></div>
      {justCreated && <p className="tut-saved" role="status">✓ Equipos guardados. Ya puedes descargar el material.</p>}
      <StateMessage request={sessions} label="las sesiones" />
      {sessions.status === 'ready' && !sessionList.length && <p className="tut-empty">Guarda los equipos del paso 2 y aquí encontrarás tus tarjetas para imprimir.</p>}
      {recentSession && <SessionCard key={`${groupId}|${recentSession.id}`} session={recentSession} groupId={groupId} editable={canEdit} onRecorded={onRecorded} highlighted={recentSession.id === justCreated?.id} />}
      {justCreated && canEdit && <button type="button" className="tut-adjust-toggle" onClick={() => { setCreatedSession(null); setPlanVersion((value) => value + 1); }}>Preparar otra sesión</button>}
      {history.length > 0 && <details className="tut-disclosure"><summary>Sesiones anteriores <span>{history.length}</span></summary><div className="tut-history">{history.map((item) => <SessionCard key={`${groupId}|${item.id}`} session={item} groupId={groupId} editable={canEdit} onRecorded={onRecorded} />)}</div></details>}
    </section>

    {sessions.status === 'ready' && <details className="tut-disclosure tut-panel"><summary>Ver avances del grupo</summary><NetworkSummary network={sessions.data.network} /><ErrorsSpread errors={sessions.data.network.errors} skills={sessions.data.network.skills} /></details>}
    <p style={{ ...mutedText, margin: 0 }}>Guiones y frases de pregunta por validar con docente de primaria.</p>
  </div>;
}
