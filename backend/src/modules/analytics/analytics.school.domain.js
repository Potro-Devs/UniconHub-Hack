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
/** Avance del temario (contenidos vistos) a partir del cual no se marca como prioridad. */
export const MIN_COVERAGE_PERCENTAGE = 25;

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
    .sort((a, b) => b.studentCount - a.studentCount || a.skillCode.localeCompare(b.skillCode) || a.errorTag.localeCompare(b.errorTag))
    .slice(0, limit)
    .map(({ groups, ...e }) => ({ ...e, groupCount: groups.size, skillName: skillName[e.skillCode] ?? e.skillCode }));
}

/**
 * Prioridades para decidir, ordenadas por tipo. Lenguaje no punitivo: describe la situación
 * y sugiere una acción, sin calificar a docentes ni alumnos.
 */
export function buildSchoolPriorities(groups, skills) {
  const priorities = [];

  const lowEvidence = groups.filter((g) => g.studentCount > 0 && g.evidencePercentage < MIN_EVIDENCE_PERCENTAGE);
  if (lowEvidence.length) {
    priorities.push({ type: 'evidence', groupIds: lowEvidence.map((g) => g.id),
      title: `Completar el diagnóstico en ${lowEvidence.map((g) => g.name).join(', ')}`,
      detail: `Menos de ${MIN_EVIDENCE_PERCENTAGE}% de sus alumnos tiene diagnóstico; sus resultados aún no son representativos.`,
      action: 'Acordar con cada docente una fecha para aplicar la evaluación en pantalla o en papel.' });
  }

  const evaluatedSkills = skills.filter((s) => s.average != null);
  const schoolPriority = evaluatedSkills.reduce((min, s) => (!min || s.average < min.average ? s : min), null);
  if (schoolPriority) {
    const affected = groups.filter((g) => {
      const s = g.skills.find((entry) => entry.code === schoolPriority.code);
      return s?.average != null && s.average < 50;
    });
    priorities.push({ type: 'skill', skillCode: schoolPriority.code, groupIds: affected.map((g) => g.id),
      title: `${schoolPriority.name}: la habilidad con menor dominio en la escuela`,
      detail: `Promedio ${schoolPriority.average}% · ${schoolPriority.label}. `
        + `${schoolPriority.needsSupportCount} alumnos necesitan apoyo`
        + (affected.length ? `; ${affected.length} de ${groups.length} grupos están por debajo de 50%.` : '.'),
      action: 'Proponerla como tema del próximo Consejo Técnico Escolar y compartir estrategias entre docentes.' });
  }

  const support = groups.filter((g) => g.studentCount > 0 && g.evidencePercentage >= MIN_EVIDENCE_PERCENTAGE)
    .sort((a, b) => b.needsSupportPercentage - a.needsSupportPercentage || a.grade - b.grade)
    .filter((g) => g.needsSupportCount > 0)
    .slice(0, 3);
  for (const g of support) {
    priorities.push({ type: 'group_support', groupIds: [g.id],
      title: `Acompañar a ${g.name}${g.teacherName ? ` (${g.teacherName})` : ''}`,
      detail: `${g.needsSupportCount} de ${g.studentCount} alumnos (${g.needsSupportPercentage}%) necesitan apoyo en al menos una habilidad`
        + (g.prioritySkill ? `; prioridad: ${g.prioritySkill.name} (${g.prioritySkill.average}%).` : '.'),
      action: 'Revisar con la docente o el docente el mapa del grupo y la actividad sugerida.' });
  }

  const lowCoverage = groups.filter((g) => g.coveragePercentage < MIN_COVERAGE_PERCENTAGE);
  if (lowCoverage.length) {
    priorities.push({ type: 'coverage', groupIds: lowCoverage.map((g) => g.id),
      title: `Revisar el avance del temario en ${lowCoverage.map((g) => g.name).join(', ')}`,
      detail: `Menos de ${MIN_COVERAGE_PERCENTAGE}% de los contenidos del grado está marcado como visto.`,
      action: 'Confirmar si el registro del temario está al día o si se requiere ajustar la planeación.' });
  }

  return priorities;
}

/**
 * Resumen general de la escuela a partir de los grupos del ciclo actual.
 */
export function summarizeSchool(groups) {
  const total = (key) => groups.reduce((sum, g) => sum + g[key], 0);
  const studentCount = total('studentCount');
  const evaluatedStudentCount = total('evaluatedStudentCount');
  const needsSupportCount = total('needsSupportCount');
  const teachers = new Set(groups.map((g) => g.teacherName).filter(Boolean));
  return { groupCount: groups.length, teacherCount: teachers.size, studentCount, evaluatedStudentCount,
    evidencePercentage: pct(evaluatedStudentCount, studentCount), needsSupportCount,
    needsSupportPercentage: pct(needsSupportCount, studentCount),
    coveragePercentage: average(groups.map((g) => g.coveragePercentage)) ?? 0 };
}

/** Ciclo escolar más reciente entre los grupos de la escuela (`AAAA-AAAA`). */
export function currentSchoolYear(groups) {
  return groups.reduce((max, g) => (max == null || g.school_year > max ? g.school_year : max), null);
}
