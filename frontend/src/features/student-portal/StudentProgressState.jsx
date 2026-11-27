import { COLORS } from '@/config/brand';
import { errorMessageOf } from '@/shared/api/client';
import { alertBox, buttonStyle, mutedText } from '@/shared/styles/ui';

export function StudentProgressState({ request, loadingText = 'Buscando tu progreso…' }) {
  if (request.status === 'loading') return <p role="status" style={mutedText}>{loadingText}</p>;
  if (request.status === 'error') return <div role="alert" style={alertBox}>
    <p style={{ margin: 0 }}>{errorMessageOf(request.error)}</p>
    <button type="button" style={buttonStyle('secondary')} onClick={request.retry}>Volver a intentar</button>
  </div>;
  return null;
}

/** Formatea una fecha recibida, sin inventar el momento del logro. */
export function studentDate(value) {
  if (!value) return 'Fecha no disponible';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' }).format(date);
}

export const studentCard = { background: COLORS.surface, border: `2px solid ${COLORS.border}`, borderRadius: '24px', padding: '20px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' };
