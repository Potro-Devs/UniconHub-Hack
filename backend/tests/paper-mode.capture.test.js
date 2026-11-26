import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * Escuela A: docente A (3.º A) y docente B (4.º B), director A.
 * Prueba en papel de 3.º A: 3 reactivos de fracciones + 2 de multiplicación (opción A correcta).
 * Destinatarios: Sofía, Mateo y Ana. Lucía es del grupo pero no tiene la prueba.
 * Datos ficticios, no es contenido pedagógico.
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

  const groupA = id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'A', '2026-2027', 'CAPT3A')", school, teacherA);

  const student = (first, folio) =>
    id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, 'Demo', 'XX', '#F4B6C2')",
      school, folio, first);
  const sofia = student('Sofía', 'AXI-AAAAAAAA');
  const mateo = student('Mateo', 'AXI-BBBBBBBB');
  const ana = student('Ana', 'AXI-CCCCCCCC');
  const leo = student('Leo', 'AXI-EEEEEEEE');
  const eva = student('Eva', 'AXI-FFFFFFFF');
  const lucia = student('Lucía', 'AXI-DDDDDDDD');
  for (const s of [sofia, mateo, ana, leo, eva, lucia]) {
    db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'active')").run(groupA, s);
  }

  const skill = (code, name) => id('INSERT INTO skills (code, name) VALUES (?, ?)', code, name);
  const fractions = skill('fractions', 'Fracciones');
  const multiplication = skill('multiplication', 'Multiplicaciones');
  const question = (skillId) => {
    const qid = id(
      "INSERT INTO questions (skill_id, grade, stem, hint_1, hint_2, hint_3) VALUES (?, 3, 'Reactivo', 'Pista 1', 'Pista 2', 'Pista 3')",
      skillId,
    );
    const correct = id("INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'A', 'Correcta', 1)", qid);
    const wrong = id(
      "INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, 'B', 'Distractor', 0, 'test_error', 'Explicación')",
      qid,
    );
    return { id: qid, correct, wrong };
  };
  const questions = [question(fractions), question(fractions), question(fractions), question(multiplication), question(multiplication)];

  const assignment = (modality, status = 'active') =>
    id("INSERT INTO assignments (group_id, created_by, title, modality, status) VALUES (?, ?, 'Prueba', ?, ?)", groupA, teacherA, modality, status);
  const paper = assignment('paper');
  const screen = assignment('screen');
  const closed = assignment('paper', 'closed');
  for (const a of [paper, screen, closed]) {
    questions.forEach((q, i) =>
      db.prepare('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)').run(a, q.id, i + 1));
  }
  const target = (a, s, locked) =>
    db.prepare("INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked) VALUES (?, ?, 'pending', ?)").run(a, s, locked);
  for (const s of [sofia, mateo, ana, leo, eva]) target(paper, s, 1);
  target(screen, sofia, 0);
  target(closed, sofia, 1);

  const staff = (sub, role) => tokenFor({ sub: String(sub), role, schoolId: school });
  return {
    db,
    ids: { paper, screen, closed, sofia, mateo, ana, leo, eva, lucia, fractions, multiplication },
    questions,
    tokens: {
      teacherA: staff(teacherA, 'teacher'),
      teacherB: staff(teacherB, 'teacher'),
      director: staff(director, 'director'),
      sofia: tokenFor({ sub: String(sofia), role: 'student', schoolId: school, groupId: groupA }),
    },
  };
}

describe('POST /paper/assignments/:id/capture/:studentId', () => {
  let server;
  let db;
  let ids;
  let questions;
  let tokens;
  const capturePath = (a, s) => `/api/v1/paper/assignments/${a}/capture/${s}`;
  const count = (sql, ...params) => db.prepare(sql).get(...params).n;
  const targetOf = (a, s) =>
    db.prepare('SELECT status, is_screen_locked, completed_at FROM assignment_targets WHERE assignment_id = ? AND student_id = ?').get(a, s);
  const responsesOf = (a, s) =>
    count(
      `SELECT COUNT(*) AS n FROM student_responses r JOIN assignment_targets t ON t.id = r.assignment_target_id
       WHERE t.assignment_id = ? AND t.student_id = ?`,
      a,
      s,
    );

  before(async () => {
    const fx = createFixtures();
    ({ db, ids, questions, tokens } = fx);
    server = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });
  after(() => server.close());

  test('captura una hoja: respuestas en papel, destinatario bloqueado y corte de dominio', async () => {
    const [f1, f2, f3, m1] = questions;
    // Fracciones: 2 aciertos + 1 error (3 contestados → corte). Multiplicación: 1 acierto + 1 en blanco (sin corte).
    const answers = { [f1.id]: f1.correct, [f2.id]: f2.correct, [f3.id]: f3.wrong, [m1.id]: m1.correct };
    const res = await server.call('POST', capturePath(ids.paper, ids.sofia), { token: tokens.teacherA, body: { answers } });

    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.equal(data.captured, true);
    assert.equal(data.status, 'completed_paper');
    assert.ok(data.completedAt);
    assert.equal(data.celebrations, undefined);
    assert.deepEqual(
      { total: data.summary.total, correctAutonomous: data.summary.correctAutonomous, achievedWithSupport: data.summary.achievedWithSupport, incorrect: data.summary.incorrect, unanswered: data.summary.unanswered },
      { total: 5, correctAutonomous: 3, achievedWithSupport: 0, incorrect: 1, unanswered: 1 },
    );
    const bySkill = Object.fromEntries(data.skills.map((s) => [s.code, s]));
    assert.equal(bySkill.fractions.masteryRecorded, true);
    assert.equal(typeof bySkill.fractions.masteryPercentage, 'number');
    assert.ok(bySkill.fractions.masteryLabel);
    assert.equal(bySkill.multiplication.masteryRecorded, false);

    assert.deepEqual({ ...targetOf(ids.paper, ids.sofia), completed_at: 'x' }, { status: 'completed_paper', is_screen_locked: 1, completed_at: 'x' });
    assert.equal(count("SELECT COUNT(*) AS n FROM student_responses WHERE source = 'paper'"), 5);
    assert.equal(count("SELECT COUNT(*) AS n FROM student_responses WHERE error_tag = 'test_error'"), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM skill_mastery_history WHERE student_id = ? AND skill_id = ?', ids.sofia, ids.fractions), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM skill_mastery_history WHERE student_id = ? AND skill_id = ?', ids.sofia, ids.multiplication), 0);
    assert.equal(count('SELECT COUNT(*) AS n FROM student_achievements WHERE student_id = ?', ids.sofia), 0);
    assert.doesNotMatch(JSON.stringify(res.body), /AXI-|Sofía/);
  });

  test('el avance de captura refleja la hoja capturada', async () => {
    const res = await server.call('GET', `/api/v1/paper/assignments/${ids.paper}/capture-status`, { token: tokens.teacherA });
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.data.total, res.body.data.captured, res.body.data.pending], [5, 1, 4]);
  });

  test('recapturar → 409 ALREADY_CAPTURED sin duplicar respuestas', async () => {
    const res = await server.call('POST', capturePath(ids.paper, ids.sofia), { token: tokens.teacherA, body: { answers: {} } });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ALREADY_CAPTURED');
    assert.equal(responsesOf(ids.paper, ids.sofia), 5);
  });

  test('tras capturar, el portal del alumno sigue bloqueado → 409 SCREEN_LOCKED', async () => {
    const res = await server.call('GET', `/api/v1/diagnostics/assignments/${ids.paper}/start`, { token: tokens.sofia });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'SCREEN_LOCKED');
  });

  test('alumno que faltó: no guarda nada y queda pendiente', async () => {
    const res = await server.call('POST', capturePath(ids.paper, ids.mateo), { token: tokens.teacherA, body: { absent: true } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { assignmentId: ids.paper, studentId: ids.mateo, captured: false, status: 'pending' });
    assert.equal(responsesOf(ids.paper, ids.mateo), 0);
    assert.equal(targetOf(ids.paper, ids.mateo).status, 'pending');
  });

  test('hoja en blanco: todo `unanswered`, sin corte de dominio', async () => {
    const res = await server.call('POST', capturePath(ids.paper, ids.ana), { token: tokens.teacherA, body: { answers: {} } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.unanswered, 5);
    assert.ok(res.body.data.skills.every((s) => !s.masteryRecorded));
    assert.equal(count('SELECT COUNT(*) AS n FROM skill_mastery_history WHERE student_id = ?', ids.ana), 0);
  });

  test('reactivo u opción ajenos, o cuerpo inválido → 400 sin guardar nada', async () => {
    const [f1, f2] = questions;
    const cases = [
      [{ answers: { 999999: 1 } }, 'UNKNOWN_QUESTION'],
      [{ answers: { [f1.id]: f2.correct } }, 'UNKNOWN_OPTION'],
      [{ answers: { [f1.id]: String(f1.correct) } }, 'VALIDATION_ERROR'],
      [{ answers: [] }, 'VALIDATION_ERROR'],
      [{}, 'VALIDATION_ERROR'],
      [{ absent: 'sí' }, 'VALIDATION_ERROR'],
    ];
    for (const [body, code] of cases) {
      const res = await server.call('POST', capturePath(ids.paper, ids.mateo), { token: tokens.teacherA, body });
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, code, JSON.stringify(body));
    }
    assert.equal(responsesOf(ids.paper, ids.mateo), 0);
    assert.equal(targetOf(ids.paper, ids.mateo).status, 'pending');
  });

  test('acierto con tarjeta de pista = "Logrado con apoyo", separado del autónomo en respuesta y corte', async () => {
    const [f1, f2, f3] = questions;
    // Fracciones: f1 correcta sin tarjetas, f2 correcta con tarjeta 2, f3 incorrecta con tarjeta 1.
    const body = {
      answers: { [f1.id]: f1.correct, [f2.id]: f2.correct, [f3.id]: f3.wrong },
      hintLevels: { [f1.id]: 0, [f2.id]: 2, [f3.id]: 1 },
    };
    const res = await server.call('POST', capturePath(ids.paper, ids.leo), { token: tokens.teacherA, body });
    assert.equal(res.status, 200);
    const { summary } = res.body.data;
    assert.deepEqual(
      [summary.correctAutonomous, summary.achievedWithSupport, summary.incorrect, summary.unanswered],
      [1, 1, 1, 2],
    );
    const fractions = res.body.data.skills.find((s) => s.code === 'fractions');
    assert.deepEqual([fractions.correctAutonomous, fractions.achievedWithSupport, fractions.masteryRecorded], [1, 1, true]);

    const saved = Object.fromEntries(
      db.prepare(`SELECT r.question_id, r.outcome_status, r.max_hint_level_used FROM student_responses r
        JOIN assignment_targets t ON t.id = r.assignment_target_id WHERE t.assignment_id = ? AND t.student_id = ?`)
        .all(ids.paper, ids.leo).map((r) => [r.question_id, [r.outcome_status, r.max_hint_level_used]]),
    );
    assert.deepEqual(saved[f1.id], ['correct_autonomous', 0]);
    assert.deepEqual(saved[f2.id], ['achieved_with_support', 2]);
    assert.deepEqual(saved[f3.id], ['incorrect', 1]);

    // El corte inmutable guarda el apoyo aparte de la autonomía (AGENTS.md §4.2).
    const cut = db.prepare('SELECT autonomous_percentage, supported_percentage FROM skill_mastery_history WHERE student_id = ? AND skill_id = ?')
      .get(ids.leo, ids.fractions);
    assert.ok(cut.supported_percentage > 0, JSON.stringify(cut));
    assert.ok(cut.autonomous_percentage < 100, JSON.stringify(cut));
  });

  test('casilla general "Usó tarjetas": los aciertos de la hoja cuentan como apoyo, sin detalle por reactivo', async () => {
    const [f1, f2, f3] = questions;
    const body = { answers: { [f1.id]: f1.correct, [f2.id]: f2.correct, [f3.id]: f3.wrong }, supportUsed: true };
    const res = await server.call('POST', capturePath(ids.paper, ids.eva), { token: tokens.teacherA, body });
    assert.equal(res.status, 200);
    const { summary } = res.body.data;
    assert.deepEqual([summary.correctAutonomous, summary.achievedWithSupport, summary.incorrect], [0, 2, 1]);
    const cut = db.prepare('SELECT autonomous_percentage, supported_percentage FROM skill_mastery_history WHERE student_id = ? AND skill_id = ?')
      .get(ids.eva, ids.fractions);
    assert.equal(cut.autonomous_percentage, 0);
    assert.ok(cut.supported_percentage > 0, JSON.stringify(cut));
  });

  test('hintLevels inválidos → 400 sin guardar nada', async () => {
    const [f1] = questions;
    const cases = [
      [{ answers: {}, hintLevels: { [f1.id]: 4 } }, 'VALIDATION_ERROR'],
      [{ answers: {}, hintLevels: { [f1.id]: 1.5 } }, 'VALIDATION_ERROR'],
      [{ answers: {}, hintLevels: { [f1.id]: '2' } }, 'VALIDATION_ERROR'],
      [{ answers: {}, hintLevels: { '01': 1 } }, 'VALIDATION_ERROR'],
      [{ answers: {}, hintLevels: [] }, 'VALIDATION_ERROR'],
      [{ answers: {}, hintLevels: { 999999: 1 } }, 'UNKNOWN_QUESTION'],
    ];
    for (const [body, code] of cases) {
      const res = await server.call('POST', capturePath(ids.paper, ids.mateo), { token: tokens.teacherA, body });
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, code, JSON.stringify(body));
    }
    assert.equal(responsesOf(ids.paper, ids.mateo), 0);
  });

  test('alumno sin la prueba asignada → 404 STUDENT_NOT_FOUND', async () => {
    const res = await server.call('POST', capturePath(ids.paper, ids.lucia), { token: tokens.teacherA, body: { answers: {} } });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'STUDENT_NOT_FOUND');
  });

  test('autorización y modalidad: otro docente 404, director 403, pantalla 409, cerrada 422', async () => {
    const body = { answers: {} };
    const otherTeacher = await server.call('POST', capturePath(ids.paper, ids.mateo), { token: tokens.teacherB, body });
    assert.equal(otherTeacher.status, 404);
    assert.equal(otherTeacher.body.error.code, 'ASSIGNMENT_NOT_FOUND');

    assert.equal((await server.call('POST', capturePath(ids.paper, ids.mateo), { token: tokens.director, body })).status, 403);

    const screen = await server.call('POST', capturePath(ids.screen, ids.sofia), { token: tokens.teacherA, body });
    assert.equal(screen.status, 409);
    assert.equal(screen.body.error.code, 'NOT_PAPER_ASSIGNMENT');

    const closed = await server.call('POST', capturePath(ids.closed, ids.sofia), { token: tokens.teacherA, body });
    assert.equal(closed.status, 422);
    assert.equal(closed.body.error.code, 'ASSIGNMENT_CLOSED');
    assert.equal(responsesOf(ids.paper, ids.mateo), 0);
  });
});
