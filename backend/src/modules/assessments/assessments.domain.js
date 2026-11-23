/**
 * Módulo assessments — Capa 3 (Dominio): composición de pruebas y validación de pistas.
 * Funciones puras sin I/O (AGENTS.md §4.1 y §4.6).
 */
import { DomainError } from '../../shared/errors/DomainError.js';

/** Mínimo de reactivos por cada habilidad incluida en una prueba. */
export const MIN_QUESTIONS_PER_SKILL = 3;

export const ASSIGNMENT_MODALITIES = Object.freeze(['screen', 'paper']);

/**
 * Cuenta reactivos por habilidad y detecta las que no llegan al mínimo.
 *
 * @param {Array<{ skill: string }>} questions Reactivos de la prueba (`skill` = código o id).
 * @returns {{ valid: boolean, counts: Record<string, number>, insufficient: Array<{ skill: string, count: number, missing: number }> }}
 */
export function validateQuestionsPerSkill(questions) {
  const counts = {};
  for (const q of questions) {
    counts[q.skill] = (counts[q.skill] ?? 0) + 1;
  }

  const insufficient = Object.entries(counts)
    .filter(([, count]) => count < MIN_QUESTIONS_PER_SKILL)
    .map(([skill, count]) => ({ skill, count, missing: MIN_QUESTIONS_PER_SKILL - count }));

  return { valid: questions.length > 0 && insufficient.length === 0, counts, insufficient };
}

/**
 * Lanza `DomainError` si la prueba está vacía o alguna habilidad tiene 1 o 2 reactivos.
 * Se usa tanto al crear como al asignar una prueba.
 */
export function assertQuestionsPerSkill(questions) {
  if (questions.length === 0) {
    throw new DomainError('EMPTY_ASSESSMENT', 'La prueba debe incluir al menos un reactivo.');
  }
  const result = validateQuestionsPerSkill(questions);
  if (!result.valid) {
    throw new DomainError(
      'INSUFFICIENT_QUESTIONS_PER_SKILL',
      `Cada habilidad incluida necesita al menos ${MIN_QUESTIONS_PER_SKILL} reactivos.`,
      { insufficient: result.insufficient },
    );
  }
  return result;
}

/**
 * Valida la modalidad de una asignación.
 */
export function assertValidModality(modality) {
  if (!ASSIGNMENT_MODALITIES.includes(modality)) {
    throw new DomainError('INVALID_MODALITY', `Modalidad no válida: ${modality}. Usa "screen" o "paper".`);
  }
}

function normalizeText(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detecta pistas que contienen literalmente el texto de la respuesta correcta
 * (ignorando mayúsculas, acentos y espacios). Es una verificación mínima: no
 * sustituye la revisión pedagógica de cada pista.
 *
 * @param {string[]} hints Pistas en orden (nivel 1, 2 y 3).
 * @param {string} correctAnswerText Texto de la opción correcta.
 * @returns {number[]} Niveles (1–3) de las pistas que revelan la respuesta.
 */
export function findHintsRevealingAnswer(hints, correctAnswerText) {
  const answer = normalizeText(correctAnswerText);
  if (!answer) return [];
  // Límite de "palabra" que también trata `/` y dígitos como parte del token (p. ej. 1/4 ≠ 11/4).
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}/])${escapeRegExp(answer)}($|[^\\p{L}\\p{N}/])`, 'u');
  return hints
    .map((hint, idx) => (pattern.test(normalizeText(hint)) ? idx + 1 : null))
    .filter((level) => level != null);
}

/**
 * Valida un reactivo completo: 3 pistas, una sola opción correcta, distractores
 * etiquetados con error típico y pistas que no revelan la respuesta.
 *
 * @param {{ hints: string[], options: Array<{ text: string, is_correct: boolean, error_tag?: string | null, error_explanation?: string | null }> }} question
 * @returns {string[]} Lista de códigos de problema; vacía si el reactivo es válido.
 */
export function validateQuestion(question) {
  const problems = [];
  const hints = question.hints ?? [];
  const options = question.options ?? [];

  if (hints.length !== 3 || hints.some((h) => !String(h ?? '').trim())) {
    problems.push('HINTS_MUST_BE_THREE_LEVELS');
  }

  const correct = options.filter((o) => o.is_correct);
  if (correct.length !== 1) problems.push('EXACTLY_ONE_CORRECT_OPTION');
  if (options.length < 2) problems.push('AT_LEAST_ONE_DISTRACTOR');

  if (options.some((o) => !o.is_correct && (!o.error_tag || !o.error_explanation))) {
    problems.push('DISTRACTOR_WITHOUT_ERROR_TAG');
  }

  if (correct.length === 1 && findHintsRevealingAnswer(hints, correct[0].text).length > 0) {
    problems.push('HINT_REVEALS_ANSWER');
  }
  return problems;
}

// ───────────────────────── Validación de entradas (API de assessments) ─────────────────────────

/** Códigos de las 5 habilidades clave del MVP (AGENTS.md §3). */
export const SKILL_CODES = Object.freeze([
  'fractions',
  'multiplication',
  'place_value',
  'problem_solving',
  'reading_comprehension',
]);

export const MAX_TITLE_LENGTH = 120;
/** Límite de reactivos por prueba (5 habilidades × 4 reactivos del banco caben de sobra). */
export const MAX_QUESTIONS_PER_ASSIGNMENT = 40;
/** Límite de destinatarios explícitos (`studentIds`) por asignación. */
export const MAX_TARGETS_PER_ASSIGNMENT = 100;

export const TARGET_STATUSES = Object.freeze(['pending', 'in_progress', 'completed_screen', 'completed_paper']);

const invalid = (message, details) => new DomainError('VALIDATION_ERROR', message, details);

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isPositiveId = (value) => Number.isSafeInteger(value) && value > 0;

/** Primer valor repetido de un arreglo, o `undefined`. */
function firstDuplicate(values) {
  const seen = new Set();
  for (const v of values) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return undefined;
}

/**
 * Filtros de `GET /assessments/questions` (`?grade=&skill=`). Ambos opcionales.
 *
 * @returns {{ grade: number | null, skill: string | null }}
 */
export function parseQuestionFilters(query) {
  const filters = { grade: null, skill: null };
  const { grade, skill } = query ?? {};
  if (grade !== undefined) {
    const text = typeof grade === 'string' ? grade.trim() : '';
    const value = /^\d$/.test(text) ? Number(text) : NaN;
    if (!(value >= 1 && value <= 6)) throw invalid('El grado debe ser un número del 1 al 6.');
    filters.grade = value;
  }
  if (skill !== undefined) {
    if (typeof skill !== 'string' || !SKILL_CODES.includes(skill)) {
      throw invalid(`Habilidad no válida. Usa una de: ${SKILL_CODES.join(', ')}.`);
    }
    filters.skill = skill;
  }
  return filters;
}

/** Arreglo no vacío de ids enteros positivos (tipo número), sin repetidos y con tope. */
function parseIdList(value, { field, max }) {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalid(`${field} debe ser una lista con al menos un id.`);
  }
  if (value.length > max) {
    throw invalid(`${field} admite como máximo ${max} elementos.`, { max, received: value.length });
  }
  if (!value.every(isPositiveId)) {
    throw invalid(`${field} solo admite números enteros positivos.`);
  }
  const dup = firstDuplicate(value);
  if (dup !== undefined) throw invalid(`${field} tiene ids repetidos.`, { duplicated: dup });
  return value;
}

/**
 * Cuerpo de `POST /assessments/groups/:groupId/assignments`.
 * Exactamente una forma de elegir reactivos: `questionIds` o `skills`.
 *
 * @returns {{ title: string, modality: 'screen' | 'paper', questionIds: number[] | null, skills: string[] | null, studentIds: number[] | null }}
 */
export function parseAssignmentInput(body) {
  if (!isPlainObject(body)) throw invalid('El cuerpo debe ser un objeto JSON.');

  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw invalid(`Escribe un título de 1 a ${MAX_TITLE_LENGTH} caracteres.`);
  }

  if (typeof body.modality !== 'string' || !ASSIGNMENT_MODALITIES.includes(body.modality)) {
    throw invalid('Modalidad no válida. Usa "screen" o "paper".');
  }

  const hasIds = body.questionIds !== undefined;
  const hasSkills = body.skills !== undefined;
  if (hasIds === hasSkills) {
    throw invalid('Elige los reactivos con questionIds o con skills (solo una de las dos).');
  }

  let questionIds = null;
  let skills = null;
  if (hasIds) {
    questionIds = parseIdList(body.questionIds, { field: 'questionIds', max: MAX_QUESTIONS_PER_ASSIGNMENT });
  } else {
    if (!Array.isArray(body.skills) || body.skills.length === 0) {
      throw invalid('skills debe ser una lista con al menos una habilidad.');
    }
    if (!body.skills.every((s) => typeof s === 'string' && SKILL_CODES.includes(s))) {
      throw invalid(`Habilidad no válida. Usa: ${SKILL_CODES.join(', ')}.`);
    }
    const dup = firstDuplicate(body.skills);
    if (dup !== undefined) throw invalid('skills tiene habilidades repetidas.', { duplicated: dup });
    skills = body.skills;
  }

  const studentIds =
    body.studentIds === undefined
      ? null
      : parseIdList(body.studentIds, { field: 'studentIds', max: MAX_TARGETS_PER_ASSIGNMENT });

  return { title, modality: body.modality, questionIds, skills, studentIds };
}

/**
 * Verifica que los reactivos pedidos existan y sean del grado del grupo (→ 400 si no).
 *
 * @param {number[]} requestedIds
 * @param {Array<{ id: number, grade: number }>} found Reactivos encontrados en el banco.
 * @param {number} grade Grado del grupo.
 */
export function assertQuestionsForGrade(requestedIds, found, grade) {
  const byId = new Map(found.map((q) => [q.id, q]));
  const unknownQuestionIds = requestedIds.filter((id) => !byId.has(id));
  const wrongGradeQuestionIds = requestedIds.filter((id) => byId.has(id) && byId.get(id).grade !== grade);
  if (unknownQuestionIds.length > 0 || wrongGradeQuestionIds.length > 0) {
    throw invalid(`Todos los reactivos deben existir y ser de ${grade}.º grado.`, {
      unknownQuestionIds,
      wrongGradeQuestionIds,
    });
  }
}

/** Ordena reactivos según la lista de ids pedida (orden que eligió la docente). */
export function orderQuestionsByIds(questions, ids) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Ordena los reactivos por habilidad: en el orden de `skills` pedido y, dentro de cada
 * habilidad, por id ascendente (orden estable del banco).
 *
 * @template {{ id: number, skill: string }} Q
 * @param {Q[]} questions
 * @param {string[]} skills
 * @returns {Q[]}
 */
export function orderQuestionsBySkills(questions, skills) {
  const rank = new Map(skills.map((s, i) => [s, i]));
  return questions
    .filter((q) => rank.has(q.skill))
    .sort((a, b) => rank.get(a.skill) - rank.get(b.skill) || a.id - b.id);
}

/** Verifica el tope de reactivos de una prueba ya armada. */
export function assertQuestionLimit(count) {
  if (count > MAX_QUESTIONS_PER_ASSIGNMENT) {
    throw invalid(`Una prueba admite como máximo ${MAX_QUESTIONS_PER_ASSIGNMENT} reactivos.`, {
      max: MAX_QUESTIONS_PER_ASSIGNMENT,
      received: count,
    });
  }
}

/**
 * Verifica que los destinatarios pedidos estén activos en el grupo (→ 400 si no).
 * La misma respuesta para inexistentes, dados de baja o de otro grupo: no revela qué ids existen.
 *
 * @param {number[]} requestedIds
 * @param {number[]} activeIds Ids de alumnos activos del grupo que coinciden.
 */
export function assertStudentsInGroup(requestedIds, activeIds) {
  const active = new Set(activeIds);
  const invalidStudentIds = requestedIds.filter((id) => !active.has(id));
  if (invalidStudentIds.length > 0) {
    throw invalid('Todos los alumnos deben estar inscritos y activos en este grupo.', { invalidStudentIds });
  }
}

/** Una asignación necesita al menos un destinatario. */
export function assertHasTargets(count) {
  if (count === 0) {
    throw new DomainError('NO_ACTIVE_STUDENTS', 'El grupo no tiene alumnos activos para asignar la prueba.');
  }
}

/** Conteo de destinatarios por estado (incluye `total`). */
export function countTargetsByStatus(rows) {
  const counts = { total: 0, ...Object.fromEntries(TARGET_STATUSES.map((s) => [s, 0])) };
  for (const { status, count } of rows) {
    if (status in counts) counts[status] += count;
    counts.total += count;
  }
  return counts;
}

/**
 * Reactivo para contextos docentes: incluye la opción correcta y el error típico de cada distractor.
 * **Nunca** debe usarse en respuestas al alumno.
 */
export function toQuestionDto(row, options) {
  return {
    id: row.id,
    grade: row.grade,
    skill: { code: row.skill_code, name: row.skill_name },
    contentId: row.content_id ?? null,
    stem: row.stem,
    difficulty: row.difficulty,
    hints: [row.hint_1, row.hint_2, row.hint_3],
    options: options.map((o) => ({
      label: o.label,
      text: o.text,
      isCorrect: o.is_correct === 1,
      errorTag: o.error_tag ?? null,
      errorExplanation: o.error_explanation ?? null,
    })),
  };
}

/**
 * Resumen de una asignación.
 *
 * @param {object} row Fila de `assignments`.
 * @param {Array<{ code: string, name: string, question_count: number }>} skills En orden de aparición.
 * @param {Array<{ status: string, count: number }>} targetRows
 */
export function toAssignmentSummaryDto(row, skills, targetRows) {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    modality: row.modality,
    status: row.status,
    createdAt: row.created_at,
    questionCount: skills.reduce((sum, s) => sum + s.question_count, 0),
    skills: skills.map((s) => ({ code: s.code, name: s.name, questionCount: s.question_count })),
    targetCounts: countTargetsByStatus(targetRows),
  };
}
