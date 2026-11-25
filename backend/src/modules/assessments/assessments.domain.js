/**
 * Módulo assessments — Capa 3 (Dominio): composición de pruebas y validación de pistas.
 * Funciones puras sin I/O (AGENTS.md §4.1 y §4.6).
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { getMasteryLevel, roundPercentage } from '../analytics/analytics.domain.js';

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
      throw invalid('Elige una habilidad válida.', { field: 'skill', allowed: SKILL_CODES });
    }
    filters.skill = skill;
  }
  return filters;
}

/**
 * Arreglo no vacío de ids enteros positivos (tipo número), sin repetidos y con tope.
 * Los mensajes son para la docente (`noun`/`plural`); el nombre técnico va en `details.field`.
 */
function parseIdList(value, { field, max, noun, plural }) {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalid(`Elige al menos ${noun}.`, { field });
  }
  if (value.length > max) {
    throw invalid(`Puedes elegir como máximo ${max} ${plural}.`, { field, max, received: value.length });
  }
  if (!value.every(isPositiveId)) {
    throw invalid(`Hay ${plural} que no reconocemos. Vuelve a elegirlos.`, { field });
  }
  const dup = firstDuplicate(value);
  if (dup !== undefined) throw invalid(`Hay ${plural} repetidos en tu selección.`, { field, duplicated: dup });
  return value;
}

/**
 * Cuerpo de `POST /assessments/groups/:groupId/assignments`.
 * Exactamente una forma de elegir reactivos: `questionIds` o `skills`.
 *
 * @returns {{ title: string, modality: 'screen' | 'paper', questionIds: number[] | null, skills: string[] | null, studentIds: number[] | null }}
 */
export function parseAssignmentInput(body) {
  if (!isPlainObject(body)) throw invalid('Faltan los datos de la prueba.');

  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw invalid(`Escribe un título de 1 a ${MAX_TITLE_LENGTH} caracteres.`);
  }

  if (typeof body.modality !== 'string' || !ASSIGNMENT_MODALITIES.includes(body.modality)) {
    throw invalid('Elige si la prueba será en pantalla o en papel.', { field: 'modality', allowed: ASSIGNMENT_MODALITIES });
  }

  const hasIds = body.questionIds !== undefined;
  const hasSkills = body.skills !== undefined;
  if (hasIds === hasSkills) {
    throw invalid(
      hasIds ? 'Elige los reactivos uno por uno o por habilidad, pero no de las dos formas a la vez.' : 'Elige al menos un reactivo o una habilidad.',
      { fields: ['questionIds', 'skills'] },
    );
  }

  let questionIds = null;
  let skills = null;
  if (hasIds) {
    questionIds = parseIdList(body.questionIds, {
      field: 'questionIds',
      max: MAX_QUESTIONS_PER_ASSIGNMENT,
      noun: 'un reactivo',
      plural: 'reactivos',
    });
  } else {
    if (!Array.isArray(body.skills) || body.skills.length === 0) {
      throw invalid('Elige al menos una habilidad.', { field: 'skills' });
    }
    if (!body.skills.every((s) => typeof s === 'string' && SKILL_CODES.includes(s))) {
      throw invalid('Elige una habilidad válida.', { field: 'skills', allowed: SKILL_CODES });
    }
    const dup = firstDuplicate(body.skills);
    if (dup !== undefined) throw invalid('Hay habilidades repetidas en tu selección.', { field: 'skills', duplicated: dup });
    skills = body.skills;
  }

  const studentIds =
    body.studentIds === undefined
      ? null
      : parseIdList(body.studentIds, {
          field: 'studentIds',
          max: MAX_TARGETS_PER_ASSIGNMENT,
          noun: 'un alumno',
          plural: 'alumnos',
        });

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

/**
 * Modo `skills`: cada habilidad pedida debe tener reactivos en el grado del grupo. Las que no
 * tienen ninguno se reportan con `count: 0` (no se descartan en silencio) → 422
 * `INSUFFICIENT_QUESTIONS_PER_SKILL`. Las que tienen 1 o 2 las detecta `assertQuestionsPerSkill`.
 *
 * @param {string[]} requestedSkills
 * @param {Array<{ skill: string }>} questions Reactivos encontrados.
 */
export function assertRequestedSkillsHaveQuestions(requestedSkills, questions) {
  const present = new Set(questions.map((q) => q.skill));
  const insufficient = requestedSkills
    .filter((skill) => !present.has(skill))
    .map((skill) => ({ skill, count: 0, missing: MIN_QUESTIONS_PER_SKILL }));
  if (insufficient.length > 0) {
    throw new DomainError(
      'INSUFFICIENT_QUESTIONS_PER_SKILL',
      `Cada habilidad incluida necesita al menos ${MIN_QUESTIONS_PER_SKILL} reactivos.`,
      { insufficient },
    );
  }
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

/** Destinatario de una asignación: sin nombres ni `internal_folio`. */
export function toTargetDto(row) {
  return {
    studentId: row.student_id,
    status: row.status,
    isScreenLocked: row.is_screen_locked === 1,
  };
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

// ───────────────────────── Cuestionarios y constructor ─────────────────────────

export const QUESTION_TYPES = Object.freeze(['multiple_choice', 'true_false', 'fill_blank']);
export const QUIZ_ORIGINS = Object.freeze(['all', 'recommended', 'own', 'other_teachers', 'preloaded']);
export const MAX_DESCRIPTION_LENGTH = 300;
export const MAX_PROMPT_LENGTH = 400;
export const MAX_OPTION_TEXT_LENGTH = 160;
export const MAX_FILL_ANSWER_LENGTH = 120;
export const MAX_HINT_LENGTH = 240;

const cleanText = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

function parseQuizQuestion(raw, index) {
  if (!isPlainObject(raw)) {
    throw invalid(`Revisa los datos de la pregunta ${index + 1}.`, { field: 'questions', index });
  }
  const questionType = typeof raw.questionType === 'string' ? raw.questionType : '';
  if (!QUESTION_TYPES.includes(questionType)) {
    throw invalid(`Elige un tipo válido para la pregunta ${index + 1}.`, {
      field: 'questionType',
      index,
      allowed: QUESTION_TYPES,
    });
  }

  const prompt = cleanText(raw.prompt);
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    throw invalid(
      `Escribe el enunciado de la pregunta ${index + 1} (máximo ${MAX_PROMPT_LENGTH} caracteres).`,
      { field: 'prompt', index },
    );
  }

  const hint = cleanText(raw.hint ?? '');
  if (hint.length > MAX_HINT_LENGTH) {
    throw invalid(
      `La pista de la pregunta ${index + 1} no puede superar ${MAX_HINT_LENGTH} caracteres.`,
      { field: 'hint', index },
    );
  }

  if (questionType === 'multiple_choice') {
    if (!Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 4) {
      throw invalid(`La pregunta ${index + 1} debe tener entre 2 y 4 opciones.`, { field: 'options', index });
    }
    const options = raw.options.map((opt, optIdx) => {
      const text = cleanText(opt?.text);
      if (!text || text.length > MAX_OPTION_TEXT_LENGTH) {
        throw invalid(`Completa el texto de la opción ${'ABCD'[optIdx]} en la pregunta ${index + 1}.`, {
          field: 'options',
          index,
          optionIndex: optIdx,
        });
      }
      return {
        label: 'ABCD'[optIdx],
        text,
        isCorrect: Boolean(opt?.isCorrect),
      };
    });
    const correctOptions = options.filter((o) => o.isCorrect);
    if (correctOptions.length !== 1) {
      throw invalid(`Marca exactamente una respuesta correcta en la pregunta ${index + 1}.`, {
        field: 'options',
        index,
      });
    }
    return {
      questionType,
      prompt,
      options,
      correctAnswer: correctOptions[0].text,
      hint,
    };
  }

  if (questionType === 'true_false') {
    const provided = Array.isArray(raw.options) ? raw.options.find((o) => o?.isCorrect)?.text : null;
    const answerText = cleanText(raw.correctAnswer ?? provided ?? '');
    if (answerText !== 'Verdadero' && answerText !== 'Falso') {
      throw invalid(`Indica si la pregunta ${index + 1} es Verdadero o Falso.`, {
        field: 'correctAnswer',
        index,
      });
    }
    return {
      questionType,
      prompt,
      options: [
        { label: 'A', text: 'Verdadero', isCorrect: answerText === 'Verdadero' },
        { label: 'B', text: 'Falso', isCorrect: answerText === 'Falso' },
      ],
      correctAnswer: answerText,
      hint,
    };
  }

  const correctAnswer = cleanText(raw.correctAnswer);
  if (!correctAnswer || correctAnswer.length > MAX_FILL_ANSWER_LENGTH) {
    throw invalid(
      `Escribe la respuesta correcta para completar la frase en la pregunta ${index + 1}.`,
      { field: 'correctAnswer', index },
    );
  }

  return {
    questionType,
    prompt,
    options: [],
    correctAnswer,
    hint,
  };
}

/**
 * Valida y normaliza el cuerpo de `POST /assessments/quizzes` y `PATCH /assessments/quizzes/:quizId`.
 */
export function parseQuizInput(body) {
  if (!isPlainObject(body)) throw invalid('Faltan los datos del cuestionario.');

  const title = cleanText(body.title);
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw invalid(`Escribe un título de 1 a ${MAX_TITLE_LENGTH} caracteres.`, { field: 'title' });
  }

  const description = cleanText(body.description ?? '');
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw invalid(`La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`, { field: 'description' });
  }

  const skillCode = typeof body.skillCode === 'string' ? body.skillCode : '';
  if (!SKILL_CODES.includes(skillCode)) {
    throw invalid('Elige una habilidad válida.', { field: 'skillCode', allowed: SKILL_CODES });
  }

  const grade = Number.isSafeInteger(body.grade) ? body.grade : Number(body.grade);
  if (!Number.isSafeInteger(grade) || grade < 1 || grade > 6) {
    throw invalid('El grado debe ser un número del 1 al 6.', { field: 'grade' });
  }

  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    throw invalid('Agrega al menos una pregunta al cuestionario.', { field: 'questions' });
  }
  if (body.questions.length < MIN_QUESTIONS_PER_SKILL) {
    throw new DomainError(
      'INSUFFICIENT_QUESTIONS_PER_SKILL',
      `Cada cuestionario necesita al menos ${MIN_QUESTIONS_PER_SKILL} preguntas.`,
      { field: 'questions', min: MIN_QUESTIONS_PER_SKILL, received: body.questions.length },
    );
  }
  if (body.questions.length > MAX_QUESTIONS_PER_ASSIGNMENT) {
    throw invalid(`Un cuestionario admite como máximo ${MAX_QUESTIONS_PER_ASSIGNMENT} preguntas.`, {
      field: 'questions',
      max: MAX_QUESTIONS_PER_ASSIGNMENT,
    });
  }

  const questions = body.questions.map((q, idx) => parseQuizQuestion(q, idx));
  return { title, description, skillCode, grade, questions };
}

/**
 * Valida query params de listado y detalle de cuestionarios (`?groupId=&origin=`).
 */
export function parseQuizListQuery(query) {
  const { groupId, origin } = query ?? {};
  let parsedGroupId = null;
  if (groupId !== undefined && groupId !== '') {
    const text = typeof groupId === 'string' ? groupId.trim() : '';
    const num = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isSafeInteger(num) || num <= 0) {
      throw invalid('El identificador del grupo no es válido.', { field: 'groupId' });
    }
    parsedGroupId = num;
  }

  let parsedOrigin = 'all';
  if (origin !== undefined && origin !== '') {
    if (typeof origin !== 'string' || !QUIZ_ORIGINS.includes(origin)) {
      throw invalid('Filtro de origen no válido.', { field: 'origin', allowed: QUIZ_ORIGINS });
    }
    parsedOrigin = origin;
  }

  return { groupId: parsedGroupId, origin: parsedOrigin };
}

/**
 * Resume el desempeño actual del grupo por habilidad a partir del último corte de cada alumno.
 */
export function buildGroupSkillContext(group, skillRows, latestMasteryRows) {
  const skillStats = {};
  for (const skill of skillRows) {
    const rows = latestMasteryRows.filter((r) => r.skill_code === skill.code);
    if (rows.length === 0) {
      skillStats[skill.code] = {
        code: skill.code,
        name: skill.name,
        average: null,
        level: 'not_evaluated',
        label: 'Sin evaluar',
        evaluatedCount: 0,
        needsSupportCount: 0,
      };
      continue;
    }
    const average = roundPercentage(
      rows.reduce((sum, r) => sum + Number(r.mastery_percentage), 0) / rows.length,
    );
    const level = getMasteryLevel(average);
    const needsSupportCount = rows.filter((r) => roundPercentage(Number(r.mastery_percentage)) < 25).length;
    skillStats[skill.code] = {
      code: skill.code,
      name: skill.name,
      average,
      level: level.code,
      label: level.label,
      evaluatedCount: rows.length,
      needsSupportCount,
    };
  }

  return {
    groupId: group.id,
    groupName: `${group.grade}.º ${group.section}`,
    grade: group.grade,
    skillStats,
  };
}

/**
 * Calcula dinámicamente si un cuestionario es recomendable para el grupo según desempeño real.
 */
export function scoreQuizForGroup(quizRow, groupContext) {
  if (!groupContext) {
    return {
      isRecommended: false,
      recommendationScore: 0,
      recommendationReason: null,
      groupSkillStat: null,
    };
  }

  const stat = groupContext.skillStats[quizRow.skill_code] ?? null;
  let score = 0;

  if (!stat || stat.average == null) {
    score += 58;
  } else {
    score += Math.round((100 - stat.average) * 0.65);
  }

  const gradeDiff = Math.abs(Number(quizRow.grade) - Number(groupContext.grade));
  if (gradeDiff === 0) score += 30;
  else if (gradeDiff === 1) score += 12;

  if ((stat?.needsSupportCount ?? 0) > 0) score += 10;

  const recommendationScore = Math.max(0, Math.min(100, score));
  const isRecommended = recommendationScore >= 74;

  let recommendationReason = null;
  if (stat) {
    if (stat.average == null) {
      recommendationReason = `Ideal para diagnosticar en ${groupContext.groupName} · Aún sin evidencia en ${stat.name}`;
    } else if (isRecommended) {
      recommendationReason = `Prioritario para ${groupContext.groupName} · ${stat.name} en ${stat.average}% (${stat.label})`;
    } else {
      recommendationReason = `${groupContext.groupName} lleva ${stat.average}% (${stat.label}) en ${stat.name}`;
    }
  }

  return {
    isRecommended,
    recommendationScore,
    recommendationReason,
    groupSkillStat: stat,
  };
}

function resolveQuizOrigin(row, authUserId) {
  if (row.origin_type === 'system') return 'preloaded';
  if (Number(row.created_by) === Number(authUserId)) return 'own';
  return 'other_teacher';
}

export function toQuizSummaryDto(row, authUserId, groupContext = null) {
  const origin = resolveQuizOrigin(row, authUserId);
  const scoring = scoreQuizForGroup(row, groupContext);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    grade: row.grade,
    skill: { code: row.skill_code, name: row.skill_name },
    origin,
    originType: row.origin_type,
    canEdit: origin === 'own',
    authorName: row.origin_type === 'system' ? 'Precargado por Axi' : (row.author_name ?? 'Docente de la escuela'),
    questionCount: Number(row.question_count ?? 0),
    questionTypeCounts: {
      multiple_choice: Number(row.mc_count ?? 0),
      true_false: Number(row.tf_count ?? 0),
      fill_blank: Number(row.fb_count ?? 0),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...scoring,
  };
}

export function toQuizDetailDto(row, questionRows, authUserId, groupContext = null) {
  const summary = toQuizSummaryDto(row, authUserId, groupContext);
  const questions = questionRows.map((q) => {
    let options = [];
    try {
      const parsed = JSON.parse(q.options_json || '[]');
      if (Array.isArray(parsed)) options = parsed;
    } catch {
      options = [];
    }
    return {
      id: q.id,
      position: q.position,
      questionType: q.question_type,
      prompt: q.prompt,
      options,
      correctAnswer: q.correct_answer,
      hint: q.hint ?? '',
    };
  });

  const questionTypeCounts = {
    multiple_choice: questions.filter((q) => q.questionType === 'multiple_choice').length,
    true_false: questions.filter((q) => q.questionType === 'true_false').length,
    fill_blank: questions.filter((q) => q.questionType === 'fill_blank').length,
  };

  return {
    ...summary,
    questionCount: questions.length,
    questionTypeCounts,
    questions,
  };
}
