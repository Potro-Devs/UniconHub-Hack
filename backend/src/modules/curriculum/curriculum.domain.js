/**
 * Módulo curriculum — Capa 3 (Dominio): avance del temario y cobertura.
 * Funciones puras sin I/O (AGENTS.md §1.4 y §3).
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { roundPercentage } from '../analytics/analytics.domain.js';

export const CURRICULUM_STATUSES = Object.freeze(['pending', 'in_progress', 'seen']);

/**
 * Fase SEP correspondiente a un grado de primaria.
 * Fase 3: 1.º–2.º · Fase 4: 3.º–4.º · Fase 5: 5.º–6.º
 */
export function phaseForGrade(grade) {
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
    throw new RangeError(`Grado no válido: ${grade}. Debe ser de 1 a 6.`);
  }
  return Math.floor((grade + 1) / 2) + 2;
}

export function assertValidCurriculumStatus(status) {
  if (!CURRICULUM_STATUSES.includes(status)) {
    throw new DomainError(
      'INVALID_CURRICULUM_STATUS',
      `Estado no válido: ${status}. Usa ${CURRICULUM_STATUSES.join(', ')}.`,
    );
  }
}

/**
 * Cobertura del temario de un grupo. Los contenidos sin registro cuentan como `pending`.
 *
 * @param {number} totalContents Contenidos del grado.
 * @param {Array<{ status: string }>} progressRows Registros de `group_curriculum_progress`.
 */
export function computeCoverage(totalContents, progressRows) {
  const counts = { pending: 0, in_progress: 0, seen: 0 };
  for (const row of progressRows) {
    assertValidCurriculumStatus(row.status);
    counts[row.status] += 1;
  }
  const recorded = counts.in_progress + counts.seen + counts.pending;
  if (recorded > totalContents) {
    throw new RangeError('Hay más registros de avance que contenidos en el temario.');
  }
  counts.pending += totalContents - recorded;

  return {
    total: totalContents,
    ...counts,
    coveragePercentage: totalContents === 0 ? 0 : roundPercentage((counts.seen / totalContents) * 100),
  };
}
