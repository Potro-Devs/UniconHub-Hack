/**
 * Módulo tutoring — Capa de dominio. Funciones puras sin I/O.
 * "Red de tutores: todos enseñan algo" — tutoría entre pares guiada por el error típico.
 *
 * Reglas:
 * - Puede ser tutor quien tiene la habilidad en `mastered` (dominio autónomo >= 75%) o quien
 *   ya demostró 3 de 3 sin ayuda en una tutoría anterior de esa habilidad.
 * - Recibe tutoría quien está en `needs_support` o `in_progress`.
 * - Se prefiere un tutor que tuvo el mismo error y lo superó.
 * - Cada tutor acompaña como máximo a MAX_TUTEES_PER_TUTOR compañeros.
 * - Quien no alcanza tutor queda en la mesa de la maestra (los de menor dominio primero).
 * - La demostración nunca modifica el dominio oficial (`skill_mastery_history`).
 */
import { DomainError } from '../../shared/errors/DomainError.js';

export const MAX_TUTEES_PER_TUTOR = 2;
export const DEMONSTRATION_ITEMS = 3;
export const MAX_SESSION_ROWS = 80;
export const MAX_TUTORING_NOTE_LENGTH = 300;
export const TUTOR_LEVEL = 'mastered';
export const TUTEE_LEVELS = Object.freeze(['needs_support', 'in_progress']);

/** Resultados de la demostración (3 reactivos sin ayuda). Lenguaje no punitivo. */
export const DEMONSTRATION_RESULTS = Object.freeze({
  ready_to_teach: 'Ya puede enseñarlo',
  progressing: 'Va avanzando',
  keep_practicing: 'Seguimos practicando juntos',
});

/** Frases de pregunta para el tutor. Contenido por validar con docente. */
export const QUESTION_FRAMES = Object.freeze([
  '¿Qué te pide el problema? Dímelo con tus palabras.',
  '¿Cómo lo pensaste? Explícame tu primer paso.',
  '¿Puedes mostrármelo con un dibujo o con objetos?',
  '¿Cómo sabes que tu respuesta tiene sentido?',
]);

export const TUTOR_RULES = Object.freeze([
  'Nunca digas la respuesta. Pregunta y espera.',
  'Usa las pistas en orden: primero la 1. Pasa a la siguiente solo si tu compañero sigue atorado.',
  'Si se equivoca, pregúntale cómo lo pensó. Equivocarse es parte de aprender.',
  'Al terminar, tu compañero resuelve solo la demostración.',
]);

const invalid = (message) => new DomainError('VALIDATION_ERROR', message);

/** Puede enseñar: dominio autónomo en `mastered` o demostración 3/3 previa. */
export function canTeach(skillResult, readyToTeach = false) {
  return readyToTeach || skillResult?.level === TUTOR_LEVEL;
}

/** Necesita acompañamiento entre pares (y no ha demostrado que ya puede enseñar). */
export function needsTutoring(skillResult, readyToTeach = false) {
  return !readyToTeach && TUTEE_LEVELS.includes(skillResult?.level);
}

/** Error más frecuente del alumno en la habilidad; desempate estable por etiqueta. */
export function pickTuteeErrorTag(errorCounts = []) {
  const top = [...errorCounts].sort((a, b) => b.count - a.count || a.errorTag.localeCompare(b.errorTag))[0];
  return top?.errorTag ?? null;
}

/**
 * Propuesta de parejas para una habilidad.
 *
 * @param {{
 *   students: Array<{ id: number, masteryPercentage: number | null, level: string | null }>,
 *   errorsByStudent?: Map<number, Array<{ errorTag: string, count: number }>>,
 *   overcomeByStudent?: Map<number, Set<string>>,
 *   readyToTeachIds?: Set<number>,
 *   maxPerTutor?: number,
 * }} input
 */
export function buildPairingProposal({ students, errorsByStudent = new Map(), overcomeByStudent = new Map(),
  readyToTeachIds = new Set(), maxPerTutor = MAX_TUTEES_PER_TUTOR }) {
  const tutors = students.filter((s) => canTeach(s, readyToTeachIds.has(s.id)))
    .map((s) => ({ ...s, load: 0, assigned: [] }));
  const tutees = students.filter((s) => needsTutoring(s, readyToTeachIds.has(s.id)))
    .map((s) => ({ ...s, errorTag: pickTuteeErrorTag(errorsByStudent.get(s.id)) }))
    // Los más cercanos al dominio van con pares; los que más apoyo necesitan, con la maestra.
    .sort((a, b) => (b.masteryPercentage ?? 0) - (a.masteryPercentage ?? 0) || a.id - b.id);

  const overcame = (tutor, errorTag) => Boolean(errorTag && overcomeByStudent.get(tutor.id)?.has(errorTag));
  const unassigned = new Set(tutees.map((t) => t.id));
  for (let cap = 1; cap <= maxPerTutor; cap += 1) {
    for (const tutee of tutees) {
      if (!unassigned.has(tutee.id)) continue;
      const tutor = tutors.filter((t) => t.load < cap)
        .sort((a, b) => Number(overcame(b, tutee.errorTag)) - Number(overcame(a, tutee.errorTag))
          || a.load - b.load || (b.masteryPercentage ?? 0) - (a.masteryPercentage ?? 0) || a.id - b.id)[0];
      if (!tutor) break;
      tutor.load += 1;
      tutor.assigned.push({ id: tutee.id, errorTag: tutee.errorTag, tutorOvercameError: overcame(tutor, tutee.errorTag) });
      unassigned.delete(tutee.id);
    }
  }
  return {
    pairs: tutors.filter((t) => t.assigned.length).map((t) => ({ tutorId: t.id, tutees: t.assigned })),
    teacherTable: tutees.filter((t) => unassigned.has(t.id)).map((t) => ({ id: t.id, errorTag: t.errorTag })),
    availableTutorIds: tutors.filter((t) => !t.assigned.length).map((t) => t.id),
    tutorIds: tutors.map((t) => t.id),
  };
}

/**
 * Cuerpo exacto `{ skillCode, note?, pairs: [{ tutorId: number | null, tuteeId: number }] }`.
 * `tutorId: null` = el tutorado trabaja en la mesa de la maestra.
 */
export function parseSessionInput(body, skillCodes) {
  const generic = 'Elige una habilidad y al menos una pareja de tutoría válida.';
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid(generic);
  if (Object.keys(body).some((key) => !['skillCode', 'note', 'pairs'].includes(key))) throw invalid(generic);
  const { skillCode, note, pairs } = body;
  if (typeof skillCode !== 'string' || !skillCodes.includes(skillCode)) throw invalid(generic);
  if (note !== undefined && note !== null && typeof note !== 'string') throw invalid(generic);
  const trimmed = typeof note === 'string' ? note.trim() : '';
  if (trimmed.length > MAX_TUTORING_NOTE_LENGTH) throw invalid(`La nota puede tener hasta ${MAX_TUTORING_NOTE_LENGTH} caracteres.`);
  if (!Array.isArray(pairs) || pairs.length === 0 || pairs.length > MAX_SESSION_ROWS) throw invalid(generic);
  const rows = pairs.map((pair) => {
    if (pair === null || typeof pair !== 'object' || Array.isArray(pair)) throw invalid(generic);
    if (Object.keys(pair).some((key) => !['tutorId', 'tuteeId'].includes(key))) throw invalid(generic);
    const { tutorId, tuteeId } = pair;
    if (!Number.isInteger(tuteeId) || tuteeId < 1) throw invalid(generic);
    if (tutorId !== null && (!Number.isInteger(tutorId) || tutorId < 1)) throw invalid(generic);
    return { tutorId, tuteeId };
  });
  validatePairs(rows);
  return { skillCode, note: trimmed || null, pairs: rows };
}

/** Sin autoparejas, sin tutorados repetidos, un tutor no es tutorado y tope por tutor. */
export function validatePairs(rows, maxPerTutor = MAX_TUTEES_PER_TUTOR) {
  const tutees = new Set();
  const load = new Map();
  for (const { tutorId, tuteeId } of rows) {
    if (tutorId === tuteeId) throw invalid('Un alumno no puede ser su propio tutor.');
    if (tutees.has(tuteeId)) throw invalid('Cada alumno puede aparecer una sola vez como tutorado.');
    tutees.add(tuteeId);
    if (tutorId !== null) load.set(tutorId, (load.get(tutorId) ?? 0) + 1);
  }
  for (const [tutorId, count] of load) {
    if (tutees.has(tutorId)) throw invalid('Un alumno no puede ser tutor y tutorado en la misma sesión.');
    if (count > maxPerTutor) throw invalid(`Cada tutor acompaña como máximo a ${maxPerTutor} compañeros.`);
  }
  return true;
}

/** Cuerpo exacto `{ correct: 0..3 }`: aciertos sin ayuda en la demostración. */
export function parseDemonstrationInput(body) {
  const message = `Indica cuántos reactivos resolvió sin ayuda (0 a ${DEMONSTRATION_ITEMS}).`;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid(message);
  if (Object.keys(body).some((key) => key !== 'correct')) throw invalid(message);
  const { correct } = body;
  if (!Number.isInteger(correct) || correct < 0 || correct > DEMONSTRATION_ITEMS) throw invalid(message);
  return { correct };
}

/** 3/3 → ya puede enseñar; 2/3 → va avanzando; menos → seguimos practicando. */
export function classifyDemonstration(correct) {
  if (correct === null || correct === undefined) return null;
  const code = correct >= DEMONSTRATION_ITEMS ? 'ready_to_teach' : correct >= 2 ? 'progressing' : 'keep_practicing';
  return { code, label: DEMONSTRATION_RESULTS[code], correct, total: DEMONSTRATION_ITEMS };
}

export const isReadyToTeach = (correct) => correct === DEMONSTRATION_ITEMS;

/** Separa el reactivo de práctica de los tres reactivos de demostración. */
export function assertDemonstrationQuestions(questions) {
  if (new Set(questions.map((question) => question.id)).size < DEMONSTRATION_ITEMS + 1) {
    throw new DomainError('INSUFFICIENT_DEMONSTRATION_QUESTIONS',
      `Se necesitan al menos ${DEMONSTRATION_ITEMS + 1} reactivos: uno de práctica y ${DEMONSTRATION_ITEMS} distintos para la demostración.`);
  }
}

/**
 * Reactivos para la tarjeta: uno de práctica guiada (de preferencia con el error del
 * tutorado) y 3 para la demostración, siempre distintos de la práctica.
 *
 * Nota (por validar con docente): los reactivos salen del mismo banco del grado que usan
 * las evaluaciones; imprimirlos los expone antes de la siguiente prueba.
 *
 * @param {Array<{ id: number, errorTags: string[] }>} questions
 */
export function chooseCardQuestions(questions, errorTag) {
  const practice = questions.find((q) => errorTag && q.errorTags.includes(errorTag)) ?? questions[0] ?? null;
  const demonstration = questions.filter((q) => q.id !== practice?.id).slice(0, DEMONSTRATION_ITEMS);
  return { practice, demonstration };
}

/** Guion del tutor: las 3 pistas graduadas en orden. Nunca incluye opciones ni respuesta. */
export function buildCardScript(question) {
  if (!question) return null;
  return {
    stem: question.stem,
    steps: [
      { level: 1, instruction: 'Pregunta primero', text: question.hint_1 },
      { level: 2, instruction: 'Si sigue atorado', text: question.hint_2 },
      { level: 3, instruction: 'Si aún lo necesita', text: question.hint_3 },
    ],
  };
}

function compareSessionOrder(a, b) {
  const createdAt = String(a.session_created_at ?? '').localeCompare(String(b.session_created_at ?? ''));
  if (createdAt) return createdAt;
  return Number(a.session_id ?? a.id) - Number(b.session_id ?? b.id);
}

/** Último resultado por sesión, sin dejar que una corrección vieja reemplace una sesión nueva. */
export function latestDemonstrations(rows) {
  const latest = new Map();
  for (const row of rows) {
    if (row.demo_correct === null || row.demo_correct === undefined) continue;
    const current = latest.get(row.tutee_student_id);
    if (!current || compareSessionOrder(row, current) > 0) latest.set(row.tutee_student_id, row);
  }
  return latest;
}

/**
 * Mapa de la red: quién puede enseñar algo y cómo avanza cada error trabajado en tutoría.
 *
 * @param {{
 *   skills: Array<{ code: string, name: string }>,
 *   students: Array<{ id: number, skills: Array<{ code: string, level: string | null }> }>,
 *   readyBySkill: Map<string, Set<number>>,
 *   pairRows: Array<{ skill_code: string, target_error_tag: string | null, error_explanation?: string | null,
 *     session_id: number, session_created_at: string, tutee_student_id: number,
 *     tutor_student_id: number | null, demo_correct: number | null, demo_recorded_at: string | null, id: number }>,
 * }} input
 */
export function summarizeNetwork({ skills, students, readyBySkill, pairRows }) {
  const teachable = (student) => skills.filter((skill) => canTeach(
    student.skills.find((entry) => entry.code === skill.code), readyBySkill.get(skill.code)?.has(student.id) ?? false));
  const canTeachCounts = students.map((student) => ({ id: student.id, skills: teachable(student).map((s) => s.code) }));
  const bySkill = skills.map((skill) => ({ code: skill.code, name: skill.name,
    canTeachCount: canTeachCounts.filter((entry) => entry.skills.includes(skill.code)).length }));

  const groups = new Map();
  for (const row of pairRows) {
    const key = `${row.skill_code}|${row.target_error_tag ?? ''}`;
    if (!groups.has(key)) groups.set(key, { skillCode: row.skill_code, errorTag: row.target_error_tag,
      explanation: row.error_explanation ?? null, rows: [] });
    groups.get(key).rows.push(row);
  }
  const errors = [...groups.values()].map((entry) => {
    const latest = latestDemonstrations(entry.rows);
    const tutees = new Set(entry.rows.map((row) => row.tutee_student_id));
    const results = [...latest.values()].map((row) => classifyDemonstration(row.demo_correct).code);
    return { skillCode: entry.skillCode, errorTag: entry.errorTag, explanation: entry.explanation,
      tutoredCount: tutees.size, demonstratedCount: latest.size,
      readyToTeachCount: results.filter((code) => code === 'ready_to_teach').length,
      progressingCount: results.filter((code) => code === 'progressing').length,
      peerTutoredCount: new Set(entry.rows.filter((row) => row.tutor_student_id !== null).map((row) => row.tutee_student_id)).size };
  }).sort((a, b) => b.tutoredCount - a.tutoredCount || a.skillCode.localeCompare(b.skillCode));

  const tutorsWhoWereTutees = pairRows.filter((row) => row.tutor_student_id !== null
    && pairRows.some((previous) => previous.tutee_student_id === row.tutor_student_id
      && previous.skill_code === row.skill_code && isReadyToTeach(previous.demo_correct)
      && compareSessionOrder(previous, row) < 0));

  return {
    studentCount: students.length,
    teachSomethingCount: canTeachCounts.filter((entry) => entry.skills.length > 0).length,
    skills: bySkill,
    errors,
    tutorsWhoWereTuteesCount: new Set(tutorsWhoWereTutees.map((row) => row.tutor_student_id)).size,
  };
}
