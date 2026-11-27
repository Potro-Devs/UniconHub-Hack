import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { readableTextOn } from '@/features/groups/groups.logic';
import { alertBox, buttonStyle, card, inputStyle, mutedText, noticeBox, pageTitle } from '@/shared/styles/ui';
import { CaptureProgress, PaperGroupBoundary, PaperRequestState } from './PaperComponents';
import { currentPaperTarget, paperCaptureBody, paperCaptureError, pendingPaperTargets, studentName, unansweredPaperCount } from './paper-mode.logic';
import { paperApi } from './paper.api';
import { usePaperAssignment } from './usePaperAssignment';
import './paper-mode.css';

function CaptureForm({ request, group }) {
  const { assignment, captureStatus, students } = request;
  const [preferredId, setPreferredId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [completedLocally, setCompletedLocally] = useState([]);
  const [passed, setPassed] = useState([]);
  const [submission, setSubmission] = useState({ pending: false, error: '', message: '' });
  const sending = useRef(false);
  const alive = useRef(false);
  const studentHeading = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const excluded = [...completedLocally, ...passed];
  const available = pendingPaperTargets(captureStatus.targets, excluded);
  const current = currentPaperTarget(captureStatus.targets, excluded, preferredId);
  const studentId = current?.studentId ?? null;
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const student = studentById.get(studentId);
  const draft = drafts[studentId] ?? { answers: {}, supportUsed: false };
  const unanswered = unansweredPaperCount(assignment.questions, draft);
  const closed = assignment.status !== 'active';
  useEffect(() => { studentHeading.current?.focus({ preventScroll: true }); }, [studentId]);

  const updateDraft = (patch) => setDrafts((currentDrafts) => ({
    ...currentDrafts,
    [studentId]: { answers: {}, supportUsed: false, ...currentDrafts[studentId], ...patch },
  }));
  const forgetDraft = (id) => setDrafts((currentDrafts) => {
    const next = { ...currentDrafts };
    delete next[id];
    return next;
  });
  const refreshAfterSave = async () => {
    // Un fallo aquí no revierte una hoja ya guardada ni ofrece reenviar sus respuestas.
    try { await request.refreshStatus(); } catch { /* CaptureProgress permite reintentar sin reenviar. */ }
  };
  const save = async (absent = false) => {
    if (sending.current || studentId == null || closed) return;
    const id = studentId;
    const body = paperCaptureBody(assignment.questions, draft, absent);
    sending.current = true;
    setSubmission({ pending: true, error: '', message: '' });
    try {
      await paperApi.capture(assignment.id, id, body);
      if (!alive.current) return;
      if (absent) {
        setPassed((ids) => [...new Set([...ids, id])]);
        setSubmission({ pending: true, error: '', message: 'Registramos que faltó. Su hoja sigue pendiente para otra pasada.' });
      } else {
        setCompletedLocally((ids) => [...new Set([...ids, id])]);
        forgetDraft(id);
        setSubmission({ pending: true, error: '', message: 'Hoja guardada. Continuamos con la siguiente.' });
      }
      setPreferredId(null);
      await refreshAfterSave();
    } catch (error) {
      if (!alive.current) return;
      if (error?.code === 'ALREADY_CAPTURED') {
        setCompletedLocally((ids) => [...new Set([...ids, id])]);
        forgetDraft(id);
        setPreferredId(null);
        setSubmission({ pending: true, error: '', message: paperCaptureError(error) });
        await refreshAfterSave();
      } else setSubmission({ pending: false, error: paperCaptureError(error), message: '' });
    } finally {
      sending.current = false;
      if (alive.current) setSubmission((state) => ({ ...state, pending: false }));
    }
  };

  return <div className="paper-page paper-capture" style={{ '--paper-accent': COLORS.primary }}>
    <Link to={`/docente/papel/${assignment.id}`} style={{ ...buttonStyle('ghost'), alignSelf: 'flex-start' }}>← Material y avance</Link>
    <header><h1 className="font-display" style={pageTitle}>Capturar hojas</h1><p style={mutedText}>{assignment.title} · {group.name}</p></header>
    <CaptureProgress request={request} />
    {submission.message && <p role="status" style={{ ...noticeBox, margin: 0 }}>{submission.message}</p>}
    {submission.error && <p role="alert" style={{ ...alertBox, margin: 0 }}>{submission.error} Tus respuestas se conservan.</p>}
    {closed ? <section style={card}><h2 className="font-display" style={{ margin: 0 }}>Prueba cerrada</h2><p style={mutedText}>Esta prueba ya no permite capturar hojas. Puedes consultar sus resultados en el Mapa del grupo.</p></section> : !current ? <section style={card}>
      <h2 className="font-display" style={{ margin: 0 }}>{captureStatus.pending === 0 ? 'Todas las hojas están capturadas' : 'Terminaste esta pasada'}</h2>
      {captureStatus.pending > 0 && <>
        <p style={mutedText}>{request.refreshError ? 'Actualiza el avance para confirmar las hojas que todavía están pendientes.' : `Aún quedan ${captureStatus.pending} hojas pendientes. Puedes revisar a quienes faltaron cuando tengas sus respuestas.`}</p>
        <button type="button" style={buttonStyle('secondary')} disabled={submission.pending} onClick={() => { setPassed([]); setPreferredId(null); setSubmission({ pending: false, error: '', message: '' }); }}>Revisar pendientes</button>
      </>}
    </section> : <form className="paper-page" onSubmit={(event) => { event.preventDefault(); save(false); }}>
      <fieldset disabled={submission.pending} className="paper-fieldset">
        <section style={card}>
          <label htmlFor="paper-student" style={{ fontWeight: 700 }}>Alumno pendiente</label>
          <select id="paper-student" value={studentId} onChange={(event) => { setPreferredId(Number(event.target.value)); setSubmission({ pending: false, error: '', message: '' }); }} style={inputStyle}>
            {available.map((target) => <option key={target.studentId} value={target.studentId}>{studentName(studentById.get(target.studentId), target.studentId)}</option>)}
          </select>
          <div className="paper-student">
            <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', flex: 'none', width: '48px', height: '48px', borderRadius: '50%', background: student?.avatarColor ?? COLORS.surfaceSubtle, color: student?.avatarColor ? readableTextOn(student.avatarColor, COLORS.ink, COLORS.onPrimary) : COLORS.ink, border: `1px solid ${COLORS.border}`, fontWeight: 700 }}>{student?.initials ?? '—'}</span>
            <h2 ref={studentHeading} tabIndex={-1} className="font-display" style={{ margin: 0, fontSize: '22px' }}>{studentName(student, studentId)}</h2>
          </div>
          <label className="paper-option" style={{ border: `1px solid ${COLORS.border}` }}><input type="checkbox" checked={draft.supportUsed} onChange={(event) => updateDraft({ supportUsed: event.target.checked })} /><span><strong>Usó tarjetas de pistas</strong><br /><span style={mutedText}>Marca lo mismo que aparece en su hoja. Al marcarla, todos los aciertos de esta hoja se registran como “Logrado con apoyo”.</span></span></label>
        </section>
        {assignment.questions.map((question, index) => <div key={question.id} style={card}>
          <fieldset className="paper-fieldset">
            <legend>{index + 1}. {question.stem}</legend>
            {[...question.options.map((option) => ({ id: option.id, text: `${option.label}. ${option.text}` })), { id: null, text: 'Sin respuesta' }].map((option) => <label className="paper-option" key={option.id ?? 'unanswered'} style={{ border: `1px solid ${(draft.answers[question.id] ?? null) === option.id ? COLORS.primary : COLORS.border}`, background: (draft.answers[question.id] ?? null) === option.id ? COLORS.primarySoftBg : COLORS.surface }}>
              <input type="radio" name={`paper-question-${question.id}`} checked={(draft.answers[question.id] ?? null) === option.id} onChange={() => updateDraft({ answers: { ...draft.answers, [question.id]: option.id } })} /><span>{option.text}</span>
            </label>)}
          </fieldset>
        </div>)}
      </fieldset>
      <p role="status" style={{ ...mutedText, margin: 0 }}>{submission.pending ? 'Guardando hoja…' : `${unanswered} de ${assignment.questions.length} reactivos quedarán sin respuesta.`}</p>
      <div className="paper-actions">
        <button type="submit" disabled={submission.pending} style={buttonStyle('primary', { disabled: submission.pending })}>Guardar hoja y continuar</button>
        <button type="button" disabled={submission.pending} style={buttonStyle('secondary', { disabled: submission.pending })} onClick={() => save(true)}>Faltó y continuar</button>
      </div>
    </form>}
    <Link to="/docente/mapa" style={buttonStyle('secondary')}>Ver Mapa del grupo</Link>
  </div>;
}

function GroupQuickCapture({ group, assignmentId }) {
  const request = usePaperAssignment(group.id, assignmentId);
  if (request.status !== 'ready') return <PaperRequestState request={request} />;
  return <CaptureForm request={request} group={group} />;
}

export function QuickCaptureScreen() {
  const { assignmentId } = useParams();
  return <PaperGroupBoundary>{(group) => <GroupQuickCapture key={`${group.id}:${assignmentId}`} group={group} assignmentId={assignmentId} />}</PaperGroupBoundary>;
}
