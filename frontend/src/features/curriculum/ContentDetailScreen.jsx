import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { errorMessageOf } from '@/shared/api/client';
import { alertBox, buttonStyle, card, inputStyle, mutedText, noticeBox, pageTitle, sectionTitle } from '@/shared/styles/ui';
import { CurriculumGroupState } from './CurriculumScreen';
import { CONTENT_STATUSES, assignmentLink } from './curriculum.logic';
import { useCurriculum } from './useCurriculum';
import './curriculum.css';

function ContentNotes({ content, request }) {
  const [draft, setDraft] = useState(content.notes ?? '');
  const [savedMessage, setSavedMessage] = useState('');
  const pending = request.pending.includes(content.id);
  const dirty = draft !== (content.notes ?? '');
  const save = async (event) => {
    event.preventDefault();
    if (pending || !dirty) return;
    setSavedMessage('');
    try {
      const saved = await request.updateContent(content.id, { notes: draft });
      if (saved) { setDraft(saved.notes ?? ''); setSavedMessage('Notas guardadas.'); }
    } catch { /* El hook muestra el error y conserva el borrador. */ }
  };
  return <form onSubmit={save} style={card}>
    <h2 style={sectionTitle} className="font-display">Notas de mi escuela</h2>
    <label htmlFor="curriculum-notes" style={{ fontWeight: 700 }}>Contexto para trabajar este contenido</label>
    <p id="notes-help" style={{ ...mutedText, margin: 0 }}>No incluyas nombres de alumnos. Máximo 500 caracteres.</p>
    <textarea id="curriculum-notes" rows={5} maxLength={500} value={draft} disabled={pending} onChange={(event) => { setDraft(event.target.value); setSavedMessage(''); }} aria-describedby="notes-help notes-count" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
    <div id="notes-count" style={mutedText}>{draft.length} de 500 caracteres</div>
    <p role="status" style={{ ...mutedText, margin: 0 }}>{pending ? 'Guardando notas…' : savedMessage || (dirty ? 'Cambios sin guardar.' : 'Sin cambios pendientes.')}</p>
    {request.errors[content.id] && <p role="alert" style={{ ...alertBox, margin: 0 }}>{errorMessageOf(request.errors[content.id])} El borrador se conserva para reintentar.</p>}
    <button type="submit" style={buttonStyle('primary', { disabled: pending || !dirty })} disabled={pending || !dirty}>Guardar notas</button>
  </form>;
}

function GroupContentDetail({ group, contentId }) {
  const request = useCurriculum(group.id);
  const content = request.contents.find((entry) => String(entry.id) === contentId);
  return <div className="curriculum-page">
    <Link to="/docente/temario" style={{ ...buttonStyle('ghost'), alignSelf: 'flex-start' }}>← Temario de {group.grade}.º</Link>
    {request.status === 'loading' ? <p role="status" style={mutedText}>Cargando contenido…</p> : request.status === 'error' ? <div role="alert" style={alertBox}><span>{errorMessageOf(request.error)}</span><button type="button" onClick={request.reload} style={buttonStyle('secondary')}>Reintentar</button></div> : !content ? <section style={card}>
      <h1 className="font-display" style={pageTitle}>Contenido no encontrado</h1><p style={mutedText}>No encontramos este contenido en el grupo seleccionado.</p><Link to="/docente/temario" style={buttonStyle('secondary')}>Volver al temario</Link>
    </section> : <>
      <header>
        <p style={mutedText}>{content.formativeFieldName} · {content.grade}.º · Fase {content.phase} · {group.name}</p>
        <h1 className="font-display" style={pageTitle}>{content.title}</h1>
        <p style={mutedText}>Avance: <strong>{CONTENT_STATUSES.find((status) => status.code === content.status)?.label ?? content.status}</strong> · {content.skill?.name ?? 'Sin habilidad vinculada'}</p>
      </header>
      <p style={{ ...noticeBox, margin: 0 }}>Contenido de ejemplo por validar con docente de primaria.</p>
      <section style={card}>
        <h2 className="font-display" style={sectionTitle}>Proceso de desarrollo de aprendizaje</h2>
        <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{content.pda}</p>
      </section>
      <ContentNotes key={content.id} content={content} request={request} />
      {content.skill ? <Link to={assignmentLink(content.skill.code)} style={{ ...buttonStyle('primary'), alignSelf: 'flex-start' }}>Asignar prueba de este contenido</Link> : <p style={mutedText}>Este contenido necesita una habilidad vinculada antes de preparar una prueba.</p>}
    </>}
  </div>;
}

export function ContentDetailScreen() {
  const { contentId } = useParams();
  const { activeGroup, status, retry } = useTeacherGroups();
  if (!activeGroup || status !== 'ready') return <CurriculumGroupState status={status} retry={retry} />;
  return <GroupContentDetail key={`${activeGroup.id}:${contentId}`} group={activeGroup} contentId={contentId} />;
}
