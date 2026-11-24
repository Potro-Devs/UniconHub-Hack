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

function assertNoLeak(payload) {
  const json = JSON.stringify(payload);
  for (const forbidden of ['internal_folio', 'internalFolio', 'AXI-', 'is_correct', 'isCorrect', 'errorTag', 'errorExplanation', 'error_tag', 'error_explanation']) {
    assert.ok(!json.includes(forbidden), `no debe exponer ${forbidden}`);
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
      for (const [method, path, body] of [
        ['GET', `/api/v1/diagnostics/students/${fx.ids.sofia}/assignments`],
        ['GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, { questionId: 1, selectedOptionId: 1 }],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/complete`],
      ]) {
        const res = await api.call(method, path, { body });
        assert.equal(res.status, 401);
        assert.equal(res.body.error.code, 'AUTH_REQUIRED');
      }
    });

    test('docente y director reciben 403 en todo', async () => {
      for (const token of [fx.tokens.teacherA, fx.tokens.directorA]) {
        for (const [method, path, body] of [
          ['GET', `/api/v1/diagnostics/students/${fx.ids.sofia}/assignments`],
          ['GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`],
          ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, { questionId: 1, selectedOptionId: 1 }],
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
      }
    });
  });

  describe('listado, inicio y respuesta de pruebas', () => {
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

    test('GET /assignments/:id/start pasa a in_progress, oculta respuestas y conserva progreso al reabrir', async () => {
      const start1 = await api.call('GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`, {
        token: fx.tokens.sofia,
      });
      assert.equal(start1.status, 200);
      assertNoLeak(start1.body);
      assert.equal(start1.body.data.assignment.status, 'in_progress');
      assert.ok(start1.body.data.assignment.startedAt);
      assert.equal(start1.body.data.questions.length, 3);
      assert.deepEqual(start1.body.data.questions[0].hints, ['Pista 1', 'Pista 2', 'Pista 3']);
      assert.equal(start1.body.data.questions[0].answered, false);

      const q0 = fx.questions.frac[0];
      const ans = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: q0.id, selectedOptionId: q0.correctOptionId, maxHintLevelUsed: 1 },
      });
      assert.equal(ans.status, 200);
      assert.equal(ans.body.data.outcomeStatus, 'achieved_with_support');
      assert.equal(ans.body.data.answeredCount, 1);

      const start2 = await api.call('GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`, {
        token: fx.tokens.sofia,
      });
      assert.equal(start2.status, 200);
      assert.equal(start2.body.data.assignment.answeredCount, 1);
      assert.equal(start2.body.data.questions[0].answered, true);
      assert.equal(start2.body.data.questions[0].selectedOptionId, q0.correctOptionId);
      assert.equal(start2.body.data.questions[0].maxHintLevelUsed, 1);
      assert.equal(start2.body.data.questions[1].answered, false);
    });

    test('bloqueo papel (409 SCREEN_LOCKED) y prueba cerrada (422 ASSIGNMENT_CLOSED)', async () => {
      for (const [method, path, body] of [
        ['GET', `/api/v1/diagnostics/assignments/${fx.ids.paperA}/start`],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.paperA}/answer`, { questionId: 1, selectedOptionId: 1 }],
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

    test('POST /answer clasifica autónomo, con apoyo e incorrecto con feedback no punitivo, y rechaza duplicados/inválidos', async () => {
      const [q0, q1, q2] = fx.questions.frac;
      const r0 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: q0.id, selectedOptionId: q0.correctOptionId },
      });
      assert.equal(r0.status, 200);
      assert.equal(r0.body.data.outcomeStatus, 'correct_autonomous');
      assert.equal(r0.body.data.isCorrect, true);

      const r1 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: q1.id, selectedOptionId: q1.correctOptionId, maxHintLevelUsed: 2 },
      });
      assert.equal(r1.status, 200);
      assert.equal(r1.body.data.outcomeStatus, 'achieved_with_support');
      assert.equal(r1.body.data.isCorrect, true);

      const r2 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: q2.id, selectedOptionId: q2.wrongOptionId, maxHintLevelUsed: 3 },
      });
      assert.equal(r2.status, 200);
      assert.equal(r2.body.data.outcomeStatus, 'incorrect');
      assert.equal(r2.body.data.isCorrect, false);
      for (const banned of ['reprobado', 'malo', 'deficiente', 'bajo']) {
        assert.ok(!r2.body.data.feedback.toLowerCase().includes(banned));
      }

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
        { questionId: q0.id, selectedOptionId: q0.correctOptionId, maxHintLevelUsed: 4 },
        { questionId: q0.id, selectedOptionId: q0.correctOptionId, maxHintLevelUsed: null },
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
    test('POST /complete registra unanswered, corta promedio ponderado multisesión, guarda logros y bloquea reintento', async () => {
      // Sesión 1 (screenA): 1 autónomo, 1 con apoyo, 1 sin responder → 33.33% autónomo
      const [f0, f1] = fx.questions.frac.slice(0, 3);
      await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: f0.id, selectedOptionId: f0.correctOptionId, maxHintLevelUsed: 0 },
      });
      await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, {
        token: fx.tokens.sofia,
        body: { questionId: f1.id, selectedOptionId: f1.correctOptionId, maxHintLevelUsed: 2 },
      });

      const comp1 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/complete`, {
        token: fx.tokens.sofia,
      });
      assert.equal(comp1.status, 200);
      assert.equal(comp1.body.data.status, 'completed_screen');
      assert.ok(comp1.body.data.completedAt);
      assert.deepEqual(comp1.body.data.summary, {
        total: 3,
        correctAutonomous: 1,
        achievedWithSupport: 1,
        incorrect: 0,
        unanswered: 1,
        autonomousPercentage: 33.33,
        supportedPercentage: 33.33,
      });
      assert.equal(comp1.body.data.skills[0].masteryPercentage, 33.33);
      assert.equal(comp1.body.data.skills[0].masteryLevel, 'in_progress');
      assert.ok(comp1.body.data.celebrations.some((c) => c.code === 'block_completed' && c.size === 'small'));

      // El listado excluye reactivos omitidos (`unanswered`) de `answeredCount`
      const afterComp1 = await api.call('GET', `/api/v1/diagnostics/students/${fx.ids.sofia}/assignments`, {
        token: fx.tokens.sofia,
      });
      const listedScreenA = afterComp1.body.data.find((a) => a.id === fx.ids.screenA);
      assert.equal(listedScreenA.questionCount, 3);
      assert.equal(listedScreenA.answeredCount, 2);

      // Bloquea re-apertura, respuesta y re-cierre tras completar
      for (const [method, path, body] of [
        ['GET', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/start`],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/answer`, { questionId: f0.id, selectedOptionId: f0.correctOptionId }],
        ['POST', `/api/v1/diagnostics/assignments/${fx.ids.screenA}/complete`],
      ]) {
        const res = await api.call(method, path, { token: fx.tokens.sofia, body });
        assert.equal(res.status, 409);
        assert.equal(res.body.error.code, 'ALREADY_COMPLETED');
      }

      // Sesión 2 (screenMulti): 3/3 autónomos en fracciones (100%) + 0/3 en multiplicación (0%)
      for (const q of fx.questions.frac.slice(3, 6)) {
        await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenMulti}/answer`, {
          token: fx.tokens.sofia,
          body: { questionId: q.id, selectedOptionId: q.correctOptionId },
        });
      }
      const comp2 = await api.call('POST', `/api/v1/diagnostics/assignments/${fx.ids.screenMulti}/complete`, {
        token: fx.tokens.sofia,
      });
      assert.equal(comp2.status, 200);
      assert.equal(comp2.body.data.skills.length, 2);
      // Promedio ponderado fracciones: (1 * 33.33 + 2 * 100) / 3 = 77.78
      assert.equal(comp2.body.data.skills[0].code, 'fractions');
      assert.equal(comp2.body.data.skills[0].masteryPercentage, 77.78);
      assert.equal(comp2.body.data.skills[0].masteryLevel, 'mastered');
      assert.equal(comp2.body.data.skills[1].code, 'multiplication');
      assert.equal(comp2.body.data.skills[1].unanswered, 3);
      assert.equal(comp2.body.data.skills[1].masteryPercentage, 0);

      const cuts = fx.db
        .prepare('SELECT session_index, mastery_percentage FROM skill_mastery_history WHERE student_id = ? ORDER BY id')
        .all(fx.ids.sofia);
      assert.equal(cuts.length, 3);
      assert.equal(cuts[1].session_index, 2);
      assert.equal(cuts[1].mastery_percentage, 77.78);

      const achCount = fx.db
        .prepare('SELECT COUNT(*) AS n FROM student_achievements WHERE student_id = ?')
        .get(fx.ids.sofia).n;
      assert.ok(achCount >= 3);
    });

    test('atomicidad: si falla la inserción de un logro al cerrar, no queda nada guardado', () => {
      const baseRepo = createDiagnosticsRepository(fx.db);
      const failingRepo = {
        ...baseRepo,
        insertAchievement: () => {
          throw new Error('fallo simulado');
        },
      };
      const service = createDiagnosticsService({
        repository: failingRepo,
        groupsRepository: createGroupsRepository(fx.db),
        transaction: (fn) => withTransaction(fx.db, fn),
      });
      const auth = { sub: String(fx.ids.sofia), role: 'student', schoolId: fx.ids.schoolA, groupId: fx.ids.groupA };

      assert.throws(() => service.completeAssignment(auth, fx.ids.screenA), /fallo simulado/);
      assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM skill_mastery_history').get().n, 0);
      assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM student_responses').get().n, 0);
      const target = fx.db
        .prepare('SELECT status FROM assignment_targets WHERE assignment_id = ? AND student_id = ?')
        .get(fx.ids.screenA, fx.ids.sofia);
      assert.equal(target.status, 'pending');
    });

    test('consistencia con el seed: el primer alumno demo ve sus 5 pruebas y la de papel está bloqueada', async () => {
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
        assert.equal(list.body.meta.count, 5);
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
