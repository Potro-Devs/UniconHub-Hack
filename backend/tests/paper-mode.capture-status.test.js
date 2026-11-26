import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * Escuela A: docente A (3.º A, con una prueba en papel y otra en pantalla), docente B (4.º B,
 * con una prueba en papel) y director A. Escuela B: director B.
 */
function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const schoolA = id("INSERT INTO schools (name) VALUES ('Escuela A')");
  const schoolB = id("INSERT INTO schools (name) VALUES ('Escuela B')");
  const user = (school, email, role) =>
    id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, 'x', 'Persona Demo', ?)", school, email, role);
  const teacherA = user(schoolA, 'a@axi.test', 'teacher');
  const teacherB = user(schoolA, 'b@axi.test', 'teacher');
  const directorA = user(schoolA, 'dir-a@axi.test', 'director');
  const directorB = user(schoolB, 'dir-b@axi.test', 'director');

  const group = (teacher, grade, section, code) =>
    id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, ?, ?, '2026-2027', ?)",
      schoolA, teacher, grade, section, code);
  const groupA = group(teacherA, 3, 'A', 'PAPE3A');
  const groupB = group(teacherB, 4, 'B', 'PAPE4B');

  const student = (first, last, folio) =>
    id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, 'XX', '#F4B6C2')",
      schoolA, folio, first, last);
  // Insertados fuera de orden alfabético para comprobar el orden de lista.
  const sofia = student('Sofía', 'Ramírez García', 'AXI-AAAAAAAA');
  const mateo = student('Mateo', 'Hernández López', 'AXI-BBBBBBBB');
  const ana = student('Ana', 'Zamora Ruiz', 'AXI-CCCCCCCC');
  for (const s of [sofia, mateo, ana]) {
    db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'active')").run(groupA, s);
  }

  const assignment = (g, teacher, modality) =>
    id("INSERT INTO assignments (group_id, created_by, title, modality) VALUES (?, ?, 'Prueba', ?)", g, teacher, modality);
  const paperA = assignment(groupA, teacherA, 'paper');
  const screenA = assignment(groupA, teacherA, 'screen');
  const paperB = assignment(groupB, teacherB, 'paper');

  const target = (a, s, status, locked) =>
    db.prepare('INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked) VALUES (?, ?, ?, ?)').run(a, s, status, locked);
  target(paperA, sofia, 'completed_paper', 1);
  target(paperA, mateo, 'pending', 1);
  target(paperA, ana, 'pending', 1);
  target(screenA, sofia, 'pending', 0);

  const staff = (sub, role, schoolId) => tokenFor({ sub: String(sub), role, schoolId });
  return {
    db,
    ids: { paperA, screenA, paperB, sofia, mateo, ana },
    tokens: {
      teacherA: staff(teacherA, 'teacher', schoolA),
      teacherB: staff(teacherB, 'teacher', schoolA),
      directorA: staff(directorA, 'director', schoolA),
      directorB: staff(directorB, 'director', schoolB),
      student: tokenFor({ sub: String(sofia), role: 'student', schoolId: schoolA, groupId: groupA }),
    },
  };
}

describe('GET /paper/assignments/:id/capture-status', () => {
  let server;
  let ids;
  let tokens;
  const path = (assignmentId) => `/api/v1/paper/assignments/${assignmentId}/capture-status`;

  before(async () => {
    const fx = createFixtures();
    ({ ids, tokens } = fx);
    server = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });
  after(() => server.close());

  test('docente dueño: conteos y destinatarios en orden de lista, sin nombres ni folio', async () => {
    const res = await server.call('GET', path(ids.paperA), { token: tokens.teacherA });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, {
      assignmentId: ids.paperA,
      total: 3,
      captured: 1,
      pending: 2,
      targets: [
        { studentId: ids.mateo, status: 'pending', isScreenLocked: true },
        { studentId: ids.sofia, status: 'completed_paper', isScreenLocked: true },
        { studentId: ids.ana, status: 'pending', isScreenLocked: true },
      ],
    });
    const raw = JSON.stringify(res.body);
    assert.doesNotMatch(raw, /AXI-|Sofía|Ramírez/);
  });

  test('director de la escuela puede leer', async () => {
    const res = await server.call('GET', path(ids.paperA), { token: tokens.directorA });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.total, 3);
  });

  test('ajena o inexistente → 404 con el mismo cuerpo', async () => {
    const otherTeacher = await server.call('GET', path(ids.paperA), { token: tokens.teacherB });
    const otherSchool = await server.call('GET', path(ids.paperA), { token: tokens.directorB });
    const missing = await server.call('GET', path(9999), { token: tokens.teacherA });
    for (const res of [otherTeacher, otherSchool, missing]) {
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, missing.body);
      assert.equal(res.body.error.code, 'ASSIGNMENT_NOT_FOUND');
    }
  });

  test('prueba de pantalla → 409 NOT_PAPER_ASSIGNMENT', async () => {
    const res = await server.call('GET', path(ids.screenA), { token: tokens.teacherA });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'NOT_PAPER_ASSIGNMENT');
  });

  test('id inválido → 400', async () => {
    const res = await server.call('GET', path('abc'), { token: tokens.teacherA });
    assert.equal(res.status, 400);
  });

  test('alumno → 403, sin sesión → 401', async () => {
    assert.equal((await server.call('GET', path(ids.paperA), { token: tokens.student })).status, 403);
    assert.equal((await server.call('GET', path(ids.paperA))).status, 401);
  });
});
