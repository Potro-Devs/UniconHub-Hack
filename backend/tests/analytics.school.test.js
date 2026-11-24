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
  SEP_FORMATIVE_FIELDS, buildSchoolPriorities, mapSkillsToFields, mergeTypicalErrors, summarizeFields,
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

    const school = summarizeSchool([a, b]);
    assert.equal(school.studentCount, 5);
    assert.equal(school.teacherCount, 1);
    assert.equal(school.coveragePercentage, 30);

    const priorities = buildSchoolPriorities([a, b], [
      { code: 'fractions', name: 'Fracciones', average: 40, label: 'En proceso', needsSupportCount: 2 },
      { code: 'reading_comprehension', name: 'Comprensión lectora', average: 65, label: 'Logrado', needsSupportCount: 0 },
    ]);
    assert.deepEqual(priorities.map((p) => p.type), ['evidence', 'skill', 'group_support', 'coverage']);
    assert.deepEqual(priorities[0].groupIds, [2]);
    assert.deepEqual(priorities[1].groupIds, [1]);
    for (const p of priorities) assert.doesNotMatch(`${p.title} ${p.detail} ${p.action}`, PUNITIVE);
  });

  test('mergeTypicalErrors suma alumnos entre grupos y ordena', () => {
    const merged = mergeTypicalErrors([
      [{ skillCode: 'fractions', errorTag: 'x', explanation: 'X', studentCount: 3 }],
      [{ skillCode: 'fractions', errorTag: 'x', explanation: 'X', studentCount: 4 },
        { skillCode: 'reading_comprehension', errorTag: 'y', explanation: 'Y', studentCount: 5 }],
    ], SKILLS);
    assert.deepEqual(merged.map((e) => [e.errorTag, e.studentCount, e.groupCount]), [['x', 7, 2], ['y', 5, 1]]);
    assert.equal(merged[0].skillName, 'Fracciones');
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
    assert.equal(groups.length, 1, 'solo los grupos del ciclo actual');
    assert.equal(groups[0].name, '3.º A');
    assert.equal(summary.studentCount, 45);
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

  test('docente y alumno reciben 403; sin sesión, 401', async () => {
    const teacher = (await api.call('POST', '/api/v1/auth/quick-login/teacher')).body.data.token;
    const studentToken = (await api.call('POST', '/api/v1/auth/quick-login/student')).body.data.token;
    assert.equal((await api.call('GET', '/api/v1/analytics/school', { token: teacher })).status, 403);
    assert.equal((await api.call('GET', '/api/v1/analytics/school', { token: studentToken })).status, 403);
    assert.equal((await api.call('GET', '/api/v1/analytics/school')).status, 401);
  });
});
