import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessageOf } from '@/shared/api/client';
import { alertBox, buttonStyle, card, mutedText, pageTitle, sectionTitle } from '@/shared/styles/ui';
import { CaptureProgress, PaperGroupBoundary, PaperRequestState } from './PaperComponents';
import { paperApi } from './paper.api';
import { usePaperAssignment } from './usePaperAssignment';
import './paper-mode.css';

const DOWNLOAD_META = {
  sheet: { label: 'Descargar hoja', prefix: 'hoja', variant: 'secondary' },
  'answer-sheet': { label: 'Descargar hoja de respuestas escaneable', prefix: 'hoja-respuestas', variant: 'secondary' },
  hints: { label: 'Descargar tarjetas de pistas', prefix: 'pistas', variant: 'secondary' },
};

function PdfDownload({ assignmentId, kind = 'sheet' }) {
  const [state, setState] = useState({ pending: false, error: null, downloaded: false });
  const alive = useRef(true);
  const sending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const meta = DOWNLOAD_META[kind];
  const download = async () => {
    if (sending.current) return;
    sending.current = true;
    setState({ pending: true, error: null, downloaded: false });
    try {
      const fetchPdf = kind === 'hints'
        ? paperApi.downloadHints
        : kind === 'answer-sheet'
          ? paperApi.downloadAnswerSheet
          : paperApi.downloadSheet;
      const blob = await fetchPdf(assignmentId);
      if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${meta.prefix}-${assignmentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Se libera después de que el navegador ha tomado el archivo para la descarga.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState({ pending: false, error: null, downloaded: true });
    } catch (error) {
      if (alive.current) setState({ pending: false, error, downloaded: false });
    } finally { sending.current = false; }
  };
  return <div className="paper-page" style={{ gap: '8px' }}>
    <button type="button" disabled={state.pending} style={buttonStyle(meta.variant, { disabled: state.pending, fullWidth: true })} onClick={download}>{state.pending ? 'Preparando descarga…' : meta.label}</button>
    {state.error && <p role="alert" style={{ ...alertBox, margin: 0 }}>{errorMessageOf(state.error)}</p>}
    {state.downloaded && <p role="status" style={{ ...mutedText, margin: 0 }}>Descarga preparada.</p>}
  </div>;
}

function GroupPaperAssignment({ group, assignmentId }) {
  const request = usePaperAssignment(group.id, assignmentId);
  if (request.status !== 'ready') return <PaperRequestState request={request} />;
  const { assignment, captureStatus } = request;
  return <div className="paper-page">
    <Link to="/docente/papel" style={{ ...buttonStyle('ghost'), alignSelf: 'flex-start' }}>← Pruebas en papel</Link>
    <header><h1 className="font-display" style={pageTitle}>{assignment.title}</h1><p style={mutedText}>{group.name} · {assignment.questionCount} reactivos · {assignment.skills.map((skill) => skill.name).join(' · ')}</p></header>
    <CaptureProgress request={request} />
    <section style={card}>
      <h2 className="font-display" style={sectionTitle}>Material para imprimir</h2>
      <p style={{ ...mutedText, margin: 0 }}>Hojas genéricas, sin nombres, en blanco y negro y tamaño Carta. Imprime la hoja de la prueba (incluye la casilla “Apoyo durante la prueba”) y, si vas a escanear con el celular, imprime también la hoja de respuestas escaneable. Entrega las tarjetas de pistas una a la vez.</p>
      <div className="paper-actions">
        <PdfDownload assignmentId={assignment.id} kind="sheet" />
        <PdfDownload assignmentId={assignment.id} kind="answer-sheet" />
        <PdfDownload assignmentId={assignment.id} kind="hints" />
      </div>
    </section>
    {assignment.status === 'closed' ? <p style={mutedText}>Esta prueba está cerrada. Puedes consultar y descargar sus materiales.</p> : captureStatus.pending > 0 ? <Link to={`/docente/papel/${assignment.id}/captura`} style={buttonStyle('primary')}>Capturar hojas</Link> : <p role="status" style={{ ...mutedText, margin: 0 }}>Todas las hojas están capturadas.</p>}
    <Link to="/docente/mapa" style={buttonStyle('secondary')}>Ver Mapa del grupo</Link>
  </div>;
}

export function PaperAssignmentScreen() {
  const { assignmentId } = useParams();
  return <PaperGroupBoundary>{(group) => <GroupPaperAssignment key={`${group.id}:${assignmentId}`} group={group} assignmentId={assignmentId} />}</PaperGroupBoundary>;
}
