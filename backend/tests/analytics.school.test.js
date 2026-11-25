/**
 * Panel de la escuela para Dirección: dominio puro (campos formativos SEP, prioridades)
 * y `GET /api/v1/analytics/school` sobre el seed real en :memory:.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import {
  CTE_SESSIONS, MAX_PRIORITIES, lastFridayOfMonth, nextCteSession, SEP_FORMATIVE_FIELDS, buildSchoolPriorities, mapSkillsToFields, mergeTypicalErrors, summarizeFields,
  summarizeSchool, summarizeSchoolGroup,
} from '../src/modules/analytics/analytics.school.domain.js';
import { configWith, silentLogger, startServer } from './helpers.js';

const SKILLS = [
  { code: 'fractions', name: 'Fracciones' },
  { code: 'reading_comprehension', name: 'Comprensión lectora' },
];
const FIELD_SKILLS = mapSkillsToFields([
  { skill_code: 'fractions', formative_field: 'saberes_pensamiento_cientifico' },
  { skill_code: 'reading_comprehension', formative_field: 'lenguajes' },
  { skill_code: 'fractions', formative_field: 'saberes_pensamiento_cientifico' },
]);
const student = (fractions, reading) => ({ skills: [
  { code: 'fractions', masteryPercentage: fractions, level: fractions == null ? null : fractions < 25 ? 'needs_support' : 'achieved' },
  { code: 'reading_comprehension', masteryPercentage: reading, level: reading == null ? null : reading < 25 ? 'needs_support' : 'achieved' },
] });
const PUNITIVE = /reprobad|malo|deficiente|\bbaj[oa]s?\b|ranking/i;

describe('analytics.school.domain', () => {
  test('los 4 campos formativos SEP salen en orden oficial', () => {
    assert.deepEqual(SEP_FORMATIVE_FIELDS.map((f) => f.code),
      ['lenguajes', 'saberes_pensamiento_cientifico', 'etica_naturaleza_sociedades', 'de_lo_humano_comunitario']);
  });

  test('mapSkillsToFields no duplica habilidades', () => {
    assert.deepEqual(FIELD_SKILLS.saberes_pensamiento_cientifico, ['fractions']);
    assert.deepEqual(FIELD_SKILLS.etica_naturaleza_sociedades, []);
  });

  test('un campo sin habilidades no se reporta como 0 %', () => {
    const fields = summarizeFields([student(80, 20)], FIELD_SKILLS, SKILLS);
    const etica = fields.find((f) => f.code === 'etica_naturaleza_sociedades');
    assert.equal(etica.assessed, false);
    assert.equal(etica.average, null);
  });

  test('promedio y distribución por campo ignoran alumnos sin dato', () => {
    const fields = summarizeFields([student(80, 20), student(null, 60), student(null, null)], FIELD_SKILLS, SKILLS);
    const saberes = fields.find((f) => f.code === 'saberes_pensamiento_cientifico');
    assert.equal(saberes.average, 80);
    assert.equal(saberes.label, 'Dominado');
    assert.equal(saberes.evaluatedCount, 1);
    assert.equal(saberes.distribution.not_evaluated, 2);
    const lenguajes = fields.find((f) => f.code === 'lenguajes');
    assert.equal(lenguajes.average, 40);
    assert.equal(lenguajes.needsSupportCount, 1);
  });

  test('resumen de grupo, escuela y prioridades', () => {
    const coverage = { coveragePercentage: 10 };
    const a = summarizeSchoolGroup({ id: 1, grade: 3, section: 'A', schoolYear: '2026-2027', teacherName: 'Mtra. X' },
      [student(10, 60), student(20, 70)], SKILLS, FIELD_SKILLS, coverage);
    const b = summarizeSchoolGroup({ id: 2, grade: 4, section: 'A', schoolYear: '2026-2027', teacherName: null },
      [student(null, null), student(null, null), student(90, null)], SKILLS, FIELD_SKILLS, { coveragePercentage: 50 });
    assert.equal(a.name, '3.º A');
    assert.equal(a.needsSupportCount, 2);
    assert.equal(a.prioritySkill.code, 'fractions');
    assert.equal(b.evidencePercentage, 33.33);

    const school = summarizeSchool([a, b], [10, null]);
    assert.equal(school.studentCount, 5);
    assert.equal(school.teacherCount, 1);
    assert.equal(school.coveragePercentage, 30);

    const priorities = buildSchoolPriorities([a, b], [
      { code: 'fractions', name: 'Fracciones', average: 40, label: 'En proceso', needsSupportCount: 2 },
      { code: 'reading_comprehension', name: 'Comprensión lectora', average: 65, label: 'Logrado', needsSupportCount: 0 },
    ]);
    // Máximo 3 prioridades del mes, en orden: diagnóstico, habilidad, acompañamiento (el temario queda fuera).
    assert.deepEqual(priorities.map((p) => p.type), ['evidence', 'skill', 'group_support']);
    for (const p of priorities) {
      assert.ok(p.title.length <= 60, `título corto: ${p.title}`);
      assert.ok(`${p.detail} ${p.action}`.length <= 140, `detalle conciso: ${p.detail} ${p.action}`);
    }
    assert.deepEqual(priorities[0].groupIds, [2]);
    assert.deepEqual(priorities[1].groupIds, [1]);
    for (const p of priorities) assert.doesNotMatch(`${p.title} ${p.detail} ${p.action}`, PUNITIVE);
  });

  test('mergeTypicalErrors suma alumnos entre grupos y ordena', () => {
    const merged = mergeTypicalErrors([
      [{ skillCode: 'fractions', errorTag: 'x', explanation: 'X', studentCount: 3 }],
      [{ skillCode: 'fractions', errorTag: 'x', explanation: 'X', studentCount: 4 },
        { skillCode: 'fractions', errorTag: 'x', explanation: 'X de otro grado', studentCount: 0 },
        { skillCode: 'reading_comprehension', errorTag: 'y', explanation: 'Y', studentCount: 5 }],
    ], SKILLS);
    assert.deepEqual(merged.map((e) => [e.errorTag, e.studentCount, e.groupCount]), [['x', 7, 2], ['y', 5, 1]]);
    assert.equal(merged[0].skillName, 'Fracciones');
  });
});

describe('Consejo Técnico Escolar', () => {
  test('las sesiones 2026-2027 son el último viernes de su mes (sin diciembre ni abril)', () => {
    for (const iso of CTE_SESSIONS['2026-2027']) {
      const [y, m] = iso.split('-').map(Number);
      assert.equal(lastFridayOfMonth(y, m - 1), iso);
    }
    assert.ok(!CTE_SESSIONS['2026-2027'].some((iso) => /-(12|04)-/.test(iso)));
  });

  test('próxima sesión según el calendario oficial', () => {
    assert.deepEqual(nextCteSession('2026-11-24', '2026-2027'),
      { date: '2026-11-27', label: 'viernes 27 de noviembre de 2026', month: 'noviembre 2026', daysUntil: 3, source: 'calendar' });
    assert.equal(nextCteSession('2026-11-27', '2026-2027').daysUntil, 0);
    // Sin sesión en diciembre: después del 27 de noviembre sigue el 29 de enero.
    assert.equal(nextCteSession('2026-11-28', '2026-2027').date, '2027-01-29');
    assert.equal(nextCteSession('2027-03-27', '2026-2027').date, '2027-05-28');
  });

  test('sin calendario cargado se estima con el último viernes del mes', () => {
    const next = nextCteSession('2027-10-05', '2027-2028');
    assert.equal(next.source, 'rule');
    assert.equal(next.date, '2027-10-29');
    // Diciembre, julio y agosto no tienen sesión ordinaria (el 31/12/2027 es viernes, pero son vacaciones).
    assert.equal(nextCteSession('2027-12-31', '2027-2028').date, '2028-01-28');
    assert.equal(nextCteSession('2028-07-03', '2027-2028').date, '2028-09-29');
    assert.equal(nextCteSession('2026-07-01', '2026-2027').date, '2026-09-25');
  });

  test('máximo de prioridades del mes', () => {
    assert.equal(MAX_PRIORITIES, 3);
  });
});

describe('GET /api/v1/analytics/school', () => {
  let db;
  let api;
  const login = async (email, password) =>
    (await api.call('POST', '/api/v1/auth/login', { body: { email, password } })).body.data.token;

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    const other = Number(db.prepare("INSERT INTO schools (name) VALUES ('Escuela Ajena')").run().lastInsertRowid);
    db.prepare("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, 'dir-ajeno@axi.test', ?, 'Mtro. Ajeno', 'director')")
      .run(other, bcrypt.hashSync('OtraClave2026', 4));
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });

  after(async () => {
    await api.close();
    db.close();
  });

  test('el director recibe agregados reales de su escuela, sin datos personales', async () => {
    const token = (await api.call('POST', '/api/v1/auth/quick-login/director')).body.data.token;
    const { status, body } = await api.call('GET', '/api/v1/analytics/school', { token });
    assert.equal(status, 200);
    const { school, summary, fields, groups, priorities } = body.data;
    assert.equal(school.name, DEMO.schoolName);
    assert.equal(school.schoolYear, DEMO.currentGroup.schoolYear);
    assert.equal(groups.length, 7, 'solo los grupos del ciclo actual');
    assert.deepEqual(groups.map((g) => g.name), ['1.º A', '2.º A', '3.º A', '3.º B', '4.º A', '5.º A', '6.º A']);
    assert.equal(summary.studentCount, groups.reduce((n, g) => n + g.studentCount, 0));
    assert.equal(summary.teacherCount, 7);
    assert.ok(priorities.some((p) => p.type === 'evidence'), '6.º A tiene poco diagnóstico');

    // Solo habilidades del programa de cada grado: sin fracciones en 1.º y 2.º, sin multiplicación en 1.º.
    const byName = Object.fromEntries(groups.map((g) => [g.name, g]));
    assert.deepEqual(byName['1.º A'].skills.map((s) => s.code).sort(), ['place_value', 'problem_solving', 'reading_comprehension']);
    assert.ok(!byName['2.º A'].skills.some((s) => s.code === 'fractions'));
    assert.ok(byName['3.º B'].skills.some((s) => s.code === 'fractions'));
    for (const g of groups) {
      if (g.prioritySkill) assert.ok(g.skills.some((s) => s.code === g.prioritySkill.code), g.name);
    }
    // 3.º A aún no tiene la prueba de fracciones (papel pendiente): no usa cortes de 1.º y 2.º.
    assert.equal(byName['3.º A'].skills.find((s) => s.code === 'fractions').average, null);
    const skillPriority = priorities.find((p) => p.type === 'skill');
    if (skillPriority?.skillCode === 'fractions') assert.match(skillPriority.title, /3\.º a 6\.º/);
    assert.ok(body.data.skills.every((s) => typeof s.grades === 'string'));
    assert.ok(Array.isArray(body.data.teachers) && body.data.teachers.length === 7);
    assert.equal(fields.length, 4);
    assert.equal(fields.find((f) => f.code === 'lenguajes').assessed, true);
    assert.equal(fields.find((f) => f.code === 'de_lo_humano_comunitario').assessed, false);
    assert.ok(priorities.length > 0);

    const raw = JSON.stringify(body);
    assert.doesNotMatch(raw, /internal_?folio|password|AXI-[A-Z0-9]{8}/i);
    const names = db.prepare('SELECT first_names, last_names FROM students LIMIT 5').all();
    for (const n of names) assert.ok(!raw.includes(`${n.first_names} ${n.last_names}`), 'no incluye nombres de alumnos');
  });

  test('un director de otra escuela no ve los grupos de la escuela demo', async () => {
    const token = await login('dir-ajeno@axi.test', 'OtraClave2026');
    const { status, body } = await api.call('GET', '/api/v1/analytics/school', { token });
    assert.equal(status, 200);
    assert.equal(body.data.school.name, 'Escuela Ajena');
    assert.equal(body.data.groups.length, 0);
    assert.equal(body.data.summary.studentCount, 0);
  });

  test('el director exporta el panel en PDF Carta (sin datos de alumnos)', async () => {
    const token = (await api.call('POST', '/api/v1/auth/quick-login/director')).body.data.token;
    const res = await fetch(`${api.base}/api/v1/analytics/school/export.pdf`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), /panel-escuela-2026-2027\.pdf/);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.match(bytes.toString('latin1'), /MediaBox \[0 0 612 792\]/);
  });

  test('docente y alumno reciben 403; sin sesión, 401', async () => {
    const teacher = (await api.call('POST', '/api/v1/auth/quick-login/teacher')).body.data.token;
    const studentToken = (await api.call('POST', '/api/v1/auth/quick-login/student')).body.data.token;
    assert.equal((await api.call('GET', '/api/v1/analytics/school', { token: teacher })).status, 403);
    assert.equal((await api.call('GET', '/api/v1/analytics/school', { token: studentToken })).status, 403);
    assert.equal((await api.call('GET', '/api/v1/analytics/school')).status, 401);
    const pdf = (token) => fetch(`${api.base}/api/v1/analytics/school/export.pdf`, token ? { headers: { authorization: `Bearer ${token}` } } : {});
    assert.equal((await pdf(teacher)).status, 403);
    assert.equal((await pdf()).status, 401);
  });
});
