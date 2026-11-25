import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase, withTransaction } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { runSeed } from '../src/db/seed.js';
import { createDiagnosticsRepository } from '../src/modules/diagnostics/diagnostics.repository.js';
import { createDiagnosticsService } from '../src/modules/diagnostics/diagnostics.service.js';
import { createGroupsRepository } from '../src/modules/groups/groups.repository.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const schoolA = id("INSERT INTO schools (name) VALUES ('Escuela A')");
  const teacherA = id(
    "INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, 'a@axi.test', 'x', 'Docente Demo', 'teacher')",
    schoolA,
  );
  const directorA = id(
    "INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, 'd@axi.test', 'x', 'Director Demo', 'director')",
    schoolA,
  );

  const groupA = id(
    "INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'A', '2026-2027', 'MAPA3A')",
    schoolA,
    teacherA,
  );
  const groupB = id(
    "INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'B', '2026-2027', 'MAPA3B')",
    schoolA,
    teacherA,
  );

  const student = (first, last, initials, folio) =>
    id(
      "INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, '#F4B6C2')",
      schoolA,
      folio,
      first,
      last,
      initials,
    );
  const sofia = student('Sofía', 'Ramírez García', 'SR', 'AXI-AAAAAAAA');
  const mateo = student('Mateo', 'Hernández López', 'MH', 'AXI-BBBBBBBB');
  const diego = student('Diego', 'Cruz Pérez', 'DC', 'AXI-CCCCCCCC');

  const enroll = (g, s, status = 'active') =>
    db.prepare('INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, ?)').run(g, s, status);
  enroll(groupA, sofia, 'active');
  enroll(groupA, mateo, 'active');
  enroll(groupA, diego, 'withdrawn');

  const skill = Object.fromEntries(
    [
      ['fractions', 'Fracciones'],
      ['multiplication', 'Multiplicaciones'],
    ].map(([code, name]) => [code, id('INSERT INTO skills (code, name) VALUES (?, ?)', code, name)]),
  );

  const makeQuestions = (code, count) => {
    const list = [];
    for (let i = 1; i <= count; i += 1) {
      const qid = id(
        "INSERT INTO questions (skill_id, grade, stem, hint_1, hint_2, hint_3) VALUES (?, 3, ?, 'Pista 1', 'Pista 2', 'Pista 3')",
        skill[code],
        `Pregunta ${code} #${i}`,
      );
      const correctOptionId = id(
        "INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'A', 'Respuesta correcta', 1)",
        qid,
      );
      const wrongOptionId = id(
        "INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, 'B', 'Distractor', 0, 'test_error', 'Explicación del error')",
        qid,
      );
      list.push({ id: qid, correctOptionId, wrongOptionId });
    }
    return list;
  };

  const fracQuestions = makeQuestions('fractions', 6);
  const multQuestions = makeQuestions('multiplication', 3);

  const createAssignment = ({
    groupId = groupA,
    title,
    modality = 'screen',
    status = 'active',
    questions,
    targets,
  }) => {
    const aid = id(
      'INSERT INTO assignments (group_id, created_by, title, modality, status) VALUES (?, ?, ?, ?, ?)',
      groupId,
      teacherA,
      title,
      modality,
      status,
    );
    questions.forEach((q, idx) =>
      db.prepare('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)').run(aid, q.id, idx + 1),
    );
    targets.forEach((sid) =>
      db
        .prepare('INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked) VALUES (?, ?, ?, ?)')
        .run(aid, sid, 'pending', modality === 'paper' ? 1 : 0),
    );
    return aid;
  };

  const screenA = createAssignment({
    title: 'Fracciones 1',
    questions: fracQuestions.slice(0, 3),
    targets: [sofia, mateo],
  });
  const screenMulti = createAssignment({
    title: 'Fracciones y Multiplicación',
    questions: [...fracQuestions.slice(3, 6), ...multQuestions],
    targets: [sofia],
  });
  const paperA = createAssignment({
    title: 'Fracciones en papel',
    modality: 'paper',
    questions: fracQuestions.slice(0, 3),
    targets: [sofia],
  });
  const closedA = createAssignment({
    title: 'Prueba cerrada',
    status: 'closed',
    questions: fracQuestions.slice(0, 3),
    targets: [sofia],
  });
  const otherGroupAssign = createAssignment({
    groupId: groupB,
    title: 'Otro grupo',
    questions: fracQuestions.slice(0, 3),
    targets: [mateo],
  });
  const mateoOnly = createAssignment({
    title: 'Solo Mateo',
    questions: fracQuestions.slice(0, 3),
    targets: [mateo],
  });

  return {
    db,
    ids: {
      schoolA,
      groupA,
      sofia,
      mateo,
      diego,
      screenA,
      screenMulti,
      paperA,
      closedA,
      otherGroupAssign,
      mateoOnly,
    },
    questions: { frac: fracQuestions, mult: multQuestions },
    tokens: {
      sofia: tokenFor({ sub: String(sofia), role: 'student', schoolId: schoolA, groupId: groupA }),
      mateo: tokenFor({ sub: String(mateo), role: 'student', schoolId: schoolA, groupId: groupA }),
      diego: tokenFor({ sub: String(diego), role: 'student', schoolId: schoolA, groupId: groupA }),
      teacherA: tokenFor({ sub: String(teacherA), role: 'teacher', schoolId: schoolA }),
      directorA: tokenFor({ sub: String(directorA), role: 'director', schoolId: schoolA }),
    },
  };
}

function assertNoLeak(payload, { allowOutcome = false } = {}) {
  const json = JSON.stringify(payload);
  const forbidden = [
    'internal_folio',
    'internalFolio',
    'AXI-',
    'is_correct',
    'isCorrect',
    'errorTag',
    'errorExplanation',
    'error_tag',
    'error_explanation',
  ];
  if (!allowOutcome) forbidden.push('outcomeStatus');
  for (const term of forbidden) {
    assert.ok(!json.includes(term), `no debe exponer ${term}`);
  }
}

describe('diagnostics API', () => {
  let fx;
  let api;

  beforeEach(async () => {
    fx = createFixtures();
    api = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });

  afterEach(async () => {
    await api.close();
    fx.db.close();
  });

  describe('sesión, roles y aislamiento', () => {
    test('sin sesión → 401 en todos los endpoints', async () => {
      const q0 = fx.questions.frac[0];
      for (const [method, path, body] of [
        ['GET', `/api/v1/diagnostics/students/${fx.ids.sofia}/assignments`],
        ['GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${q0.id}/hints`, { level: 1 }],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, { questionId: q0.id, selectedOptionId: q0.correctOptionId }],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/complete`],
      ]) {
        const res = await api.call(method, path, { body });
        assert.equal(res.status, 401);
        assert.equal(res.body.error.code, 'AUTH_REQUIRED');
      }
    });

    test('docente y director reciben 403 en todo', async () => {
      const q0 = fx.questions.frac[0];
      for (const token of [fx.tokens.teacherA, fx.tokens.directorA]) {
        for (const [method, path, body] of [
          ['GET', `/api/v1/diagnostics/students/${fx.ids.sofia}/assignments`],
          ['GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`],
          ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${q0.id}/hints`, { level: 1 }],
          ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, { questionId: q0.id, selectedOptionId: q0.correctOptionId }],
          ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/complete`],
        ]) {
          const res = await api.call(method, path, { token, body });
          assert.equal(res.status, 403);
          assert.equal(res.body.error.code, 'FORBIDDEN');
        }
      }
    });

    test('aislamiento: otro alumno, alumno dado de baja, prueba ajena o de otro grupo → 404', async () => {
      const wrongStudent = await api.call('GET', `/api/v1/diagnostics/students/${fx.ids.mateo}/assignments`, {
        token: fx.tokens.sofia,
      });
      assert.equal(wrongStudent.status, 404);
      assert.equal(wrongStudent.body.error.code, 'STUDENT_NOT_FOUND');

      const withdrawn = await api.call('GET', `/api/v1/diagnostics/students/${fx.ids.diego}/assignments`, {
        token: fx.tokens.diego,
      });
      assert.equal(withdrawn.status, 404);

      for (const assignmentId of [fx.ids.mateoOnly, fx.ids.otherGroupAssign, 999999]) {
        const startRes = await api.call('GET', `/api/v1/diagnostics/assignments/${assignmentId}/start`, {
          token: fx.tokens.sofia,
        });
        assert.equal(startRes.status, 404);
        assert.equal(startRes.body.error.code, 'ASSIGNMENT_NOT_FOUND');
      }

      const missingQuestion = await api.call(
        'POST',
        `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${fx.questions.mult[0].id}/hints`,
        { token: fx.tokens.sofia, body: { level: 1 } },
      );
      assert.equal(missingQuestion.status, 404);
      assert.equal(missingQuestion.body.error.code, 'QUESTION_NOT_FOUND');
    });

    test('ids de ruta inválidos → 400', async () => {
      for (const bad of ['0', '-5', 'abc', '9999999999999999']) {
        const res1 = await api.call('GET', `/api/v1/diagnostics/students/${bad}/assignments`, {
          token: fx.tokens.sofia,
        });
        assert.equal(res1.status, 400);
        assert.equal(res1.body.error.code, 'VALIDATION_ERROR');

        const res2 = await api.call('GET', `/api/v1/diagnostics/assignments/${bad}/start`, {
          token: fx.tokens.sofia,
        });
        assert.equal(res2.status, 400);
        assert.equal(res2.body.error.code, 'VALIDATION_ERROR');

        const res3 = await api.call(
          'POST',
          `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${bad}/hints`,
          { token: fx.tokens.sofia, body: { level: 1 } },
        );
        assert.equal(res3.status, 400);
        assert.equal(res3.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('listado, inicio, pistas en servidor y respuesta', () => {
    test('GET /students/:studentId/assignments lista pruebas en pantalla y papel sin datos privados', async () => {
      const res = await api.call('GET', `/api/v1/diagnostics/students/${fx.ids.sofia}/assignments`, {
        token: fx.tokens.sofia,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.meta.count, 4);
      assertNoLeak(res.body);

      const byId = new Map(res.body.data.map((a) => [a.id, a]));
      assert.equal(byId.get(fx.ids.screenA).isScreenLocked, false);
      assert.equal(byId.get(fx.ids.screenA).questionCount, 3);
      assert.equal(byId.get(fx.ids.screenA).answeredCount, 0);
      assert.deepEqual(byId.get(fx.ids.screenA).skills, [{ code: 'fractions', name: 'Fracciones', questionCount: 3 }]);
      assert.equal(byId.get(fx.ids.paperA).isScreenLocked, true);
      assert.equal(byId.get(fx.ids.mateoOnly), undefined);
    });

    test('start oculta pistas no pedidas; hints entrega en orden 1→2→3 y persiste al reabrir', async () => {
      const start1 = await api.call('GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`, {
        token: fx.tokens.sofia,
      });
      assert.equal(start1.status, 200);
      assertNoLeak(start1.body);
      assert.equal(start1.body.data.assignment.status, 'in_progress');
      assert.ok(start1.body.data.assignment.startedAt);
      assert.equal(start1.body.data.questions.length, 3);
      assert.deepEqual(start1.body.data.questions[0].hints, []);
      assert.equal(start1.body.data.questions[0].difficulty, undefined);
      assert.equal(start1.body.data.questions[0].answered, false);

      const q0 = fx.questions.frac[0];
      // Pedir pista 2 antes de 1 → 422 INVALID_HINT_SEQUENCE
      const skipHint = await api.call(
        'POST',
        `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${q0.id}/hints`,
        { token: fx.tokens.sofia, body: { level: 2 } },
      );
      assert.equal(skipHint.status, 422);
      assert.equal(skipHint.body.error.code, 'INVALID_HINT_SEQUENCE');

      // Pedir niveles inválidos → 400
      for (const badBody of [[], {}, { level: 0 }, { level: 4 }, { level: 1.5 }, { level: '1' }]) {
        const badHint = await api.call(
          'POST',
          `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${q0.id}/hints`,
          { token: fx.tokens.sofia, body: badBody },
        );
        assert.equal(badHint.status, 400);
        assert.equal(badHint.body.error.code, 'VALIDATION_ERROR');
      }

      const h1 = await api.call(
        'POST',
        `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${q0.id}/hints`,
        { token: fx.tokens.sofia, body: { level: 1 } },
      );
      assert.equal(h1.status, 200);
      assertNoLeak(h1.body);
      assert.deepEqual(h1.body.data, {
        questionId: q0.id,
        level: 1,
        hint: 'Pista 1',
        remainingHints: 2,
      });

      // Repetir nivel 1 → 422 INVALID_HINT_SEQUENCE
      const dupHint = await api.call(
        'POST',
        `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${q0.id}/hints`,
        { token: fx.tokens.sofia, body: { level: 1 } },
      );
      assert.equal(dupHint.status, 422);
      assert.equal(dupHint.body.error.code, 'INVALID_HINT_SEQUENCE');

      const h2 = await api.call(
        'POST',
        `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${q0.id}/hints`,
        { token: fx.tokens.sofia, body: { level: 2 } },
      );
      assert.equal(h2.status, 200);
      assert.equal(h2.body.data.hint, 'Pista 2');
      assert.equal(h2.body.data.remainingHints, 1);

      // Reabrir devuelve solo las 2 pistas ya pedidas
      const start2 = await api.call('GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`, {
        token: fx.tokens.sofia,
      });
      assert.equal(start2.status, 200);
      assert.deepEqual(start2.body.data.questions[0].hints, ['Pista 1', 'Pista 2']);
      assert.equal(start2.body.data.questions[0].maxHintLevelUsed, 2);
      assert.deepEqual(start2.body.data.questions[1].hints, []);

      // El cliente intenta mentir con maxHintLevelUsed: 0; el servidor usa 2
      const ans = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: q0.id, selectedOptionId: q0.correctOptionId, maxHintLevelUsed: 0 },
      });
      assert.equal(ans.status, 200);
      assertNoLeak(ans.body);
      assert.deepEqual(ans.body.data, {
        questionId: q0.id,
        selectedOptionId: q0.correctOptionId,
        maxHintLevelUsed: 2,
        feedback: 'Respuesta guardada.',
        answeredCount: 1,
        questionCount: 3,
      });

      const savedRow = fx.db
        .prepare('SELECT outcome_status, max_hint_level_used FROM student_responses WHERE question_id = ?')
        .get(q0.id);
      assert.equal(savedRow.outcome_status, 'achieved_with_support');
      assert.equal(savedRow.max_hint_level_used, 2);

      // Pedir pista de pregunta ya contestada → 409 ALREADY_ANSWERED
      const hintAfterAnswer = await api.call(
        'POST',
        `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${q0.id}/hints`,
        { token: fx.tokens.sofia, body: { level: 3 } },
      );
      assert.equal(hintAfterAnswer.status, 409);
      assert.equal(hintAfterAnswer.body.error.code, 'ALREADY_ANSWERED');
    });

    test('bloqueo papel (409 SCREEN_LOCKED) y prueba cerrada (422 ASSIGNMENT_CLOSED)', async () => {
      const q0 = fx.questions.frac[0];
      for (const [method, path, body] of [
        ['GET', `/api/v1/diagnostics/assignments/${fx.ids.paperA}/start`],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.paperA}/questions/${q0.id}/hints`, { level: 1 }],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.paperA}/answer`, { questionId: q0.id, selectedOptionId: q0.correctOptionId }],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.paperA}/complete`],
      ]) {
        const res = await api.call(method, path, { token: fx.tokens.sofia, body });
        assert.equal(res.status, 409);
        assert.equal(res.body.error.code, 'SCREEN_LOCKED');
      }

      const closed = await api.call('GET', `/api/v1/diagnostics/assignments/${fx.ids.closedA}/start`, {
        token: fx.tokens.sofia,
      });
      assert.equal(closed.status, 422);
      assert.equal(closed.body.error.code, 'ASSIGNMENT_CLOSED');
    });

    test('POST /answer oculta si acertó, devuelve feedback neutro y rechaza duplicados/inválidos', async () => {
      const [q0, q1, q2] = fx.questions.frac;
      const r0 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: q0.id, selectedOptionId: q0.correctOptionId },
      });
      assert.equal(r0.status, 200);
      assertNoLeak(r0.body);
      assert.equal(r0.body.data.isCorrect, undefined);
      assert.equal(r0.body.data.outcomeStatus, undefined);
      assert.equal(r0.body.data.feedback, 'Respuesta guardada.');

      const r2 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: q2.id, selectedOptionId: q2.wrongOptionId },
      });
      assert.equal(r2.status, 200);
      assertNoLeak(r2.body);
      assert.equal(r2.body.data.feedback, 'Respuesta guardada.');

      const dup = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: q0.id, selectedOptionId: q0.correctOptionId },
      });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.error.code, 'ALREADY_ANSWERED');

      const invalidJson = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: null,
      });
      assert.equal(invalidJson.status, 400);
      assert.equal(invalidJson.body.error.code, 'INVALID_JSON');

      for (const badBody of [
        [],
        {},
        { questionId: 0, selectedOptionId: q0.correctOptionId },
        { questionId: q0.id, selectedOptionId: '1' },
        { questionId: fx.questions.mult[0].id, selectedOptionId: fx.questions.mult[0].correctOptionId },
        { questionId: q0.id, selectedOptionId: q1.correctOptionId },
      ]) {
        const bad = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
          token: fx.tokens.sofia,
          body: badBody,
        });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('cierre de prueba, historial ponderado, logros y atomicidad', () => {
    test('POST /complete rechaza cerrar sin respuestas (422 NOTHING_ANSWERED)', async () => {
      const res = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/complete`, {
        token: fx.tokens.sofia,
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'NOTHING_ANSWERED');
      assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM skill_mastery_history').get().n, 0);
      assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM student_responses').get().n, 0);
    });

    test('POST /complete corta habilidades con >= 3 respuestas, emite un solo block_completed y excluye unanswered de answeredCount', async () => {
      // Sesión 1 (screenA): 3 contestadas (1 autónoma, 1 con apoyo, 1 incorrecta) → 33.33% autónomo
      const [f0, f1, f2] = fx.questions.frac.slice(0, 3);
      await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: f0.id, selectedOptionId: f0.correctOptionId },
      });
      await api.call(
        'POST',
        `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${f1.id}/hints`,
        { token: fx.tokens.sofia, body: { level: 1 } },
      );
      await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: f1.id, selectedOptionId: f1.correctOptionId },
      });
      await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: f2.id, selectedOptionId: f2.wrongOptionId },
      });

      const comp1 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/complete`, {
        token: fx.tokens.sofia,
      });
      assert.equal(comp1.status, 200);
      assertNoLeak(comp1.body, { allowOutcome: true });
      assert.equal(comp1.body.data.status, 'completed_screen');
      assert.ok(comp1.body.data.completedAt);
      assert.deepEqual(comp1.body.data.summary, {
        total: 3,
        correctAutonomous: 1,
        achievedWithSupport: 1,
        incorrect: 1,
        unanswered: 0,
        autonomousPercentage: 33.33,
        supportedPercentage: 33.33,
      });
      assert.equal(comp1.body.data.skills[0].masteryRecorded, true);
      assert.equal(comp1.body.data.skills[0].masteryPercentage, 33.33);
      assert.equal(comp1.body.data.skills[0].masteryLevel, 'in_progress');
      assert.equal(comp1.body.data.celebrations.filter((c) => c.code === 'block_completed').length, 1);

      // Bloquea re-apertura, pistas, respuesta y re-cierre tras completar
      for (const [method, path, body] of [
        ['GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/questions/${f0.id}/hints`, { level: 1 }],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, { questionId: f0.id, selectedOptionId: f0.correctOptionId }],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/complete`],
      ]) {
        const res = await api.call(method, path, { token: fx.tokens.sofia, body });
        assert.equal(res.status, 409);
        assert.equal(res.body.error.code, 'ALREADY_COMPLETED');
      }

      // Sesión 2 (screenMulti): 3/3 autónomos en fracciones (corte 2: 77.78%) + 1/3 en multiplicación (< 3 contestadas → sin corte)
      for (const q of fx.questions.frac.slice(3, 6)) {
        await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenMulti}/answer`, {
          token: fx.tokens.sofia,
          body: { questionId: q.id, selectedOptionId: q.correctOptionId },
        });
      }
      await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenMulti}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: fx.questions.mult[0].id, selectedOptionId: fx.questions.mult[0].correctOptionId },
      });

      const comp2 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenMulti}/complete`, {
        token: fx.tokens.sofia,
      });
      assert.equal(comp2.status, 200);
      assertNoLeak(comp2.body, { allowOutcome: true });
      assert.equal(comp2.body.data.skills.length, 2);
      assert.equal(comp2.body.data.celebrations.filter((c) => c.code === 'block_completed').length, 1);

      // Promedio ponderado fracciones: (1 * 33.33 + 2 * 100) / 3 = 77.78
      assert.equal(comp2.body.data.skills[0].code, 'fractions');
      assert.equal(comp2.body.data.skills[0].masteryRecorded, true);
      assert.equal(comp2.body.data.skills[0].masteryPercentage, 77.78);
      assert.equal(comp2.body.data.skills[0].masteryLevel, 'mastered');

      // Multiplicación solo tuvo 1 contestada (< 3) → no genera corte en skill_mastery_history
      assert.equal(comp2.body.data.skills[1].code, 'multiplication');
      assert.equal(comp2.body.data.skills[1].unanswered, 2);
      assert.equal(comp2.body.data.skills[1].masteryRecorded, false);
      assert.equal(comp2.body.data.skills[1].masteryPercentage, null);
      assert.equal(comp2.body.data.skills[1].masteryLevel, null);

      // El listado excluye los 2 reactivos omitidos (`unanswered`) de `answeredCount`
      const afterComp2 = await api.call('GET', `/api/v1/diagnostics/students/${fx.ids.sofia}/assignments`, {
        token: fx.tokens.sofia,
      });
      const listedMulti = afterComp2.body.data.find((a) => a.id === fx.ids.screenMulti);
      assert.equal(listedMulti.questionCount, 6);
      assert.equal(listedMulti.answeredCount, 4);

      const cuts = fx.db
        .prepare('SELECT session_index, mastery_percentage FROM skill_mastery_history WHERE student_id = ? ORDER BY id')
        .all(fx.ids.sofia);
      assert.equal(cuts.length, 2);
      assert.equal(cuts[1].session_index, 2);
      assert.equal(cuts[1].mastery_percentage, 77.78);
    });

    test('atomicidad y guardia de estado en markTargetCompletedScreen', async () => {
      const f0 = fx.questions.frac[0];
      await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: f0.id, selectedOptionId: f0.correctOptionId },
      });

      const baseRepo = createDiagnosticsRepository(fx.db);
      const auth = { sub: String(fx.ids.sofia), role: 'student', schoolId: fx.ids.schoolA, groupId: fx.ids.groupA };

      // 1) Si falla la inserción de logros, hace rollback de todo completeAssignment
      const failAchService = createDiagnosticsService({
        repository: { ...baseRepo, insertAchievement: () => { throw new Error('fallo simulado'); } },
        groupsRepository: createGroupsRepository(fx.db),
        transaction: (fn) => withTransaction(fx.db, fn),
      });
      assert.throws(() => failAchService.completeAssignment(auth, fx.ids.screenA), /fallo simulado/);
      assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM skill_mastery_history').get().n, 0);
      assert.equal(fx.db.prepare("SELECT COUNT(*) AS n FROM student_responses WHERE outcome_status = 'unanswered'").get().n, 0);

      // 2) Si markTargetCompletedScreen reporta 0 cambios (bloqueado en paralelo), revierte y lanza ALREADY_COMPLETED (409)
      const failLockService = createDiagnosticsService({
        repository: { ...baseRepo, markTargetCompletedScreen: () => ({ changes: 0 }) },
        groupsRepository: createGroupsRepository(fx.db),
        transaction: (fn) => withTransaction(fx.db, fn),
      });
      assert.throws(
        () => failLockService.completeAssignment(auth, fx.ids.screenA),
        (err) => err.code === 'ALREADY_COMPLETED',
      );
      assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM student_achievements').get().n, 0);
      assert.equal(fx.db.prepare("SELECT COUNT(*) AS n FROM student_responses WHERE outcome_status = 'unanswered'").get().n, 0);
    });

    test('consistencia con el seed: el primer alumno demo ve sus 6 pruebas y la de papel está bloqueada', async () => {
      const seedDb = openDatabase(':memory:');
      runMigrations(seedDb);
      runSeed(seedDb);
      const seedApi = await startServer(createApp({ db: seedDb, config: configWith(), logger: silentLogger }));
      try {
        const studentRow = seedDb
          .prepare("SELECT s.id, e.group_id, g.school_id FROM students s JOIN group_enrollments e ON e.student_id = s.id JOIN groups g ON g.id = e.group_id WHERE g.join_code = 'MAPA3A' LIMIT 1")
          .get();
        const token = tokenFor({
          sub: String(studentRow.id),
          role: 'student',
          schoolId: studentRow.school_id,
          groupId: studentRow.group_id,
        });
        const list = await seedApi.call('GET', `/api/v1/diagnostics/students/${studentRow.id}/assignments`, { token });
        assert.equal(list.status, 200);
        assert.equal(list.body.meta.count, 6);
        const paper = list.body.data.find((a) => a.modality === 'paper');
        assert.equal(paper.isScreenLocked, true);
        const startPaper = await seedApi.call('GET', `/api/v1/diagnostics/assignments/${paper.id}/start`, { token });
        assert.equal(startPaper.status, 409);
        assert.equal(startPaper.body.error.code, 'SCREEN_LOCKED');
      } finally {
        await seedApi.close();
        seedDb.close();
      }
    });
  });
});
