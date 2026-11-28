import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { parseStudentPatch, studentHasHistory } from '../src/modules/groups/groups.domain.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * 3.º A de la docente A. Sofía tiene historial (una respuesta y un corte); Mateo no tiene nada;
 * Lucía fue alumna de 2.º en otro grupo (historial de otro grado); Diego es para la baja.
 * La docente B tiene 4.º B. Datos ficticios.
 */
function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const school = id("INSERT INTO schools (name) VALUES ('Escuela A')");
  const user = (email, role) =>
    id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, 'x', 'Persona Demo', ?)", school, email, role);
  const teacherA = user('a@axi.test', 'teacher');
  const teacherB = user('b@axi.test', 'teacher');
  const director = user('dir@axi.test', 'director');
  const group = (teacher, grade, section, year, code) =>
    id('INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, ?, ?, ?, ?)', school, teacher, grade, section, year, code);
  const groupA = group(teacherA, 3, 'A', '2026-2027', 'EDIT3A');
  const groupB = group(teacherB, 4, 'B', '2026-2027', 'EDIT4B');
  const groupPrev = group(teacherB, 2, 'A', '2025-2026', 'PREV2A');

  const student = (first, last, initials, folio) =>
    id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, '#F4B6C2')", school, folio, first, last, initials);
  const enroll = (g, s, status = 'active') => db.prepare('INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, ?)').run(g, s, status);
  const sofia = student('Sofía', 'Ramírez García', 'SR', 'AXI-AAAAAAAA');
  const mateo = student('Mateo', 'Hernández López', 'MH', 'AXI-BBBBBBBB');
  const lucia = student('Lucía', 'Torres Vega', 'LT', 'AXI-CCCCCCCC');
  const diego = student('Diego', 'Cruz Pérez', 'DC', 'AXI-DDDDDDDD');
  for (const s of [sofia, mateo, lucia, diego]) enroll(groupA, s);
  enroll(groupPrev, lucia, 'completed');

  // Historial de Sofía: una prueba con una respuesta y un corte de dominio.
  const skill = id("INSERT INTO skills (code, name) VALUES ('fractions', 'Fracciones')");
  const q = id("INSERT INTO questions (skill_id, grade, stem, hint_1, hint_2, hint_3) VALUES (?, 3, 'R', 'P1', 'P2', 'P3')", skill);
  const opt = id("INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'A', 'Bien', 1)", q);
  const a = id("INSERT INTO assignments (group_id, created_by, title, modality) VALUES (?, ?, 'Prueba', 'screen')", groupA, teacherA);
  db.prepare('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, 1)').run(a, q);
  const target = id("INSERT INTO assignment_targets (assignment_id, student_id, status) VALUES (?, ?, 'completed_screen')", a, sofia);
  db.prepare("INSERT INTO student_responses (assignment_target_id, question_id, selected_option_id, outcome_status, source) VALUES (?, ?, ?, 'correct_autonomous', 'screen')").run(target, q, opt);
  db.prepare(`INSERT INTO skill_mastery_history (student_id, skill_id, assignment_id, grade, session_index, session_percentage,
    autonomous_percentage, supported_percentage, mastery_percentage, mastery_level) VALUES (?, ?, ?, 3, 1, 100, 100, 0, 100, 'mastered')`).run(sofia, skill, a);
  // Mateo tiene una prueba asignada pendiente (sin respuestas): eso no cuenta como historial.
  db.prepare("INSERT INTO assignment_targets (assignment_id, student_id, status) VALUES (?, ?, 'pending')").run(a, mateo);

  const staff = (sub, role) => tokenFor({ sub: String(sub), role, schoolId: school });
  return {
    db,
    ids: { groupA, groupB, sofia, mateo, lucia, diego },
    tokens: {
      teacherA: staff(teacherA, 'teacher'),
      teacherB: staff(teacherB, 'teacher'),
      director: staff(director, 'director'),
      sofia: tokenFor({ sub: String(sofia), role: 'student', schoolId: school, groupId: groupA }),
      diego: tokenFor({ sub: String(diego), role: 'student', schoolId: school, groupId: groupA }),
    },
  };
}

describe('parseStudentPatch', () => {
  test('normaliza los campos enviados y exige al menos uno', () => {
    assert.deepEqual(parseStudentPatch({ firstNames: '  sofía  ' }), { firstNames: 'Sofía' });
    assert.deepEqual(parseStudentPatch({ firstNames: 'Ana María', lastNames: 'López Díaz' }), { firstNames: 'Ana María', lastNames: 'López Díaz' });
    for (const body of [{}, null, [], { firstNames: '' }, { lastNames: 123 }, { firstNames: 'Ana2' }]) {
      assert.throws(() => parseStudentPatch(body), (e) => e.code === 'VALIDATION_ERROR', JSON.stringify(body));
    }
  });

  test('studentHasHistory: cualquier dato cuenta', () => {
    const none = { responses: 0, masteryCuts: 0, achievements: 0, hintRequests: 0, tutoringPairs: 0, otherEnrollments: 0 };
    assert.equal(studentHasHistory(none), false);
    assert.equal(studentHasHistory({ ...none, otherEnrollments: 1 }), true);
  });
});

describe('editar, dar de baja y eliminar alumnos', () => {
  let server;
  let db;
  let ids;
  let tokens;
  const path = (sid, extra = '') => `/api/v1/groups/${ids.groupA}/students/${sid}${extra}`;
  const enrollment = (sid) => db.prepare('SELECT status, ended_at FROM group_enrollments WHERE group_id = ? AND student_id = ?').get(ids.groupA, sid);
  // node:sqlite devuelve objetos sin prototipo: se copian para compararlos con deepEqual.
  const studentRow = (sid) => ({ ...db.prepare('SELECT first_names, last_names, initials FROM students WHERE id = ?').get(sid) });

  before(async () => {
    const fx = createFixtures();
    ({ db, ids, tokens } = fx);
    server = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });
  after(() => server.close());

  test('corregir el nombre recalcula las iniciales; el folio no se toca', async () => {
    const res = await server.call('PATCH', path(ids.sofia), { token: tokens.teacherA, body: { firstNames: 'sofia elena', lastNames: 'ramírez garcía' } });
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.data.firstNames, res.body.data.lastNames, res.body.data.initials], ['Sofia Elena', 'Ramírez García', 'SR']);
    assert.equal(JSON.stringify(res.body).includes('AXI-'), false);

    const onlyLast = await server.call('PATCH', path(ids.sofia), { token: tokens.teacherA, body: { lastNames: 'Gómez' } });
    assert.deepEqual([onlyLast.body.data.firstNames, onlyLast.body.data.initials], ['Sofia Elena', 'SG']);
    assert.deepEqual(studentRow(ids.sofia), { first_names: 'Sofia Elena', last_names: 'Gómez', initials: 'SG' });
  });

  test('datos inválidos → 400 sin cambios', async () => {
    const res = await server.call('PATCH', path(ids.mateo), { token: tokens.teacherA, body: { firstNames: '123' } });
    assert.equal(res.status, 400);
    assert.equal(studentRow(ids.mateo).first_names, 'Mateo');
  });

  test('dar de baja conserva el historial y lo saca de la lista y del acceso', async () => {
    const res = await server.call('POST', path(ids.diego, '/withdraw'), { token: tokens.teacherA });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { studentId: ids.diego, groupId: ids.groupA, status: 'withdrawn' });
    assert.equal(enrollment(ids.diego).status, 'withdrawn');
    assert.ok(enrollment(ids.diego).ended_at);
    assert.ok(db.prepare('SELECT 1 FROM students WHERE id = ?').get(ids.diego), 'el alumno sigue existiendo');

    const list = await server.call('GET', `/api/v1/groups/${ids.groupA}/students`, { token: tokens.teacherA });
    assert.ok(!list.body.data.some((s) => s.id === ids.diego));
    // Su sesión de alumno deja de servir (ya no está activo en el grupo).
    const portal = await server.call('GET', `/api/v1/diagnostics/students/${ids.diego}/assignments`, { token: tokens.diego });
    assert.equal(portal.status, 404);
    // Ya dado de baja: cualquier otra acción responde 404.
    assert.equal((await server.call('POST', path(ids.diego, '/withdraw'), { token: tokens.teacherA })).status, 404);
  });

  test('eliminar con historial → 409 con el detalle; sin cambios', async () => {
    const res = await server.call('DELETE', path(ids.sofia), { token: tokens.teacherA });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'STUDENT_HAS_HISTORY');
    assert.equal(res.body.error.details.responses, 1);
    assert.equal(res.body.error.details.masteryCuts, 1);
    assert.equal(enrollment(ids.sofia).status, 'active');

    // Historial de otro grado (inscripción anterior) también lo protege.
    const lucia = await server.call('DELETE', path(ids.lucia), { token: tokens.teacherA });
    assert.equal(lucia.status, 409);
    assert.equal(lucia.body.error.details.otherEnrollments, 1);
  });

  test('eliminar un alumno creado por error (sin datos) lo borra por completo', async () => {
    const res = await server.call('DELETE', path(ids.mateo), { token: tokens.teacherA });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { studentId: ids.mateo, deleted: true });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM students WHERE id = ?').get(ids.mateo).n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assignment_targets WHERE student_id = ?').get(ids.mateo).n, 0);
  });

  test('un id eliminado no se reutiliza: la sesión vieja no entra como el alumno nuevo (#47, P1)', async () => {
    const school = db.prepare('SELECT school_id FROM groups WHERE id = ?').get(ids.groupA).school_id;
    const studentToken = (id) => tokenFor({ sub: String(id), role: 'student', schoolId: school, groupId: ids.groupA });
    const add = async (firstNames) => {
      const res = await server.call('POST', `/api/v1/groups/${ids.groupA}/students`, { token: tokens.teacherA, body: { firstNames, lastNames: 'Prueba Demo' } });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      return db.prepare('SELECT MAX(id) AS id FROM students').get().id;
    };
    // Ana es la alumna con el id más alto: el caso en que SQLite reutilizaría su id.
    const ana = await add('Ana');
    const anaToken = studentToken(ana);
    assert.equal((await server.call('GET', '/api/v1/auth/me', { token: anaToken })).status, 200);
    assert.equal((await server.call('DELETE', path(ana), { token: tokens.teacherA })).status, 200);

    const beatriz = await add('Beatriz');
    assert.ok(beatriz > ana, `Beatriz recibió un id nuevo (${beatriz}), no el de Ana (${ana})`);
    // El token de Ana ya no sirve para nada ni identifica a Beatriz.
    const me = await server.call('GET', '/api/v1/auth/me', { token: anaToken });
    assert.equal(me.status, 401);
    assert.notEqual(me.body?.data?.student?.displayName, 'Beatriz P.');
    assert.equal((await server.call('GET', `/api/v1/diagnostics/students/${ana}/assignments`, { token: anaToken })).status, 404);
    // Beatriz sí entra con su propio id.
    assert.equal((await server.call('GET', '/api/v1/auth/me', { token: studentToken(beatriz) })).status, 200);

    // Red de seguridad en la base: insertar un alumno con un id eliminado se rechaza.
    assert.throws(
      () => db.prepare("INSERT INTO students (id, school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, 'AXI-ZZZZZZZZ', 'X', 'Y', 'XY', '#FFFFFF')").run(ana, school),
      /STUDENT_ID_REUSED/,
    );
  });

  test('permisos: otra docente 404, director y alumno 403, sin sesión 401', async () => {
    for (const [method, extra, body] of [['PATCH', '', { firstNames: 'Ana' }], ['POST', '/withdraw'], ['DELETE', '']]) {
      assert.equal((await server.call(method, path(ids.sofia, extra), { token: tokens.teacherB, body })).status, 404, `${method} docente B`);
      assert.equal((await server.call(method, path(ids.sofia, extra), { token: tokens.director, body })).status, 403, `${method} director`);
      assert.equal((await server.call(method, path(ids.sofia, extra), { token: tokens.sofia, body })).status, 403, `${method} alumno`);
      assert.equal((await server.call(method, path(ids.sofia, extra), { body })).status, 401, `${method} sin sesión`);
    }
    // Alumno que no es del grupo, o id inválido.
    assert.equal((await server.call('PATCH', path(999999), { token: tokens.teacherA, body: { firstNames: 'Ana' } })).status, 404);
    assert.equal((await server.call('PATCH', path('abc'), { token: tokens.teacherA, body: { firstNames: 'Ana' } })).status, 400);
  });
});
