/**
 * Módulo analytics — Capa 3 (Dominio): panel de la escuela para Dirección.
 * Funciones puras sin I/O. Solo agregados: nunca nombres ni folios de alumnos.
 *
 * Los campos formativos son los 4 del Plan de Estudio 2022 de la SEP. Un campo sin
 * habilidades evaluadas en Axi se reporta como "sin evaluación", nunca como 0 %.
 */
import { FORMATIVE_FIELD_NAMES } from '../curriculum/curriculum.domain.js';
import { getMasteryLevel, roundPercentage, MASTERY_LEVELS } from './analytics.domain.js';

/** Campos formativos SEP (Plan de Estudio 2022), en el orden oficial. */
export const SEP_FORMATIVE_FIELDS = Object.freeze(
  Object.entries(FORMATIVE_FIELD_NAMES).map(([code, name]) => Object.freeze({ code, name })),
);

/** Por debajo de este % de alumnos con diagnóstico, el dato del grupo aún no es representativo. */
export const MIN_EVIDENCE_PERCENTAGE = 50;
/** Umbral de "Logrado" en la escala de 25 % (AGENTS.md §4.3). */
export const ACHIEVED_MIN = MASTERY_LEVELS.find((l) => l.code === 'achieved').min;
/** Un grupo se sugiere para acompañamiento si al menos este % de alumnos necesita apoyo. */
export const GROUP_SUPPORT_PERCENTAGE = 50;
/** Conteos menores no se reportan en agregados de escuela, para no permitir reidentificar alumnos. */
export const MIN_REPORTABLE_COUNT = 3;
/** Avance del temario (contenidos vistos) a partir del cual no se marca como prioridad. */
export const MIN_COVERAGE_PERCENTAGE = 25;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const average = (values) => (values.length ? roundPercentage(values.reduce((sum, v) => sum + v, 0) / values.length) : null);
const pct = (part, total) => (total ? roundPercentage((part / total) * 100) : 0);

function levelOf(value) {
  if (value == null) return { level: null, label: 'Sin evaluar' };
  const level = getMasteryLevel(value);
  return { level: level.code, label: level.label };
}

function emptyDistribution() {
  return Object.fromEntries([...MASTERY_LEVELS.map((l) => [l.code, 0]), ['not_evaluated', 0]]);
}

/**
 * Habilidades de cada campo formativo según el temario (`curriculum_contents.formative_field`).
 *
 * @param {Array<{ skill_code: string, formative_field: string }>} rows
 * @returns {Record<string, string[]>}
 */
export function mapSkillsToFields(rows) {
  const map = Object.fromEntries(SEP_FORMATIVE_FIELDS.map((f) => [f.code, []]));
  for (const row of rows) {
    if (map[row.formative_field] && !map[row.formative_field].includes(row.skill_code)) {
      map[row.formative_field].push(row.skill_code);
    }
  }
  return map;
}

/**
 * Dominio de un alumno en un campo: promedio de sus habilidades evaluadas en ese campo.
 *
 * @param {{ skills: Array<{ code: string, masteryPercentage: number | null }> }} student
 * @param {string[]} skillCodes
 */
export function studentFieldMastery(student, skillCodes) {
  return average(student.skills
    .filter((s) => skillCodes.includes(s.code) && s.masteryPercentage != null)
    .map((s) => s.masteryPercentage));
}

/**
 * Resumen de cada campo formativo para un conjunto de alumnos.
 *
 * @param {Array<{ skills: Array<{ code: string, name: string, masteryPercentage: number | null }> }>} students
 * @param {Record<string, string[]>} fieldSkills
 * @param {Array<{ code: string, name: string }>} skillRows
 */
export function summarizeFields(students, fieldSkills, skillRows) {
  return SEP_FORMATIVE_FIELDS.map((field) => {
    const codes = fieldSkills[field.code] ?? [];
    const skills = skillRows.filter((s) => codes.includes(s.code)).map((s) => ({ code: s.code, name: s.name }));
    if (!codes.length) {
      return { code: field.code, name: field.name, assessed: false, skills, average: null, level: null,
        label: 'Sin evaluación en Axi', evaluatedCount: 0, needsSupportCount: 0, distribution: emptyDistribution() };
    }
    const values = students.map((student) => studentFieldMastery(student, codes));
    const evaluated = values.filter((v) => v != null);
    const distribution = emptyDistribution();
    for (const v of values) {
      if (v == null) distribution.not_evaluated += 1;
      else distribution[getMasteryLevel(v).code] += 1;
    }
    const avg = average(evaluated);
    return { code: field.code, name: field.name, assessed: true, skills, average: avg, ...levelOf(avg),
      evaluatedCount: evaluated.length, needsSupportCount: distribution.needs_support, distribution };
  });
}

/**
 * Promedio por habilidad de un conjunto de alumnos (la ausencia de datos no cuenta como 0).
 */
export function summarizeSkills(students, skillRows) {
  return skillRows.map((skill) => {
    const values = students.map((st) => st.skills.find((s) => s.code === skill.code)?.masteryPercentage)
      .filter((v) => v != null);
    const avg = average(values);
    const needsSupportCount = values.filter((v) => getMasteryLevel(v).code === 'needs_support').length;
    return { code: skill.code, name: skill.name, average: avg, ...levelOf(avg), evaluatedCount: values.length,
      needsSupportCount };
  });
}

const isEvaluated = (student) => student.skills.some((s) => s.masteryPercentage != null);
const needsSupport = (student) => student.skills.some((s) => s.level === 'needs_support');

/**
 * Tarjeta de un grupo para el panel de Dirección.
 *
 * @param {{ id: number, grade: number, section: string, schoolYear: string, teacherName: string | null }} group
 * @param {Array<object>} students Alumnos activos con `skills` (ver `buildStudentSkills`).
 * @param {{ coveragePercentage: number }} curriculum
 */
export function summarizeSchoolGroup(group, students, skillRows, fieldSkills, curriculum) {
  const skills = summarizeSkills(students, skillRows);
  const prioritySkill = skills.filter((s) => s.average != null)
    .reduce((min, s) => (!min || s.average < min.average ? s : min), null);
  const evaluatedStudentCount = students.filter(isEvaluated).length;
  const needsSupportCount = students.filter(needsSupport).length;
  return {
    id: group.id, name: `${group.grade}.º ${group.section}`, grade: group.grade, section: group.section,
    schoolYear: group.schoolYear, teacherName: group.teacherName ?? null,
    studentCount: students.length, evaluatedStudentCount,
    evidencePercentage: pct(evaluatedStudentCount, students.length),
    needsSupportCount, needsSupportPercentage: pct(needsSupportCount, students.length),
    fields: summarizeFields(students, fieldSkills, skillRows)
      .map(({ code, name, assessed, average: avg, level, label }) => ({ code, name, assessed, average: avg, level, label })),
    skills: skills.map(({ code, name, average: avg, level, label }) => ({ code, name, average: avg, level, label })),
    prioritySkill: prioritySkill
      ? { code: prioritySkill.code, name: prioritySkill.name, average: prioritySkill.average, label: prioritySkill.label }
      : null,
    coveragePercentage: curriculum.coveragePercentage,
  };
}

/**
 * Une los errores típicos de varios grupos (cada alumno activo está en un solo grupo).
 *
 * @param {Array<Array<{ skillCode: string, errorTag: string, explanation: string, studentCount: number }>>} perGroup
 */
export function mergeTypicalErrors(perGroup, skillRows, limit = 5) {
  const byKey = new Map();
  perGroup.forEach((errors, groupIndex) => {
    for (const e of errors) {
      const key = `${e.skillCode}|${e.errorTag}`;
      const prev = byKey.get(key) ?? { skillCode: e.skillCode, errorTag: e.errorTag, explanation: e.explanation,
        studentCount: 0, groups: new Set() };
      prev.studentCount += e.studentCount;
      prev.groups.add(groupIndex);
      byKey.set(key, prev);
    }
  });
  const skillName = Object.fromEntries(skillRows.map((s) => [s.code, s.name]));
  return [...byKey.values()]
    .filter((e) => e.studentCount >= MIN_REPORTABLE_COUNT)
    .sort((a, b) => b.studentCount - a.studentCount || a.skillCode.localeCompare(b.skillCode) || a.errorTag.localeCompare(b.errorTag))
    .slice(0, limit)
    .map(({ groups, ...e }) => ({ ...e, groupCount: groups.size, skillName: skillName[e.skillCode] ?? e.skillCode }));
}

/** Máximo de prioridades del mes: pocas y accionables para la sesión del CTE. */
export const MAX_PRIORITIES = 3;

const listNames = (groups) => {
  const names = groups.map((g) => g.name);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
};

/**
 * Prioridades del mes, resumidas (título corto, un dato y una acción) y ordenadas por tipo:
 * diagnóstico pendiente → habilidad con menor dominio → grupos por acompañar → temario.
 * Lenguaje no punitivo: describe la situación sin calificar a docentes ni alumnos.
 */
export function buildSchoolPriorities(groups, skills) {
  const priorities = [];

  const lowEvidence = groups.filter((g) => g.studentCount > 0 && g.evidencePercentage < MIN_EVIDENCE_PERCENTAGE);
  if (lowEvidence.length) {
    priorities.push({ type: 'evidence', groupIds: lowEvidence.map((g) => g.id),
      title: `Completar el diagnóstico de ${listNames(lowEvidence)}`,
      detail: `Menos de ${MIN_EVIDENCE_PERCENTAGE}% de sus alumnos tiene diagnóstico.`,
      action: 'Acordar fecha de aplicación con cada docente.' });
  }

  const evaluatedSkills = skills.filter((s) => s.average != null);
  const schoolPriority = evaluatedSkills.reduce((min, s) => (!min || s.average < min.average ? s : min), null);
  if (schoolPriority) {
    // Solo cuentan los grupos cuyo grado trabaja esa habilidad.
    const teaching = groups.filter((g) => g.skills.some((entry) => entry.code === schoolPriority.code));
    const affected = teaching.filter((g) => {
      const s = g.skills.find((entry) => entry.code === schoolPriority.code);
      return s?.average != null && s.average < ACHIEVED_MIN;
    });
    priorities.push({ type: 'skill', skillCode: schoolPriority.code, groupIds: affected.map((g) => g.id),
      title: `Reforzar ${schoolPriority.name}` + (schoolPriority.grades ? ` (${schoolPriority.grades})` : ''),
      detail: `${schoolPriority.average}% · ${schoolPriority.label}`
        + (affected.length ? ` · ${affected.length} de ${plural(teaching.length, 'grupo', 'grupos')} por debajo de ${ACHIEVED_MIN}%.` : '.'),
      action: 'Tema sugerido para el CTE: compartir estrategias.' });
  }

  // Por umbral y en orden de grado: no es una comparación entre docentes ni un ranking.
  const support = groups.filter((g) => g.studentCount > 0 && g.evidencePercentage >= MIN_EVIDENCE_PERCENTAGE
    && g.needsSupportPercentage >= GROUP_SUPPORT_PERCENTAGE)
    .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
  if (support.length) {
    priorities.push({ type: 'group_support', groupIds: support.map((g) => g.id),
      title: `Acompañar a ${listNames(support)}`,
      detail: `${GROUP_SUPPORT_PERCENTAGE}% o más de sus alumnos necesita apoyo en alguna habilidad.`,
      action: 'Revisar con su docente el mapa del grupo.' });
  }

  const lowCoverage = groups.filter((g) => g.coveragePercentage < MIN_COVERAGE_PERCENTAGE);
  if (lowCoverage.length) {
    priorities.push({ type: 'coverage', groupIds: lowCoverage.map((g) => g.id),
      title: `Revisar el temario de ${listNames(lowCoverage)}`,
      detail: `Menos de ${MIN_COVERAGE_PERCENTAGE}% de los contenidos está marcado como visto.`,
      action: 'Confirmar si el registro está al día.' });
  }

  return priorities.slice(0, MAX_PRIORITIES);
}

// ───────────────────────── Consejo Técnico Escolar ─────────────────────────

/**
 * Sesiones ordinarias del CTE por ciclo escolar (calendario escolar SEP 2026-2027, publicado
 * en el DOF). Son el último viernes del mes, sin sesión en diciembre ni en abril.
 */
export const CTE_SESSIONS = Object.freeze({
  '2026-2027': Object.freeze(['2026-09-25', '2026-10-30', '2026-11-27', '2027-01-29', '2027-02-26',
    '2027-03-26', '2027-05-28', '2027-06-25']),
});

/** Meses sin sesión ordinaria del CTE (vacaciones de invierno y de verano). */
const NO_CTE_MONTHS = [6, 7, 11];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];
const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m: m - 1, d }; };
const dayNumber = (iso) => { const { y, m, d } = parseIso(iso); return Date.UTC(y, m, d) / 86400000; };

/** Último viernes del mes (`monthIndex` 0–11) como `AAAA-MM-DD`. */
export function lastFridayOfMonth(year, monthIndex) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const back = (last.getUTCDay() - 5 + 7) % 7;
  return toIso(year, monthIndex, last.getUTCDate() - back);
}

/** "viernes 27 de noviembre de 2026". */
export function formatCteDate(iso) {
  const { y, m, d } = parseIso(iso);
  return `viernes ${d} de ${MONTHS[m]} de ${y}`;
}

/**
 * Próxima sesión del CTE en o después de `todayIso`. Usa el calendario oficial del ciclo si está
 * cargado; si no, estima con la regla del último viernes del mes (`source: 'rule'`, por confirmar).
 */
export function nextCteSession(todayIso, schoolYear) {
  const today = dayNumber(todayIso);
  const official = (CTE_SESSIONS[schoolYear] ?? []).find((iso) => dayNumber(iso) >= today);
  let date = official;
  let source = 'calendar';
  if (!date) {
    // Estimación: último viernes del mes, saltando meses de vacaciones sin CTE ordinario.
    source = 'rule';
    let { y, m } = parseIso(todayIso);
    for (;;) {
      if (!NO_CTE_MONTHS.includes(m)) {
        date = lastFridayOfMonth(y, m);
        if (dayNumber(date) >= today) break;
      }
      m += 1;
      if (m === 12) { m = 0; y += 1; }
    }
  }
  const { y, m } = parseIso(date);
  return { date, label: formatCteDate(date), month: `${MONTHS[m]} ${y}`, daysUntil: dayNumber(date) - today, source };
}

/**
 * Docentes del ciclo actual con sus grupos (agregados; sin datos de alumnos ni correos).
 *
 * @param {Array<{ teacherId: number | null, group: object }>} entries
 */
export function summarizeTeachers(entries) {
  const byTeacher = new Map();
  for (const { teacherId, group } of entries) {
    if (teacherId == null) continue;
    const t = byTeacher.get(teacherId) ?? { name: group.teacherName, groups: [], studentCount: 0,
      evaluatedStudentCount: 0, needsSupportCount: 0 };
    t.groups.push(group.name);
    t.studentCount += group.studentCount;
    t.evaluatedStudentCount += group.evaluatedStudentCount;
    t.needsSupportCount += group.needsSupportCount;
    byTeacher.set(teacherId, t);
  }
  return [...byTeacher.values()]
    .map((t) => ({ ...t, evidencePercentage: pct(t.evaluatedStudentCount, t.studentCount) }))
    .sort((a, b) => a.groups[0].localeCompare(b.groups[0], 'es', { numeric: true }));
}

/**
 * Resumen general de la escuela a partir de los grupos del ciclo actual.
 */
export function summarizeSchool(groups, teacherIds = []) {
  const total = (key) => groups.reduce((sum, g) => sum + g[key], 0);
  const studentCount = total('studentCount');
  const evaluatedStudentCount = total('evaluatedStudentCount');
  const needsSupportCount = total('needsSupportCount');
  // Por id (no por nombre): dos docentes con el mismo nombre cuentan como dos.
  const teacherCount = new Set(teacherIds.filter((id) => id != null)).size;
  return { groupCount: groups.length, teacherCount, studentCount, evaluatedStudentCount,
    evidencePercentage: pct(evaluatedStudentCount, studentCount), needsSupportCount,
    needsSupportPercentage: pct(needsSupportCount, studentCount),
    coveragePercentage: average(groups.map((g) => g.coveragePercentage)) ?? 0 };
}

/** Ciclo escolar más reciente entre los grupos de la escuela (`AAAA-AAAA`). */
export function currentSchoolYear(groups) {
  return groups.reduce((max, g) => (max == null || g.school_year > max ? g.school_year : max), null);
}
