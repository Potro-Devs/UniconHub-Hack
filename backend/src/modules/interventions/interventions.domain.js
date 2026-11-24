/**
 * Módulo interventions — Capa de dominio. Funciones puras sin I/O.
 * Compara a los mismos alumnos antes y después de aplicar una actividad.
 */
import { DomainError } from '../../shared/errors/DomainError.js';

export const MAX_INTERVENTION_NOTE_LENGTH = 300;

const invalid = (message = 'Elige una actividad sugerida y, si quieres, agrega una nota breve.') =>
  new DomainError('VALIDATION_ERROR', message);

/** Cuerpo exacto `{ activityId, note? }`. La nota vacía se guarda como `null`. */
export function parseInterventionInput(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  if (Object.keys(body).some((key) => !['activityId', 'note'].includes(key))) throw invalid();
  const { activityId, note } = body;
  if (!Number.isInteger(activityId) || activityId < 1) throw invalid();
  if (note !== undefined && note !== null && typeof note !== 'string') throw invalid();
  const trimmed = typeof note === 'string' ? note.trim() : '';
  if (trimmed.length > MAX_INTERVENTION_NOTE_LENGTH) {
    throw invalid(`La nota puede tener hasta ${MAX_INTERVENTION_NOTE_LENGTH} caracteres.`);
  }
  return { activityId, note: trimmed || null };
}

/**
 * Antes y después con los mismos alumnos.
 * - `baselineIds`: alumnos que mostraban el error antes de aplicar la actividad.
 * - `reevaluatedIds`: alumnos que contestaron reactivos de la habilidad después.
 * - `stillWithErrorIds`: alumnos que volvieron a mostrar el error después.
 * Quien todavía no ha sido reevaluado no cuenta como superado ni como pendiente.
 */
export function summarizeInterventionOutcome({ baselineIds, reevaluatedIds, stillWithErrorIds }) {
  const baseline = new Set(baselineIds);
  const reevaluated = [...new Set(reevaluatedIds)].filter((id) => baseline.has(id));
  const stillWithError = new Set(stillWithErrorIds);
  const stillCount = reevaluated.filter((id) => stillWithError.has(id)).length;
  return {
    status: reevaluated.length === 0 ? 'awaiting_retest' : 'measured',
    baselineCount: baseline.size,
    reevaluatedCount: reevaluated.length,
    overcameCount: reevaluated.length - stillCount,
    stillWithErrorCount: stillCount,
    awaitingCount: baseline.size - reevaluated.length,
  };
}
