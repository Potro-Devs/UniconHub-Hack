/**
 * Módulo paper-mode — Capa 3 (Dominio): captura de hojas en papel alumno por alumno.
 * Funciones puras sin I/O (AGENTS.md §1.3 y §4.9).
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { classifyResponse, paperCapturedTargetState } from '../diagnostics/diagnostics.domain.js';

/**
 * Convierte la captura de una hoja en respuestas clasificadas.
 * En papel no se registra el uso de tarjetas de pistas, así que `max_hint_level_used = 0`.
 *
 * @param {Array<{ id: number, options: Array<{ id: number, is_correct: boolean | number, error_tag?: string | null }> }>} questions
 *   Reactivos de la asignación.
 * @param {Record<number, number | null>} answers Mapa `questionId → optionId` (`null` = sin responder).
 *   Los reactivos que no aparecen se registran como `unanswered`.
 */
export function buildPaperResponses(questions, answers) {
  const questionIds = new Set(questions.map((q) => q.id));
  for (const key of Object.keys(answers)) {
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
      ...classifyResponse({ selectedOption: option, maxHintLevelUsed: 0 }),
    };
  });
}

/**
 * Resultado completo de capturar una hoja: respuestas + estado bloqueado del destinatario.
 * Si el alumno faltó (`absent`), no se generan respuestas y el destinatario queda sin cambios.
 */
export function buildPaperCapture({ questions, answers = {}, absent = false }) {
  if (absent) return { responses: [], targetState: null };
  return { responses: buildPaperResponses(questions, answers), targetState: paperCapturedTargetState() };
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
