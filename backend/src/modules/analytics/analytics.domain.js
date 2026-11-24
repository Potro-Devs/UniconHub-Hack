/**
 * Módulo analytics — Capa 3 (Dominio): escala de dominio y promedio ponderado evolutivo.
 * Funciones puras sin I/O (AGENTS.md §4.3 y §4.5).
 */

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
      supportedPercentage: latest?.supported_percentage ?? null, recordedAt: latest?.recorded_at ?? null };
  });
}

/** La ausencia de evidencia nunca se convierte en cero. */
export function summarizeGroupSkills(skills, students) {
  return skills.map((skill) => {
    const values = students.map((student) => student.skills.find((s) => s.code === skill.code))
      .filter((s) => s?.masteryPercentage != null);
    const average = values.length ? roundPercentage(values.reduce((sum, s) => sum + s.masteryPercentage, 0) / values.length) : null;
    const level = average === null ? null : getMasteryLevel(average);
    return { code: skill.code, name: skill.name, average, level: level?.code ?? null,
      label: level?.label ?? 'Sin evaluar', evaluatedCount: values.length,
      needsSupportCount: values.filter((s) => s.level === 'needs_support').length };
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
