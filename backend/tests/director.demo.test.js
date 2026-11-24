/**
 * Director demo de punta a punta sobre el seed real (SQLite :memory:):
 * acceso rápido y login normal → lectura de su escuela, escritura bloqueada (403)
 * y aislamiento frente a un director de otra escuela. Datos ficticios.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { configWith, silentLogger, startServer } from './helpers.js';

const FORBIDDEN_KEYS = ['internal_folio', 'internalFolio', 'password_hash', 'passwordHash', 'curp', 'CURP'];

/** Busca claves prohibidas en cualquier nivel de la respuesta. */
function findForbiddenKeys(value, path = '$') {
  if (Array.isArray(value)) return value.flatMap((v, i) => findForbiddenKeys(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(FORBIDDEN_KEYS.includes(k) ? [`${path}.${k}`] : []),
      ...findForbiddenKeys(v, `${path}.${k}`),
    ]);
  }
  return [];
}

describe('director demo (seed + acceso rápido)', () => {
  let db;
  let api;
  let token;
  let groupId;
  let studentId;
  let contentId;
  let schoolGroupIds;

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);

    // Segunda escuela con su director (ficticio) para probar aislamiento.
    const otherSchool = Number(db.prepare("INSERT INTO schools (name) VALUES ('Escuela Ajena')").run().lastInsertRowid);
    db.prepare("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, 'dir-ajeno@axi.test', ?, 'Mtro. Ajeno', 'director')")
      .run(otherSchool, bcrypt.hashSync('OtraClave2026', 4));

    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
    const res = await api.call('POST', '/api/v1/auth/quick-login/director');
    assert.equal(res.status, 200);
    token = res.body.data.token;

    const demoSchool = db.prepare('SELECT school_id FROM users WHERE email = ?').get(DEMO.teacher.email).school_id;
    schoolGroupIds = db.prepare('SELECT id FROM groups WHERE school_id = ? ORDER BY id').all(demoSchool).map((r) => r.id);
    groupId = db.prepare('SELECT id FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode).id;
    studentId = db.prepare("SELECT student_id FROM group_enrollments WHERE group_id = ? AND status = 'active' LIMIT 1").get(groupId).student_id;
    contentId = db.prepare('SELECT content_id FROM group_curriculum_progress WHERE group_id = ? LIMIT 1').get(groupId)?.content_id
      ?? db.prepare('SELECT id FROM curriculum_contents LIMIT 1').get().id;
  });

  after(async () => {
    await api?.close();
    db?.close();
  });

  test('la sesión de acceso rápido es del director demo y /auth/me lo confirma sin datos sensibles', async () => {
    const me = await api.call('GET', '/api/v1/auth/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.role, 'director');
    assert.deepEqual(findForbiddenKeys(me.body), []);
  });

  test('login normal con correo y contraseña del director demo', async () => {
    const res = await api.call('POST', '/api/v1/auth/login', {
      body: { email: DEMO.director.email, password: DEMO.director.password },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'director');
    assert.equal(res.body.data.user.email, DEMO.director.email);
    assert.deepEqual(findForbiddenKeys(res.body), []);

    const bad = await api.call('POST', '/api/v1/auth/login', {
      body: { email: DEMO.director.email, password: 'NoEsLaClave1' },
    });
    assert.equal(bad.status, 401);
    assert.ok(bad.body.error?.code);
  });

  test('lee todos los grupos de su escuela (incluye los de la docente demo)', async () => {
    const res = await api.call('GET', '/api/v1/groups', { token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map((g) => g.id).sort((a, b) => a - b), schoolGroupIds);
    assert.ok(res.body.data.some((g) => g.id === groupId));
    assert.deepEqual(findForbiddenKeys(res.body), []);
  });

  test('lee detalle, alumnos, temario, cobertura, asignaciones, mapa, perfil e intervenciones', async () => {
    const reads = [
      `/api/v1/groups/${groupId}`,
      `/api/v1/groups/${groupId}/students`,
      `/api/v1/curriculum/groups/${groupId}`,
      `/api/v1/curriculum/groups/${groupId}/coverage`,
      `/api/v1/assessments/groups/${groupId}/assignments`,
      `/api/v1/analytics/groups/${groupId}`,
      `/api/v1/analytics/groups/${groupId}/students/${studentId}`,
      `/api/v1/interventions/groups/${groupId}`,
    ];
    for (const path of reads) {
      const res = await api.call('GET', path, { token });
      assert.equal(res.status, 200, `${path} → ${res.status} ${JSON.stringify(res.body.error)}`);
      assert.ok('data' in res.body, path);
      assert.deepEqual(findForbiddenKeys(res.body), [], path);
    }
    const students = await api.call('GET', `/api/v1/groups/${groupId}/students`, { token });
    assert.equal(students.body.data.length, 45);
  });

  test('toda escritura responde 403 y no cambia la base', async () => {
    const countGroups = () => db.prepare('SELECT count(*) AS n FROM groups').get().n;
    const countStudents = () => db.prepare('SELECT count(*) AS n FROM students').get().n;
    const countAssignments = () => db.prepare('SELECT count(*) AS n FROM assignments').get().n;
    const before = [countGroups(), countStudents(), countAssignments()];
    const anyQuestion = db.prepare('SELECT id FROM questions LIMIT 3').all().map((r) => r.id);

    const writes = [
      ['POST', '/api/v1/groups', { grade: 1, section: 'Z', schoolYear: '2026-2027' }],
      ['PATCH', `/api/v1/groups/${groupId}`, { section: 'Z' }],
      ['POST', `/api/v1/groups/${groupId}/students`, { firstNames: 'Ana', lastNames: 'Ruiz' }],
      ['POST', `/api/v1/groups/${groupId}/students/bulk`, { text: 'Ana Ruiz\nLuis Mora' }],
      ['PATCH', `/api/v1/groups/students/${studentId}/avatar`, { avatarId: 'rosa' }],
      ['POST', `/api/v1/assessments/groups/${groupId}/assignments`, { title: 'X', mode: 'screen', questionIds: anyQuestion }],
      ['PATCH', `/api/v1/curriculum/groups/${groupId}/contents/${contentId}`, { status: 'seen' }],
      ['POST', `/api/v1/interventions/groups/${groupId}`, { skillCode: 'fractions', note: 'x' }],
    ];
    for (const [method, path, body] of writes) {
      const res = await api.call(method, path, { token, body });
      assert.equal(res.status, 403, `${method} ${path} → ${res.status}`);
      assert.equal(typeof res.body.error?.code, 'string', path);
      assert.equal(typeof res.body.error?.message, 'string', path);
    }
    assert.deepEqual([countGroups(), countStudents(), countAssignments()], before);
  });

  test('no entra a rutas del portal del alumno (403)', async () => {
    const res = await api.call('GET', `/api/v1/diagnostics/students/${studentId}/assignments`, { token });
    assert.equal(res.status, 403);
  });

  test('un director de otra escuela no ve los grupos demo (lista vacía y 404)', async () => {
    const login = await api.call('POST', '/api/v1/auth/login', { body: { email: 'dir-ajeno@axi.test', password: 'OtraClave2026' } });
    assert.equal(login.status, 200);
    const other = login.body.data.token;
    const list = await api.call('GET', '/api/v1/groups', { token: other });
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data, []);
    for (const path of [
      `/api/v1/groups/${groupId}`,
      `/api/v1/groups/${groupId}/students`,
      `/api/v1/analytics/groups/${groupId}`,
      `/api/v1/analytics/groups/${groupId}/students/${studentId}`,
      `/api/v1/curriculum/groups/${groupId}`,
    ]) {
      const res = await api.call('GET', path, { token: other });
      assert.equal(res.status, 404, path);
    }
  });

  test('sin sesión las lecturas responden 401', async () => {
    const res = await api.call('GET', `/api/v1/groups/${groupId}`);
    assert.equal(res.status, 401);
    assert.equal(typeof res.body.error?.code, 'string');
  });
});

describe('director demo en una base sembrada antes de que existiera', () => {
  test('al volver a correr el seed, el director agregado entra por acceso rápido y por contraseña y ve su escuela', async () => {
    const db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    db.prepare('DELETE FROM users WHERE email = ?').run(DEMO.director.email);
    const api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
    try {
      const missing = await api.call('POST', '/api/v1/auth/quick-login/director');
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, 'DEMO_DATA_MISSING');

      assert.equal(runSeed(db).directorAdded, true);
      const teacherSchool = db.prepare('SELECT school_id FROM users WHERE email = ?').get(DEMO.teacher.email).school_id;

      const quick = await api.call('POST', '/api/v1/auth/quick-login/director');
      assert.equal(quick.status, 200);
      assert.equal(quick.body.data.user.schoolId, teacherSchool);
      const login = await api.call('POST', '/api/v1/auth/login', {
        body: { email: DEMO.director.email, password: DEMO.director.password },
      });
      assert.equal(login.status, 200);

      const groups = await api.call('GET', '/api/v1/groups', { token: quick.body.data.token });
      assert.ok(groups.body.data.some((g) => g.joinCode === DEMO.currentGroup.joinCode));
    } finally {
      await api.close();
      db.close();
    }
  });
});
