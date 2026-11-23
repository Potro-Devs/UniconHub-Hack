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
