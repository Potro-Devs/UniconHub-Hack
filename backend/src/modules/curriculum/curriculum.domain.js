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

// ───────────────────────── API del temario (validación y mapeo) ─────────────────────────

/** Límite de `notes`: alcanza para 2–3 observaciones breves de la docente sin volverse un expediente. */
export const MAX_NOTES_LENGTH = 500;

/** Aviso fijo: el temario del seed es de ejemplo y no está revisado por docentes. */
export const CURRICULUM_REVIEW_NOTICE = 'por validar con docente';

/** Nombres de los campos formativos del Plan de Estudio 2022 (códigos del esquema). */
export const FORMATIVE_FIELD_NAMES = Object.freeze({
  lenguajes: 'Lenguajes',
  saberes_pensamiento_cientifico: 'Saberes y Pensamiento Científico',
  etica_naturaleza_sociedades: 'Ética, Naturaleza y Sociedades',
  de_lo_humano_comunitario: 'De lo Humano y lo Comunitario',
});

const invalid = (message) => new DomainError('VALIDATION_ERROR', message);

/**
 * Cuerpo de `PATCH /curriculum/groups/:groupId/contents/:contentId`.
 * - `status`: `pending` | `in_progress` | `seen`.
 * - `notes`: texto (se recortan espacios; vacío → `null`) de hasta `MAX_NOTES_LENGTH`, o `null` para borrar.
 * Debe venir al menos uno. Lanza `VALIDATION_ERROR`.
 *
 * @returns {{ status?: string, notes?: string | null }}
 */
export function parseCurriculumPatch(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('Envía un objeto con status y/o notes.');
  }
  const patch = {};
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !CURRICULUM_STATUSES.includes(body.status)) {
      throw invalid(`Estado no válido. Usa ${CURRICULUM_STATUSES.join(', ')}.`);
    }
    patch.status = body.status;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== 'string') {
      throw invalid('Las notas deben ser texto o null para borrarlas.');
    }
    const notes = body.notes === null ? null : body.notes.trim();
    if (notes !== null && notes.length > MAX_NOTES_LENGTH) {
      throw invalid(`Las notas pueden tener hasta ${MAX_NOTES_LENGTH} caracteres.`);
    }
    patch.notes = notes === '' ? null : notes;
  }
  if (Object.keys(patch).length === 0) {
    throw invalid('Indica al menos un dato para cambiar: status o notes.');
  }
  return patch;
}

/**
 * Aplica un cambio validado sobre el avance actual (o el valor por defecto si no hay registro).
 * Campo ausente → se conserva.
 */
export function mergeCurriculumProgress(current, patch) {
  return {
    status: patch.status ?? current?.status ?? 'pending',
    notes: patch.notes !== undefined ? patch.notes : (current?.notes ?? null),
  };
}

/**
 * Contenido del temario con su avance para la API. Sin registro de avance → `pending`.
 */
export function toCurriculumContentDto(row) {
  return {
    id: row.id,
    title: row.title,
    pda: row.pda,
    formativeField: row.formative_field,
    formativeFieldName: FORMATIVE_FIELD_NAMES[row.formative_field] ?? row.formative_field,
    phase: row.phase,
    grade: row.grade,
    sortOrder: row.sort_order,
    skill: row.skill_code ? { code: row.skill_code, name: row.skill_name } : null,
    status: row.status ?? 'pending',
    notes: row.notes ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Cobertura por habilidad a partir de los contenidos ya mapeados (`toCurriculumContentDto`).
 * Los contenidos sin habilidad no cuentan aquí (sí en la cobertura general).
 *
 * @param {Array<{ skill: { code: string, name: string } | null, status: string }>} contents
 */
export function computeCoverageBySkill(contents) {
  const bySkill = new Map();
  for (const content of contents) {
    if (!content.skill) continue;
    const entry = bySkill.get(content.skill.code) ?? { ...content.skill, statuses: [] };
    entry.statuses.push({ status: content.status });
    bySkill.set(content.skill.code, entry);
  }
  return [...bySkill.values()].map(({ code, name, statuses }) => ({
    code,
    name,
    ...computeCoverage(statuses.length, statuses),
  }));
}
