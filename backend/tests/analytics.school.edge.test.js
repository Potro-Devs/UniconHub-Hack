/**
 * Panel de Dirección: casos límite del dominio (escuela sin grupos, grupo sin alumnos,
 * escala de 25 %, errores típicos) y coherencia/privacidad de GET /api/v1/analytics/school
 * sobre el seed completo (7 grupos del ciclo actual) en :memory:.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import {
  MIN_REPORTABLE_COUNT, buildSchoolPriorities, currentSchoolYear, mapSkillsToFields, mergeTypicalErrors, summarizeFields,
  summarizeSchool, summarizeSchoolGroup, summarizeSkills,
} from '../src/modules/analytics/analytics.school.domain.js';
import { configWith, silentLogger, startServer } from './helpers.js';

const SKILLS = [
  { code: 'fractions', name: 'Fracciones' },
  { code: 'reading_comprehension', name: 'Comprensión lectora' },
];
const FIELD_SKILLS = mapSkillsToFields([
  { skill_code: 'fractions', formative_field: 'saberes_pensamiento_cientifico' },
  { skill_code: 'reading_comprehension', formative_field: 'lenguajes' },
]);
const lvl = (v) => (v == null ? null : v < 25 ? 'needs_support' : v < 50 ? 'in_progress' : v < 75 ? 'achieved' : 'mastered');
const student = (fractions, reading) => ({ skills: [
  { code: 'fractions', masteryPercentage: fractions, level: lvl(fractions) },
  { code: 'reading_comprehension', masteryPercentage: reading, level: lvl(reading) },
] });
const GROUP = { id: 9, grade: 2, section: 'C', schoolYear: '2026-2027', teacherName: 'Mtra. Ficticia' };
const round2 = (n) => Math.round(n * 100) / 100;

describe('analytics.school.domain · casos límite', () => {
  test('escuela sin grupos: resumen en ceros, sin NaN y sin prioridades', () => {
    assert.deepEqual(summarizeSchool([], []), { groupCount: 0, teacherCount: 0, studentCount: 0, evaluatedStudentCount: 0,
      evidencePercentage: 0, needsSupportCount: 0, needsSupportPercentage: 0, coveragePercentage: 0 });
    assert.equal(currentSchoolYear([]), null);
    const skills = summarizeSkills([], SKILLS);
    assert.ok(skills.every((s) => s.average === null && s.evaluatedCount === 0 && s.label === 'Sin evaluar'));
    assert.deepEqual(buildSchoolPriorities([], skills), []);
    const fields = summarizeFields([], FIELD_SKILLS, SKILLS);
    assert.equal(fields.length, 4);
    assert.ok(fields.every((f) => f.average === null && f.evaluatedCount === 0));
  });

  test('currentSchoolYear elige el ciclo más reciente sin importar el orden', () => {
    assert.equal(currentSchoolYear([{ school_year: '2025-2026' }, { school_year: '2026-2027' }, { school_year: '2024-2025' }]), '2026-2027');
  });

  test('grupo sin alumnos: 0 % sin dividir entre cero, sin prioridad y fuera de "completar diagnóstico"', () => {
    const g = summarizeSchoolGroup(GROUP, [], SKILLS, FIELD_SKILLS, { coveragePercentage: 80 });
    assert.equal(g.studentCount, 0);
    assert.equal(g.evidencePercentage, 0);
    assert.equal(g.needsSupportPercentage, 0);
    assert.equal(g.prioritySkill, null);
    assert.ok(g.skills.every((s) => s.average === null && s.label === 'Sin evaluar'));
    assert.ok(g.fields.filter((f) => f.assessed).every((f) => f.average === null && f.level === null));
    const priorities = buildSchoolPriorities([g], summarizeSkills([], SKILLS));
    assert.deepEqual(priorities, [], 'un grupo vacío con temario al día no genera prioridades');
  });

  test('grupo con alumnos sin diagnóstico: evidencia 0 % y prioridad de completar diagnóstico', () => {
    const g = summarizeSchoolGroup(GROUP, [student(null, null), student(null, null)], SKILLS, FIELD_SKILLS, { coveragePercentage: 80 });
    assert.equal(g.evaluatedStudentCount, 0);
    assert.equal(g.evidencePercentage, 0);
    const priorities = buildSchoolPriorities([g], summarizeSkills([student(null, null)], SKILLS));
    assert.deepEqual(priorities.map((p) => p.type), ['evidence']);
    assert.deepEqual(priorities[0].groupIds, [9]);
  });

  test('escala de 25 % en el promedio por habilidad y por campo (24.99 / 25 / 49.99 / 50 / 74.99 / 75)', () => {
    const cases = [[24.99, 'needs_support'], [25, 'in_progress'], [49.99, 'in_progress'], [50, 'achieved'],
      [74.99, 'achieved'], [75, 'mastered'], [0, 'needs_support'], [100, 'mastered']];
    for (const [value, level] of cases) {
      const [skill] = summarizeSkills([student(value, null)], SKILLS);
      assert.equal(skill.level, level, `habilidad ${value}`);
      const field = summarizeFields([student(value, null)], FIELD_SKILLS, SKILLS)
        .find((f) => f.code === 'saberes_pensamiento_cientifico');
      assert.equal(field.level, level, `campo ${value}`);
      assert.equal(field.distribution[level], 1);
    }
  });

  test('la ausencia de dato no cuenta como 0 en el promedio de habilidad', () => {
    const [fractions] = summarizeSkills([student(80, null), student(null, null)], SKILLS);
    assert.equal(fractions.average, 80);
    assert.equal(fractions.evaluatedCount, 1);
  });

  test('porcentajes del grupo cuadran con los conteos (redondeo a 2 decimales)', () => {
    const students = [student(10, 60), student(null, null), student(90, 90)];
    const g = summarizeSchoolGroup(GROUP, students, SKILLS, FIELD_SKILLS, { coveragePercentage: 0 });
    assert.equal(g.evaluatedStudentCount, 2);
    assert.equal(g.evidencePercentage, 66.67);
    assert.equal(g.needsSupportCount, 1);
    assert.equal(g.needsSupportPercentage, 33.33);
  });

  test('mergeTypicalErrors: groupCount cuenta grupos distintos aunque haya varias explicaciones por etiqueta', () => {
    const merged = mergeTypicalErrors([
      [{ skillCode: 'fractions', errorTag: 'x', explanation: 'X1', studentCount: 3 },
        { skillCode: 'fractions', errorTag: 'x', explanation: 'X2', studentCount: 3 }],
      [],
      [{ skillCode: 'fractions', errorTag: 'x', explanation: 'X3', studentCount: 3 }],
    ], SKILLS);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].groupCount, 2);
    assert.equal(merged[0].explanation, 'X1', 'conserva la primera explicación');
  });

  test('mergeTypicalErrors: misma etiqueta en habilidades distintas no se mezcla; límite y desempate estables', () => {
    const merged = mergeTypicalErrors([[
      { skillCode: 'fractions', errorTag: 'same', explanation: 'A', studentCount: 5 },
      { skillCode: 'reading_comprehension', errorTag: 'same', explanation: 'B', studentCount: 5 },
      { skillCode: 'fractions', errorTag: 'a', explanation: 'C', studentCount: 3 },
      { skillCode: 'fractions', errorTag: 'b', explanation: 'D', studentCount: 3 },
    ]], SKILLS, 3);
    assert.deepEqual(merged.map((e) => `${e.skillCode}|${e.errorTag}`),
      ['fractions|same', 'reading_comprehension|same', 'fractions|a']);
    assert.deepEqual(mergeTypicalErrors([], SKILLS), []);
  });

  test('mergeTypicalErrors: no reporta etiquetas con menos de MIN_REPORTABLE_COUNT alumnos (2 / 3), sumando entre grupos', () => {
    assert.equal(MIN_REPORTABLE_COUNT, 3);
    const merged = mergeTypicalErrors([
      [{ skillCode: 'fractions', errorTag: 'raro', explanation: 'R', studentCount: 2 },
        { skillCode: 'fractions', errorTag: 'suma', explanation: 'S', studentCount: 1 }],
      [{ skillCode: 'fractions', errorTag: 'suma', explanation: 'S', studentCount: 2 }],
    ], SKILLS);
    assert.deepEqual(merged.map((e) => [e.errorTag, e.studentCount]), [['suma', 3]]);
  });

  test('summarizeSchool: teacherCount por id (homónimos cuentan dos, null no cuenta) y avance promedio por grupo', () => {
    const a = summarizeSchoolGroup({ ...GROUP, id: 1 }, [student(10, 10)], SKILLS, FIELD_SKILLS, { coveragePercentage: 10 });
    const b = summarizeSchoolGroup({ ...GROUP, id: 2, teacherName: null }, [student(90, 90)], SKILLS, FIELD_SKILLS, { coveragePercentage: 20 });
    const c = summarizeSchoolGroup({ ...GROUP, id: 3, teacherName: 'Mtro. Otro' }, [], SKILLS, FIELD_SKILLS, { coveragePercentage: 25 });
    const s = summarizeSchool([a, b, c], [11, null, 12]);
    assert.equal(s.teacherCount, 2);
    assert.equal(summarizeSchool([a, b], [11, 11]).teacherCount, 1, 'un docente con dos grupos cuenta una vez');
    assert.equal(s.studentCount, 2);
    assert.equal(s.needsSupportPercentage, 50);
    assert.equal(s.coveragePercentage, round2(55 / 3));
  });
});

describe('GET /api/v1/analytics/school · coherencia y privacidad (seed completo)', () => {
  let db;
  let api;
  let body;

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
    const token = (await api.call('POST', '/api/v1/auth/quick-login/director')).body.data.token;
    const res = await api.call('GET', '/api/v1/analytics/school', { token });
    assert.equal(res.status, 200);
    body = res.body;
  });

  after(async () => {
    await api.close();
    db.close();
  });

  test('formato { data, meta } y errores { error: { code, message } } en 401/403', async () => {
    assert.ok(body.data && body.meta);
    assert.equal(typeof body.meta.source, 'string');
    const none = await api.call('GET', '/api/v1/analytics/school');
    assert.equal(none.status, 401);
    assert.equal(typeof none.body.error.code, 'string');
    assert.equal(typeof none.body.error.message, 'string');
    const teacher = (await api.call('POST', '/api/v1/auth/quick-login/teacher')).body.data.token;
    const denied = await api.call('GET', '/api/v1/analytics/school', { token: teacher });
    assert.equal(denied.status, 403);
    assert.equal(typeof denied.body.error.code, 'string');
    assert.equal(denied.body.data, undefined);
  });

  test('los porcentajes de cada grupo y del resumen cuadran con los conteos', () => {
    const { groups, summary } = body.data;
    for (const g of groups) {
      assert.ok(g.evaluatedStudentCount <= g.studentCount, g.name);
      assert.ok(g.needsSupportCount <= g.studentCount, g.name);
      assert.equal(g.evidencePercentage, round2((g.evaluatedStudentCount / g.studentCount) * 100), g.name);
      assert.equal(g.needsSupportPercentage, round2((g.needsSupportCount / g.studentCount) * 100), g.name);
    }
    const sum = (k) => groups.reduce((n, g) => n + g[k], 0);
    assert.equal(summary.groupCount, groups.length);
    assert.equal(summary.studentCount, sum('studentCount'));
    assert.equal(summary.evaluatedStudentCount, sum('evaluatedStudentCount'));
    assert.equal(summary.needsSupportCount, sum('needsSupportCount'));
    assert.equal(summary.evidencePercentage, round2((summary.evaluatedStudentCount / summary.studentCount) * 100));
    assert.equal(summary.needsSupportPercentage, round2((summary.needsSupportCount / summary.studentCount) * 100));
  });

  test('el total de alumnos coincide con las inscripciones activas del ciclo en la base', () => {
    const real = db.prepare(`SELECT count(*) AS n FROM group_enrollments e JOIN groups g ON g.id = e.group_id
      WHERE e.status = 'active' AND g.school_year = ?`).get(DEMO.currentGroup.schoolYear).n;
    assert.equal(body.data.summary.studentCount, real);
    const demo = body.data.groups.find((g) => g.name === '3.º A');
    assert.equal(demo.studentCount, 45);
  });

  test('distribución por campo suma el total de alumnos; evaluados por habilidad nunca exceden el total', () => {
    const { fields, skills, summary } = body.data;
    for (const f of fields.filter((x) => x.assessed)) {
      const total = Object.values(f.distribution).reduce((n, v) => n + v, 0);
      assert.equal(total, summary.studentCount, f.code);
      assert.equal(f.evaluatedCount, summary.studentCount - f.distribution.not_evaluated, f.code);
      assert.equal(f.needsSupportCount, f.distribution.needs_support, f.code);
    }
    for (const s of skills) {
      assert.ok(s.evaluatedCount <= summary.studentCount, s.code);
      assert.ok(s.needsSupportCount <= s.evaluatedCount, s.code);
      if (s.average != null) assert.ok(s.average >= 0 && s.average <= 100, s.code);
    }
  });

  test('cada etiqueta en "nivel + %" usa la escala de 25 %', () => {
    const check = (x, where) => {
      if (x.average == null) return assert.equal(x.level ?? null, null, where);
      assert.equal(x.level, lvl(x.average), `${where}: ${x.average}`);
    };
    body.data.skills.forEach((s) => check(s, `skill ${s.code}`));
    body.data.fields.forEach((f) => check(f, `field ${f.code}`));
    body.data.groups.forEach((g) => g.skills.forEach((s) => check(s, `${g.name} ${s.code}`)));
  });

  test('typicalErrors: groupCount ≤ grupos del ciclo y el conteo no supera a los alumnos evaluados', () => {
    const { typicalErrors, groups, summary } = body.data;
    assert.ok(typicalErrors.length > 0 && typicalErrors.length <= 5);
    for (const e of typicalErrors) {
      assert.ok(e.groupCount >= 1 && e.groupCount <= groups.length, e.errorTag);
      assert.ok(e.studentCount <= summary.evaluatedStudentCount, e.errorTag);
    }
  });

  test('typicalErrors.studentCount = alumnos distintos con esa etiqueta (sin doble conteo por explicación)', () => {
    const distinct = db.prepare(`SELECT count(DISTINCT t.student_id) AS n FROM student_responses r
      JOIN assignment_targets t ON t.id = r.assignment_target_id JOIN assignments a ON a.id = t.assignment_id
      JOIN groups g ON g.id = a.group_id JOIN questions q ON q.id = r.question_id JOIN skills sk ON sk.id = q.skill_id
      WHERE g.school_year = ? AND r.outcome_status = 'incorrect' AND r.error_tag = ? AND sk.code = ?
        AND t.status IN ('completed_screen', 'completed_paper')
        AND EXISTS (SELECT 1 FROM group_enrollments e WHERE e.group_id = g.id AND e.student_id = t.student_id AND e.status = 'active')`);
    for (const e of body.data.typicalErrors) {
      assert.equal(e.studentCount, distinct.get(DEMO.currentGroup.schoolYear, e.errorTag, e.skillCode).n,
        `${e.skillCode}|${e.errorTag}`);
    }
  });

  test('con los 7 grupos no expone nombres, folios, ids de alumnos ni hashes', () => {
    const raw = JSON.stringify(body);
    assert.doesNotMatch(raw, /internal_?folio|password|hash|curp|"students?"|"studentIds?"|student_id|"firstNames?"|"lastNames?"|"initials"|avatar/i);
    const students = db.prepare('SELECT id, internal_folio, first_names, last_names FROM students').all();
    assert.ok(students.length > 200);
    for (const s of students) {
      assert.ok(!raw.includes(s.internal_folio), `folio ${s.internal_folio}`);
      assert.ok(!raw.includes(`${s.first_names} ${s.last_names}`), 'nombre completo de alumno');
      assert.ok(!raw.includes(s.last_names), `apellidos de alumno: ${s.last_names}`);
    }
    // Ningún id en la respuesta corresponde a un alumno: los únicos "id" son de escuela y grupos.
    const groupIds = new Set(db.prepare('SELECT id FROM groups').all().map((g) => g.id));
    for (const g of body.data.groups) assert.ok(groupIds.has(g.id));
    for (const p of body.data.priorities) for (const id of p.groupIds) assert.ok(groupIds.has(id), `groupIds de ${p.type}`);
    const teacherEmails = db.prepare("SELECT email FROM users WHERE role = 'teacher'").all();
    for (const { email } of teacherEmails) assert.ok(!raw.includes(email), 'no expone correos de docentes');
  });
});

describe('GET /api/v1/analytics/school · grupo vacío y ciclo anterior', () => {
  let db;
  let api;
  let token;

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    const { school_id: schoolId, id: teacherId } = db.prepare('SELECT school_id, id FROM users WHERE email = ?').get(DEMO.teacher.email);
    db.prepare("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 6, 'Z', ?, 'VACIO1')")
      .run(schoolId, teacherId, DEMO.currentGroup.schoolYear);
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
    token = (await api.call('POST', '/api/v1/auth/quick-login/director')).body.data.token;
  });

  after(async () => {
    await api.close();
    db.close();
  });

  test('un grupo sin alumnos aparece con 0 % y no rompe el panel', async () => {
    const { status, body } = await api.call('GET', '/api/v1/analytics/school', { token });
    assert.equal(status, 200);
    const empty = body.data.groups.find((g) => g.name === '6.º Z');
    assert.ok(empty);
    assert.equal(empty.studentCount, 0);
    assert.equal(empty.evidencePercentage, 0);
    assert.equal(empty.prioritySkill, null);
    assert.ok(!body.data.priorities.some((p) => p.type === 'evidence' && p.groupIds.includes(empty.id)));
    assert.ok(!body.data.priorities.some((p) => p.type === 'group_support' && p.groupIds.includes(empty.id)));
    assert.equal(body.data.summary.groupCount, 8);
  });

  test('los grupos de ciclos anteriores (1.º y 2.º de la alumna con historial) no se cuentan', async () => {
    const { body } = await api.call('GET', '/api/v1/analytics/school', { token });
    const old = db.prepare('SELECT count(*) AS n FROM groups WHERE school_year <> ?').get(DEMO.currentGroup.schoolYear).n;
    assert.ok(old >= 2, 'el seed tiene grupos de ciclos anteriores');
    assert.ok(body.data.groups.every((g) => g.schoolYear === DEMO.currentGroup.schoolYear));
  });
});
