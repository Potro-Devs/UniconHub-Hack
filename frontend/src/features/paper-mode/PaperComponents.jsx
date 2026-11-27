import { Link } from 'react-router-dom';
import { useTeacherGroups } from '@/features/groups/TeacherGroupsContext';
import { alertBox, buttonStyle, card, mutedText, pageTitle } from '@/shared/styles/ui';

export function PaperGroupBoundary({ children }) {
  const { activeGroup, status, retry } = useTeacherGroups();
  if (status === 'loading') return <p role="status" style={mutedText}>Cargando tu grupo…</p>;
  if (status === 'error') return <div role="alert" style={alertBox}><p>No pudimos cargar tus grupos.</p><button type="button" style={buttonStyle('secondary')} onClick={retry}>Reintentar grupos</button></div>;
  if (!activeGroup) return <section style={card}><h1 className="font-display" style={pageTitle}>Modo Papel</h1><p style={mutedText}>Elige o crea un grupo para trabajar con sus hojas.</p><Link style={buttonStyle('primary')} to="/docente/grupos">Ir a mis grupos</Link></section>;
  return children(activeGroup);
}

export function PaperRequestState({ request }) {
  if (request.status === 'loading') return <p role="status" style={mutedText}>Cargando prueba y avance de captura…</p>;
  return <div role="alert" style={alertBox}><p>{request.error?.message || 'No pudimos cargar esta prueba.'}</p><button type="button" style={buttonStyle('secondary')} onClick={request.reload}>Reintentar</button><Link to="/docente/papel" style={buttonStyle('ghost')}>Volver a Papel</Link></div>;
}

export function CaptureProgress({ request }) {
  const status = request.captureStatus;
  return <section style={card} aria-label="Avance de captura">
    <strong>{status.captured} de {status.total} hojas capturadas</strong>
    <span style={mutedText}>{status.pending} pendientes</span>
    {request.refreshError && <div role="alert" style={alertBox}><p>La hoja se procesó, pero no pudimos actualizar el avance. Los datos guardados se conservan.</p><button type="button" style={buttonStyle('secondary')} onClick={() => request.refreshStatus().catch(() => {})}>Actualizar avance</button></div>}
  </section>;
}
