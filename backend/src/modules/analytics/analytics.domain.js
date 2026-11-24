/**
 * Módulo analytics — Capa 3 (Dominio): escala de dominio y promedio ponderado evolutivo.
 * Funciones puras sin I/O (AGENTS.md §4.3 y §4.5).
 */
import { DomainError } from '../../shared/errors/DomainError.js';

/**
 * Escala de niveles con intervalos estrictos de 25%. `min` es inclusivo.
 * El color nunca es el único indicador: la UI siempre muestra `% + label`.
 */
export const MASTERY_LEVELS = Object.freeze([
  Object.freeze({ code: 'needs_support', label: 'Necesita apoyo', min: 0 }),
  Object.freeze({ code: 'in_progress', label: 'En proceso', min: 25 }),
  Object.freeze({ code: 'achieved', label: 'Logrado', min: 50 }),
  Object.freeze({ code: 'mastered', label: 'Dominado', min: 75 }),
]);

/**
 * Redondea a 2 decimales (la escala se define con esa precisión: 24.99, 49.99, 74.99).
 */
export function roundPercentage(value) {
  return Math.round(value * 100) / 100;
}

function assertPercentage(value, name = 'percentage') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} debe ser un número entre 0 y 100 (recibido: ${value})`);
  }
}

/**
 * Nivel de dominio para un porcentaje entre 0 y 100.
 * Se evalúa sobre el valor redondeado a 2 decimales, igual que se almacena.
 *
 * @param {number} percentage
 * @returns {{ code: string, label: string, min: number }}
 */
export function getMasteryLevel(percentage) {
  assertPercentage(percentage);
  const rounded = roundPercentage(percentage);
  for (let i = MASTERY_LEVELS.length - 1; i >= 0; i -= 1) {
    if (rounded >= MASTERY_LEVELS[i].min) return MASTERY_LEVELS[i];
  }
  return MASTERY_LEVELS[0];
}

/**
 * Índice (0–3) del nivel, útil para comparar si un alumno subió de nivel.
 */
export function getMasteryLevelIndex(percentage) {
  return MASTERY_LEVELS.indexOf(getMasteryLevel(percentage));
}

/**
 * Promedio ponderado evolutivo con peso lineal w_i = i:
 *   Dominio = Σ(i · P_i) / Σ(i)
 *
 * @param {number[]} sessionPercentages Porcentajes P_1..P_n en orden cronológico.
 * @returns {number | null} Dominio redondeado a 2 decimales, o `null` si no hay sesiones.
 */
export function computeWeightedMastery(sessionPercentages) {
  if (!Array.isArray(sessionPercentages) || sessionPercentages.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;
  sessionPercentages.forEach((pct, idx) => {
    assertPercentage(pct, `sessionPercentages[${idx}]`);
    const weight = idx + 1;
    weightedSum += weight * pct;
    weightTotal += weight;
  });
  return roundPercentage(weightedSum / weightTotal);
}

/**
 * Construye el siguiente corte inmutable de `skill_mastery_history` para un alumno y habilidad.
 *
 * @param {Array<{ session_index: number, session_percentage: number }>} previousCuts
 *   Cortes anteriores de la misma habilidad (en cualquier orden).
 * @param {{ sessionPercentage: number, autonomousPercentage: number, supportedPercentage: number }} session
 *   Resultado de la sesión nueva (ver `scoreSession` en diagnostics.domain.js).
 */
export function buildNextMasteryCut(previousCuts, session) {
  const ordered = [...previousCuts].sort((a, b) => a.session_index - b.session_index);
  const percentages = [...ordered.map((c) => c.session_percentage), session.sessionPercentage];
  const mastery = computeWeightedMastery(percentages);

  return {
    session_index: ordered.length ? ordered[ordered.length - 1].session_index + 1 : 1,
    session_percentage: roundPercentage(session.sessionPercentage),
    autonomous_percentage: roundPercentage(session.autonomousPercentage),
    supported_percentage: roundPercentage(session.supportedPercentage),
    mastery_percentage: mastery,
    mastery_level: getMasteryLevel(mastery).code,
  };
}

/**
 * Habilidad con menor promedio de grupo. Ignora habilidades sin datos (`average == null`).
 *
 * @param {Array<{ skill: string, average: number | null }>} skillAverages
 * @returns {{ skill: string, average: number } | null}
 */
export function findWeakestSkill(skillAverages) {
  return skillAverages
    .filter((s) => s.average != null)
    .reduce((weakest, s) => (weakest == null || s.average < weakest.average ? s : weakest), null);
}

/**
 * Cuenta alumnos por nivel. Los valores `null` (sin evaluar) se cuentan aparte.
 *
 * @param {Array<number | null>} percentages
 */
export function countByMasteryLevel(percentages) {
  const counts = Object.fromEntries(MASTERY_LEVELS.map((l) => [l.code, 0]));
  let notEvaluated = 0;
  for (const pct of percentages) {
    if (pct == null) notEvaluated += 1;
    else counts[getMasteryLevel(pct).code] += 1;
  }
  return { ...counts, not_evaluated: notEvaluated };
}

/** Puntos porcentuales de cambio en el acierto autónomo que cuentan como avance o como más apoyo. */
export const AUTONOMY_TREND_THRESHOLD = 10;

export const AUTONOMY_TRENDS = Object.freeze({
  toward_autonomy: 'Avanza hacia resolver sin pistas',
  steady: 'Se mantiene',
  more_support: 'Usó más apoyo recientemente',
});

/**
 * Compara las dos sesiones más recientes de una habilidad (pueden ser de grados distintos).
 * `fromSupport` indica que el alumno usó menos pistas y a la vez resolvió más por sí mismo:
 * es la conducta observable de avance ("Logrado con apoyo" → acierto autónomo).
 *
 * @param {Array<{ session_index: number, autonomous_percentage: number, supported_percentage: number }>} cuts
 */
export function computeAutonomyTrend(cuts) {
  if (!Array.isArray(cuts) || cuts.length < 2) return null;
  const [previous, latest] = [...cuts].sort((a, b) => a.session_index - b.session_index).slice(-2);
  const delta = roundPercentage(latest.autonomous_percentage - previous.autonomous_percentage);
  const trend = delta >= AUTONOMY_TREND_THRESHOLD ? 'toward_autonomy'
    : delta <= -AUTONOMY_TREND_THRESHOLD ? 'more_support' : 'steady';
  return { trend, label: AUTONOMY_TRENDS[trend], delta,
    previousAutonomous: previous.autonomous_percentage, latestAutonomous: latest.autonomous_percentage,
    previousSupported: previous.supported_percentage, latestSupported: latest.supported_percentage,
    fromSupport: trend === 'toward_autonomy' && previous.supported_percentage > 0
      && latest.supported_percentage < previous.supported_percentage };
}

/** El dominio longitudinal y el resultado de la última sesión son distintos. */
export function buildStudentSkills(skills, history) {
  return skills.map((skill) => {
    const cuts = history.filter((cut) => cut.skill_id === skill.id);
    const latest = cuts.reduce((last, cut) => !last || cut.session_index > last.session_index ? cut : last, null);
    const masteryPercentage = latest?.mastery_percentage ?? null;
    const level = masteryPercentage === null ? null : getMasteryLevel(masteryPercentage);
    return { code: skill.code, name: skill.name, masteryPercentage,
      level: level?.code ?? null, label: level?.label ?? 'Sin evaluar',
      autonomousPercentage: latest?.autonomous_percentage ?? null,
      supportedPercentage: latest?.supported_percentage ?? null, recordedAt: latest?.recorded_at ?? null,
      grade: latest?.grade ?? null,
      autonomyTrend: computeAutonomyTrend(cuts) };
  });
}

/**
 * Avance hacia la autonomía por habilidad. Solo cuenta alumnos con dos sesiones o más;
 * quien tiene una sola sesión no se clasifica.
 */
export function summarizeAutonomyProgress(skills, students) {
  const bySkill = skills.map((skill) => {
    const trends = students.map((student) => student.skills.find((entry) => entry.code === skill.code)?.autonomyTrend)
      .filter(Boolean);
    const count = (trend) => trends.filter((entry) => entry.trend === trend).length;
    return { code: skill.code, name: skill.name, comparedCount: trends.length,
      towardAutonomyCount: count('toward_autonomy'), steadyCount: count('steady'),
      moreSupportCount: count('more_support'), fromSupportCount: trends.filter((entry) => entry.fromSupport).length };
  });
  const advancing = (student) => student.skills.some((skill) => skill.autonomyTrend?.trend === 'toward_autonomy');
  const fromSupport = (student) => student.skills.some((skill) => skill.autonomyTrend?.fromSupport);
  const highlight = bySkill.filter((entry) => entry.fromSupportCount > 0)
    .reduce((best, entry) => !best || entry.fromSupportCount > best.fromSupportCount ? entry : best, null);
  return { threshold: AUTONOMY_TREND_THRESHOLD,
    comparedStudentCount: students.filter((student) => student.skills.some((skill) => skill.autonomyTrend)).length,
    towardAutonomyStudentCount: students.filter(advancing).length,
    fromSupportStudentCount: students.filter(fromSupport).length,
    highlight: highlight ? { skillCode: highlight.code, skillName: highlight.name, studentCount: highlight.fromSupportCount } : null,
    skills: bySkill };
}

/**
 * Plan concreto para la siguiente clase: la habilidad prioritaria, el error típico más
 * frecuente en ella (por alumnos distintos) y la actividad del catálogo que lo atiende.
 */
export function buildNextStep(weakestSkill, typicalErrors, activity) {
  if (!weakestSkill) return null;
  const error = typicalErrors.filter((entry) => entry.skillCode === weakestSkill.code)
    .reduce((top, entry) => !top || entry.studentCount > top.studentCount ? entry : top, null);
  return { skillCode: weakestSkill.code, skillName: weakestSkill.name,
    average: weakestSkill.average, label: weakestSkill.label,
    error: error ? { errorTag: error.errorTag, explanation: error.explanation, studentCount: error.studentCount } : null,
    activity };
}

/** La ausencia de evidencia nunca se convierte en cero. */
export function summarizeGroupSkills(skills, students) {
  return skills.map((skill) => {
    const values = students.map((student) => student.skills.find((s) => s.code === skill.code))
      .filter((s) => s?.masteryPercentage != null);
    const average = values.length ? roundPercentage(values.reduce((sum, s) => sum + s.masteryPercentage, 0) / values.length) : null;
    const level = average === null ? null : getMasteryLevel(average);
    const gradeCounts = Object.fromEntries([...new Set(values.map((value) => value.grade).filter(Number.isInteger))]
      .sort((a, b) => a - b)
      .map((grade) => [grade, values.filter((value) => value.grade === grade).length]));
    return { code: skill.code, name: skill.name, average, level: level?.code ?? null,
      label: level?.label ?? 'Sin evaluar', evaluatedCount: values.length,
      needsSupportCount: values.filter((s) => s.level === 'needs_support').length,
      gradeCounts,
      evidencePercentage: students.length ? roundPercentage(values.length / students.length * 100) : 0,
      distribution: countByMasteryLevel(students.map((student) =>
        student.skills.find((entry) => entry.code === skill.code)?.masteryPercentage ?? null)),
    };
  });
}

export function countStudentsNeedingSupport(students) {
  return students.filter((student) => student.skills.some((skill) => skill.level === 'needs_support')).length;
}

/** Selección determinista desde catálogo; no inventa actividades ni infiere errores. */
export function selectRecommendedActivity(activities, skillCode, typicalErrors) {
  if (!skillCode) return null;
  const candidates = activities.filter((activity) => activity.skill_code === skillCode);
  const error = typicalErrors.find((entry) => entry.skillCode === skillCode);
  const activity = candidates.find((entry) => error && entry.target_error_tag === error.errorTag) ?? candidates[0];
  return activity ? { id: activity.id, title: activity.title, description: activity.description,
    durationMinutes: activity.duration_minutes, grouping: activity.grouping, materials: activity.materials,
    targetErrorTag: activity.target_error_tag } : null;
}

export function toHistoryDto(cut) {
  const level = getMasteryLevel(cut.mastery_percentage);
  return { id: cut.id, skillCode: cut.skill_code, skillName: cut.skill_name,
    grade: cut.grade, schoolYear: cut.school_year ?? null, sessionIndex: cut.session_index,
    sessionPercentage: cut.session_percentage, autonomousPercentage: cut.autonomous_percentage,
    supportedPercentage: cut.supported_percentage, masteryPercentage: cut.mastery_percentage,
    level: level.code, label: level.label, recordedAt: cut.recorded_at };
}

/** Solo filtros explícitos y escalares; nunca nombres de alumnos en la URL. */
export function parseAnalyticsSelection(query, skills) {
  const invalid = () => new DomainError('VALIDATION_ERROR', 'Elige una habilidad válida y si deseas ver solo alumnos que necesitan apoyo.');
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw invalid();
  if (Object.keys(query).some((key) => !['skillCode', 'supportOnly'].includes(key))) throw invalid();
  const { skillCode, supportOnly } = query;
  if (skillCode !== undefined && (typeof skillCode !== 'string' || !skills.some((skill) => skill.code === skillCode))) throw invalid();
  if (supportOnly !== undefined && !['true', 'false'].includes(supportOnly)) throw invalid();
  return { skillCode: skillCode ?? null, supportOnly: supportOnly === 'true' };
}

export function selectAnalyticsStudents(students, selection) {
  if (!selection.supportOnly) return students;
  return students.filter((student) => student.skills.some((skill) =>
    (!selection.skillCode || skill.code === selection.skillCode) && skill.level === 'needs_support'));
}

export function summarizeGroupEvidence(students) {
  const evaluatedStudentCount = students.filter((student) => student.skills.some((skill) => skill.masteryPercentage !== null)).length;
  const dates = students.flatMap((student) => student.skills.map((skill) => skill.recordedAt).filter(Boolean));
  return { evaluatedStudentCount, notEvaluatedStudentCount: students.length - evaluatedStudentCount,
    latestRecordedAt: dates.reduce((latest, date) => latest === null || date > latest ? date : latest, null) };
}
