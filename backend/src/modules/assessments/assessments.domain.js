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
