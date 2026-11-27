import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessageOf } from '@/shared/api/client';
import { alertBox, buttonStyle, card, mutedText, pageTitle } from '@/shared/styles/ui';
import { PaperGroupBoundary } from './PaperComponents';
import { paperApi } from './paper.api';
import './paper-mode.css';

function GroupPaperAssignments({ group }) {
  const [request, setRequest] = useState({ status: 'loading', assignments: [], error: null });
  const version = useRef(0);
  const alive = useRef(false);
  const reload = useCallback(async () => {
    const currentVersion = ++version.current;
    setRequest((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const assignments = (await paperApi.listGroupAssignments(group.id)).filter((item) => item.modality === 'paper');
      const rows = await Promise.all(assignments.map(async (assignment) => ({
        ...assignment,
        captureStatus: await paperApi.getCaptureStatus(assignment.id),
      })));
      if (alive.current && currentVersion === version.current) setRequest({ status: 'ready', assignments: rows, error: null });
    } catch (error) {
      if (alive.current && currentVersion === version.current) setRequest({ status: 'error', assignments: [], error });
    }
  }, [group.id]);
  useEffect(() => { alive.current = true; reload(); return () => { alive.current = false; ++version.current; }; }, [reload]);

  return <div className="paper-page">
    <header><h1 className="font-display" style={pageTitle}>Modo Papel</h1><p style={mutedText}>{group.name} · Descarga hojas y registra las respuestas de tu grupo.</p></header>
    {request.status === 'loading' ? <p role="status" style={mutedText}>Cargando pruebas en papel…</p> : request.status === 'error' ? <div role="alert" style={alertBox}><p>{errorMessageOf(request.error)}</p><button type="button" style={buttonStyle('secondary')} onClick={reload}>Reintentar pruebas</button></div> : request.assignments.length === 0 ? <section style={card}>
      <p style={mutedText}>No hay pruebas en papel. Asígnala desde el Temario.</p><Link to="/docente/temario" style={buttonStyle('primary')}>Ir al Temario</Link>
    </section> : <div className="paper-grid">{request.assignments.map((assignment) => <article key={assignment.id} style={card}>
      <h2 className="font-display" style={{ margin: 0, fontSize: '22px' }}>{assignment.title}</h2>
      <p style={{ ...mutedText, margin: 0 }}>{assignment.skills.map((skill) => skill.name).join(' · ')} · {assignment.questionCount} reactivos</p>
      <p style={{ margin: 0 }}><strong>{assignment.captureStatus.captured} de {assignment.captureStatus.total}</strong> hojas capturadas · {assignment.captureStatus.pending} pendientes</p>
      {assignment.status === 'closed' && <p style={{ ...mutedText, margin: 0 }}>Prueba cerrada</p>}
      <Link to={`/docente/papel/${assignment.id}`} style={buttonStyle('primary')}>Abrir prueba</Link>
    </article>)}</div>}
  </div>;
}

export function PaperAssignmentsScreen() {
  return <PaperGroupBoundary>{(group) => <GroupPaperAssignments key={group.id} group={group} />}</PaperGroupBoundary>;
}
