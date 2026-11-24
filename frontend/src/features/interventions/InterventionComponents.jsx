import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/config/brand';
import { errorMessageOf } from '@/shared/api/client';
import { buttonStyle, card, inputStyle, mutedText, sectionTitle } from '@/shared/styles/ui';
import { interventionsApi } from './interventions.api';

const NOTE_LIMIT = 300;

export function formatDate(value) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible'
    : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
}

/** Registra que la actividad se aplicó. Solo el docente dueño del grupo puede hacerlo. */
export function ApplyActivityForm({ groupId, activity, onApplied, compact = false }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [state, setState] = useState({ pending: false, error: '', done: false });
  if (!activity) return null;
  if (state.done) return <p role="status" style={{ margin: 0, fontWeight: 700, color: COLORS.successFg, lineHeight: 1.5 }}>✓ Registrada. Cuando apliques una prueba corta de esta habilidad verás el antes y después.</p>;
  const submit = async (event) => {
    event.preventDefault();
    setState({ pending: true, error: '', done: false });
    try {
      const created = await interventionsApi.create(groupId, activity.id, note.trim());
      setState({ pending: false, error: '', done: true });
      onApplied?.(created);
    } catch (error) { setState({ pending: false, error: errorMessageOf(error), done: false }); }
  };
  if (!open) return <button type="button" style={{ ...buttonStyle('primary'), alignSelf: compact ? 'stretch' : 'flex-start' }} onClick={() => setOpen(true)}>La apliqué con el grupo</button>;
  return <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700, fontSize: '15px' }}>
      Nota opcional (sin nombres de alumnos)
      <textarea value={note} maxLength={NOTE_LIMIT} rows={2} onChange={(event) => setNote(event.target.value)} style={{ ...inputStyle, resize: 'vertical', fontWeight: 400 }} placeholder="Ej. Funcionó mejor en parejas" />
      <span style={{ ...mutedText, fontWeight: 400 }}>{note.length} de {NOTE_LIMIT} caracteres</span>
    </label>
    {state.error && <p role="alert" style={{ margin: 0, color: COLORS.alertFg }}>{state.error}</p>}
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button type="submit" style={buttonStyle('primary')} disabled={state.pending}>{state.pending ? 'Guardando…' : 'Registrar actividad'}</button>
      <button type="button" style={buttonStyle('ghost')} disabled={state.pending} onClick={() => setOpen(false)}>Cancelar</button>
    </div>
  </form>;
}

function OutcomeBar({ outcome }) {
  const total = outcome.baselineCount || 1;
  const segments = [
    { key: 'overcame', count: outcome.overcameCount, color: COLORS.successFg, label: 'Ya no lo muestran' },
    { key: 'still', count: outcome.stillWithErrorCount, color: COLORS.primaryAccent, label: 'Todavía lo muestran' },
    { key: 'awaiting', count: outcome.awaitingCount, color: COLORS.border, label: 'Sin nueva prueba' },
  ];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <div aria-hidden="true" style={{ display: 'flex', height: '14px', borderRadius: '8px', overflow: 'hidden', background: COLORS.surfaceSubtle }}>
      {segments.map((segment) => segment.count > 0 && <span key={segment.key} style={{ width: `${segment.count / total * 100}%`, background: segment.color }} />)}
    </div>
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', listStyle: 'none', margin: 0, padding: 0, fontSize: '15px' }}>
      {segments.map((segment) => <li key={segment.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span aria-hidden="true" style={{ width: '12px', height: '12px', borderRadius: '3px', background: segment.color }} />{segment.label}: <strong>{segment.count}</strong></li>)}
    </ul>
  </div>;
}

function InterventionItem({ item }) {
  const navigate = useNavigate();
  const { outcome } = item;
  const errorText = item.errorExplanation || (item.targetErrorTag ? 'el error típico que atiende la actividad' : `respuestas incorrectas en ${item.skillName}`);
  return <li style={{ border: `1px solid ${COLORS.border}`, borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
      <strong style={{ fontSize: '17px' }}>{item.activity.title}</strong>
      <span style={mutedText}>{item.skillName} · aplicada el {formatDate(item.appliedAt)}</span>
    </div>
    <p style={{ margin: 0, lineHeight: 1.5 }}>Antes: <strong>{outcome.baselineCount} alumnos</strong> mostraban “{errorText}”.</p>
    {outcome.status === 'awaiting_retest' ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
      <p style={{ ...mutedText, margin: 0, flex: '1 1 240px' }}>Falta una prueba corta de {item.skillName} (mínimo 3 reactivos) para ver el después.</p>
      <button type="button" style={buttonStyle('secondary')} onClick={() => navigate('/docente/temario')}>Asignar prueba corta</button>
    </div> : <>
      <p style={{ margin: 0, lineHeight: 1.5 }}>Después: de <strong>{outcome.reevaluatedCount}</strong> alumnos reevaluados, <strong>{outcome.overcameCount}</strong> ya no muestran ese error.</p>
      <OutcomeBar outcome={outcome} />
    </>}
    {item.note && <p style={{ ...mutedText, margin: 0 }}>Nota: {item.note}</p>}
  </li>;
}

/** Ciclo "error detectado → actividad → nueva prueba" con los mismos alumnos antes y después. */
export function InterventionsPanel({ request }) {
  return <section style={card} aria-labelledby="interventions-title">
    <h2 id="interventions-title" className="font-display" style={sectionTitle}>¿Funcionó la actividad?</h2>
    <p style={{ ...mutedText, margin: 0 }}>Compara a los mismos alumnos antes y después de cada actividad registrada. Quien aún no presenta la nueva prueba no se cuenta.</p>
    {request.status === 'loading' ? <p role="status" style={mutedText}>Cargando actividades registradas…</p>
      : request.status === 'error' ? <div role="alert"><p>{errorMessageOf(request.error)}</p><button type="button" style={buttonStyle('secondary')} onClick={request.retry}>Reintentar</button></div>
        : request.data.interventions.length === 0 ? <p style={{ ...mutedText, margin: 0 }}>Aún no registras actividades. Cuando apliques la actividad sugerida, márcala con “La apliqué con el grupo”.</p>
          : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>{request.data.interventions.map((item) => <InterventionItem key={item.id} item={item} />)}</ul>}
  </section>;
}
