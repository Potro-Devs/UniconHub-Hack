/**
 * Módulo paper-mode — Capa 3 (Dominio): captura de hojas en papel alumno por alumno.
 * Funciones puras sin I/O (AGENTS.md §1.3 y §4.9).
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { MAX_HINT_LEVEL, classifyResponse, paperCapturedTargetState } from '../diagnostics/diagnostics.domain.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isPositiveInt = (v) => Number.isSafeInteger(v) && v > 0;
/** Clave de reactivo: entero en forma canónica ("12", no "012", "1.0" ni " 1 "), para que no se pisen. */
const QUESTION_KEY = /^[1-9][0-9]*$/;

/**
 * Valida el cuerpo de `POST /paper/assignments/:id/capture/:studentId`.
 * `answers` es `{ [questionId]: optionId | null }`; con `absent: true` puede omitirse.
 * `hintLevels` (opcional) es `{ [questionId]: 0..3 }`: la tarjeta de pista más alta que usó el
 * alumno en ese reactivo. Un reactivo ausente cuenta como "sin tarjetas" (nivel 0).
 *
 * @returns {{ answers: Record<number, number | null>, hintLevels: Record<number, number>, absent: boolean }}
 */
export function parsePaperCaptureInput(body) {
  const invalid = (message, field) => new DomainError('VALIDATION_ERROR', message, { field });
  if (!isPlainObject(body)) throw invalid('Envía las respuestas de la hoja.', 'body');

  if (body.absent !== undefined && typeof body.absent !== 'boolean') {
    throw invalid('Indica si el alumno faltó con sí o no.', 'absent');
  }
  const absent = body.absent === true;
  if (absent) return { answers: {}, hintLevels: {}, absent };

  if (!isPlainObject(body.answers)) throw invalid('Envía las respuestas de la hoja.', 'answers');
  const answers = {};
  for (const [key, value] of Object.entries(body.answers)) {
    const questionId = Number(key);
    if (!QUESTION_KEY.test(key) || !isPositiveInt(questionId)) throw invalid('Hay un reactivo no válido en la hoja.', 'answers');
    if (value !== null && !isPositiveInt(value)) throw invalid('Hay una opción no válida en la hoja.', 'answers');
    answers[questionId] = value;
  }

  const hintLevels = {};
  if (body.hintLevels !== undefined) {
    if (!isPlainObject(body.hintLevels)) throw invalid('Indica qué tarjetas de pistas usó el alumno.', 'hintLevels');
    for (const [key, level] of Object.entries(body.hintLevels)) {
      const questionId = Number(key);
      if (!QUESTION_KEY.test(key) || !isPositiveInt(questionId)) throw invalid('Hay un reactivo no válido en las pistas.', 'hintLevels');
      if (!Number.isInteger(level) || level < 0 || level > MAX_HINT_LEVEL) {
        throw invalid(`El nivel de pista debe ser de 0 a ${MAX_HINT_LEVEL}.`, 'hintLevels');
      }
      hintLevels[questionId] = level;
    }
  }
  return { answers, hintLevels, absent };
}

/**
 * Convierte la captura de una hoja en respuestas clasificadas (AGENTS.md §4.2): un acierto con
 * tarjeta de pista (nivel >= 1) es "Logrado con apoyo", nunca autónomo.
 *
 * @param {Array<{ id: number, options: Array<{ id: number, is_correct: boolean | number, error_tag?: string | null }> }>} questions
 *   Reactivos de la asignación.
 * @param {Record<number, number | null>} answers Mapa `questionId → optionId` (`null` = sin responder).
 *   Los reactivos que no aparecen se registran como `unanswered`.
 * @param {Record<number, number>} [hintLevels] Mapa `questionId → nivel de pista 0..3` (ausente = 0).
 */
export function buildPaperResponses(questions, answers, hintLevels = {}) {
  const questionIds = new Set(questions.map((q) => q.id));
  for (const key of [...Object.keys(answers), ...Object.keys(hintLevels)]) {
    if (!questionIds.has(Number(key))) {
      throw new DomainError('UNKNOWN_QUESTION', `El reactivo ${key} no pertenece a esta prueba.`);
    }
  }

  return questions.map((q) => {
    const optionId = answers[q.id] ?? null;
    const option = optionId == null ? null : q.options.find((o) => o.id === optionId);
    if (optionId != null && !option) {
      throw new DomainError('UNKNOWN_OPTION', `La opción ${optionId} no pertenece al reactivo ${q.id}.`);
    }
    return {
      question_id: q.id,
      selected_option_id: option ? option.id : null,
      source: 'paper',
      ...classifyResponse({ selectedOption: option, maxHintLevelUsed: hintLevels[q.id] ?? 0 }),
    };
  });
}

/**
 * Resultado completo de capturar una hoja: respuestas + estado bloqueado del destinatario.
 * Si el alumno faltó (`absent`), no se generan respuestas y el destinatario queda sin cambios.
 */
export function buildPaperCapture({ questions, answers = {}, hintLevels = {}, absent = false }) {
  if (absent) return { responses: [], targetState: null };
  return { responses: buildPaperResponses(questions, answers, hintLevels), targetState: paperCapturedTargetState() };
}

/**
 * Avance de captura de una asignación en papel.
 *
 * @param {Array<{ status: string }>} targets
 */
export function summarizeCaptureStatus(targets) {
  const captured = targets.filter((t) => t.status === 'completed_paper').length;
  return { total: targets.length, captured, pending: targets.length - captured };
}
