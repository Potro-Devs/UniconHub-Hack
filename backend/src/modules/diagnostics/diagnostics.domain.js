/**
 * Módulo diagnostics — Capa 3 (Dominio): clasificación de respuestas, puntaje de sesión,
 * bloqueo pantalla/papel y logros. Funciones puras sin I/O (AGENTS.md §4.2, §4.7 y §4.9).
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { getMasteryLevelIndex, roundPercentage } from '../analytics/analytics.domain.js';
import { MIN_QUESTIONS_PER_SKILL } from '../assessments/assessments.domain.js';

export const MAX_HINT_LEVEL = 3;

export const OUTCOME_STATUSES = Object.freeze({
  CORRECT_AUTONOMOUS: 'correct_autonomous',
  ACHIEVED_WITH_SUPPORT: 'achieved_with_support',
  INCORRECT: 'incorrect',
  UNANSWERED: 'unanswered',
});

/**
 * Clasifica una respuesta.
 *
 * @param {{ selectedOption: { is_correct: boolean | number, error_tag?: string | null } | null, maxHintLevelUsed?: number }} input
 * @returns {{ outcome_status: string, error_tag: string | null, max_hint_level_used: number }}
 */
export function classifyResponse({ selectedOption, maxHintLevelUsed = 0 }) {
  if (!Number.isInteger(maxHintLevelUsed) || maxHintLevelUsed < 0 || maxHintLevelUsed > MAX_HINT_LEVEL) {
    throw new DomainError('INVALID_HINT_LEVEL', `El nivel de pista debe ser un entero entre 0 y ${MAX_HINT_LEVEL}.`);
  }

  const base = { max_hint_level_used: maxHintLevelUsed };

  if (selectedOption == null) {
    return { ...base, outcome_status: OUTCOME_STATUSES.UNANSWERED, error_tag: null };
  }

  if (selectedOption.is_correct) {
    return {
      ...base,
      outcome_status:
        maxHintLevelUsed === 0 ? OUTCOME_STATUSES.CORRECT_AUTONOMOUS : OUTCOME_STATUSES.ACHIEVED_WITH_SUPPORT,
      error_tag: null,
    };
  }

  if (!selectedOption.error_tag) {
    throw new DomainError('DISTRACTOR_WITHOUT_ERROR_TAG', 'La opción incorrecta no tiene error típico asociado.');
  }
  return { ...base, outcome_status: OUTCOME_STATUSES.INCORRECT, error_tag: selectedOption.error_tag };
}

/**
 * Puntaje de una sesión para una habilidad.
 *
 * - `autonomousPercentage`: aciertos sin pistas / total.
 * - `supportedPercentage`: "Logrado con apoyo" / total (se reporta aparte).
 * - `sessionPercentage`: el P_i del promedio ponderado; es el dominio **autónomo**.
 *
 * Los reactivos sin responder cuentan en el total.
 *
 * @param {Array<{ outcome_status: string }>} responses Respuestas de una misma habilidad.
 */
export function scoreSession(responses) {
  const total = responses.length;
  const tally = {
    [OUTCOME_STATUSES.CORRECT_AUTONOMOUS]: 0,
    [OUTCOME_STATUSES.ACHIEVED_WITH_SUPPORT]: 0,
    [OUTCOME_STATUSES.INCORRECT]: 0,
    [OUTCOME_STATUSES.UNANSWERED]: 0,
  };
  for (const r of responses) {
    if (!(r.outcome_status in tally)) {
      throw new DomainError('INVALID_OUTCOME_STATUS', `Estado de respuesta no válido: ${r.outcome_status}`);
    }
    tally[r.outcome_status] += 1;
  }

  const pct = (n) => (total === 0 ? 0 : roundPercentage((n / total) * 100));
  const autonomousPercentage = pct(tally.correct_autonomous);

  return {
    total,
    correctAutonomous: tally.correct_autonomous,
    achievedWithSupport: tally.achieved_with_support,
    incorrect: tally.incorrect,
    unanswered: tally.unanswered,
    autonomousPercentage,
    supportedPercentage: pct(tally.achieved_with_support),
    sessionPercentage: autonomousPercentage,
  };
}

/**
 * Errores típicos más frecuentes, de mayor a menor.
 *
 * @param {Array<{ error_tag?: string | null }>} responses
 * @returns {Array<{ error_tag: string, count: number }>}
 */
export function summarizeErrorTags(responses) {
  const counts = new Map();
  for (const r of responses) {
    if (r.error_tag) counts.set(r.error_tag, (counts.get(r.error_tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([error_tag, count]) => ({ error_tag, count }))
    .sort((a, b) => b.count - a.count || a.error_tag.localeCompare(b.error_tag));
}

/**
 * Estado inicial de `assignment_targets` según la modalidad.
 * Una prueba asignada en papel queda bloqueada en pantalla desde el inicio.
 */
export function initialTargetState(modality) {
  return modality === 'paper'
    ? { status: 'pending', is_screen_locked: 1 }
    : { status: 'pending', is_screen_locked: 0 };
}

/**
 * Estado del destinatario después de capturar su hoja en papel.
 */
export function paperCapturedTargetState() {
  return { status: 'completed_paper', is_screen_locked: 1 };
}

/**
 * Verifica que el alumno pueda abrir o contestar la prueba en pantalla.
 * Lanza `DomainError` con `code = 'SCREEN_LOCKED'` (→ 409 Conflict) si está en papel.
 *
 * @param {{ modality: string }} assignment
 * @param {{ status: string, is_screen_locked: number | boolean }} target
 */
export function assertCanAnswerOnScreen(assignment, target) {
  if (assignment.modality === 'paper' || target.is_screen_locked || target.status === 'completed_paper') {
    throw new DomainError('SCREEN_LOCKED', 'Esta prueba se aplica o ya se capturó en papel.');
  }
  if (target.status === 'completed_screen') {
    throw new DomainError('ALREADY_COMPLETED', 'Esta prueba ya se terminó en pantalla.');
  }
}

export const CELEBRATION_SIZES = Object.freeze({ SMALL: 'small', MEDIUM: 'medium', LARGE: 'large' });

/**
 * Logros y celebraciones al terminar (AGENTS.md §4.7). Nunca compara con otros alumnos.
 *
 * - Fin de bloque → `small`.
 * - Subir de nivel → `medium`.
 * - Mejora respecto a la evaluación previa, o alcanzar `mastered` → `large`.
 * - Sin subida → mensaje constructivo, sin castigo.
 *
 * @param {{ blockCompleted?: boolean, previousPercentage?: number | null, currentPercentage: number }} input
 * @returns {{ celebrations: Array<{ code: string, size: string }>, message: string | null }}
 */
export function evaluateAchievements({ blockCompleted = false, previousPercentage = null, currentPercentage }) {
  const celebrations = [];
  if (blockCompleted) {
    celebrations.push({ code: 'block_completed', size: CELEBRATION_SIZES.SMALL });
  }

  const currentLevel = getMasteryLevelIndex(currentPercentage);
  const masteredIndex = 3;

  if (previousPercentage == null) {
    if (currentLevel === masteredIndex) {
      celebrations.push({ code: 'reached_mastered', size: CELEBRATION_SIZES.LARGE });
    }
    return { celebrations, message: null };
  }

  const previousLevel = getMasteryLevelIndex(previousPercentage);
  if (currentLevel > previousLevel) {
    celebrations.push({ code: 'level_up', size: CELEBRATION_SIZES.MEDIUM });
  }
  if (currentLevel === masteredIndex && previousLevel < masteredIndex) {
    celebrations.push({ code: 'reached_mastered', size: CELEBRATION_SIZES.LARGE });
  } else if (roundPercentage(currentPercentage) > roundPercentage(previousPercentage)) {
    celebrations.push({ code: 'improved_vs_previous', size: CELEBRATION_SIZES.LARGE });
  }

  const improved = roundPercentage(currentPercentage) > roundPercentage(previousPercentage);
  return {
    celebrations,
    message: improved ? null : 'Esta habilidad todavía se está formando. Seguiremos practicando paso a paso.',
  };
}

/**
 * Solo registra un corte en `skill_mastery_history` si la habilidad tuvo al menos
 * `MIN_QUESTIONS_PER_SKILL` reactivos contestados (evita cortes con datos insuficientes).
 */
export function canRecordMasteryCut(responses) {
  return responses.filter((r) => r.outcome_status !== OUTCOME_STATUSES.UNANSWERED).length >= MIN_QUESTIONS_PER_SKILL;
}

// ───────────────────────── Validación y DTOs (API de diagnostics) ─────────────────────────

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isPositiveInt = (value) => Number.isSafeInteger(value) && value > 0;

export const ANSWER_SAVED_FEEDBACK = 'Respuesta guardada.';

/**
 * Valida el cuerpo de `POST /diagnostics/assignments/:assignmentId/questions/:questionId/hints`.
 *
 * @returns {{ level: number }}
 */
export function parseHintRequestInput(body) {
  if (!isPlainObject(body) || !Number.isInteger(body.level) || body.level < 1 || body.level > MAX_HINT_LEVEL) {
    throw new DomainError('VALIDATION_ERROR', `Elige un nivel de pista entre 1 y ${MAX_HINT_LEVEL}.`, {
      field: 'level',
    });
  }
  return { level: body.level };
}

/**
 * Valida el cuerpo de `POST /diagnostics/assignments/:assignmentId/answer`.
 * Ignora cualquier `maxHintLevelUsed` del cliente: la fuente de verdad es el servidor.
 *
 * @returns {{ questionId: number, selectedOptionId: number }}
 */
export function parseAnswerInput(body) {
  if (!isPlainObject(body)) {
    throw new DomainError('VALIDATION_ERROR', 'Faltan los datos de tu respuesta.');
  }
  if (!isPositiveInt(body.questionId)) {
    throw new DomainError('VALIDATION_ERROR', 'Elige una pregunta válida.', { field: 'questionId' });
  }
  if (!isPositiveInt(body.selectedOptionId)) {
    throw new DomainError('VALIDATION_ERROR', 'Elige una opción válida.', { field: 'selectedOptionId' });
  }
  return { questionId: body.questionId, selectedOptionId: body.selectedOptionId };
}

/**
 * Resumen de una prueba asignada al alumno (sin exponer respuestas correctas).
 */
export function toStudentAssignmentDto(row, skills) {
  return {
    id: row.id,
    title: row.title,
    modality: row.modality,
    assignmentStatus: row.assignment_status,
    status: row.target_status,
    isScreenLocked: row.is_screen_locked === 1,
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    questionCount: row.question_count,
    answeredCount: row.answered_count,
    skills: skills.map((s) => ({ code: s.code, name: s.name, questionCount: s.question_count })),
  };
}

/**
 * Reactivo para el portal del alumno: nunca expone `is_correct`, `error_tag`, `error_explanation`
 * ni pistas que aún no haya pedido en el servidor.
 */
export function toStartQuestionDto(q, options, response, hintLevel = 0) {
  return {
    id: q.id,
    position: q.position,
    skill: { code: q.skill_code, name: q.skill_name },
    stem: q.stem,
    hints: [q.hint_1, q.hint_2, q.hint_3].slice(0, hintLevel),
    options: options.map((o) => ({ id: o.id, label: o.label, text: o.text })),
    answered: Boolean(response),
    selectedOptionId: response?.selected_option_id ?? null,
    maxHintLevelUsed: Math.max(response?.max_hint_level_used ?? 0, hintLevel),
  };
}

