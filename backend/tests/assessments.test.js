import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase, withTransaction } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import { MAX_QUESTIONS_PER_ASSIGNMENT, MAX_TITLE_LENGTH } from '../src/modules/assessments/assessments.domain.js';
import { createAssessmentsRepository } from '../src/modules/assessments/assessments.repository.js';
import { createAssessmentsService } from '../src/modules/assessments/assessments.service.js';
import { createGroupsRepository } from '../src/modules/groups/groups.repository.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * Escuela A: docente A (3.º A), docente B (4.º B) y director A. Escuela B: director B.
 * Banco mínimo de prueba (datos ficticios, no es contenido pedagógico):
 *   3.º: fractions ×4, multiplication ×2, place_value ×3 · 4.º: fractions ×3.
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

  const group = (school, teacher, grade, section, code) =>
    id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, ?, ?, '2026-2027', ?)",
      school, teacher, grade, section, code);
  const groupA = group(schoolA, teacherA, 3, 'A', 'MAPA3A');
  const groupB = group(schoolA, teacherB, 4, 'B', 'MAPA4B');

  const student = (first, last, initials, folio) =>
    id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, '#F4B6C2')",
      schoolA, folio, first, last, initials);
  const sofia = student('Sofía', 'Ramírez García', 'SR', 'AXI-AAAAAAAA');
  const mateo = student('Mateo', 'Hernández López', 'MH', 'AXI-BBBBBBBB');
  const diego = student('Diego', 'Cruz Pérez', 'DC', 'AXI-CCCCCCCC');
  const lucia = student('Lucía', 'Torres Vega', 'LT', 'AXI-DDDDDDDD');
  const enroll = (g, s, status) => db.prepare('INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, ?)').run(g, s, status);
  enroll(groupA, sofia, 'active');
  enroll(groupA, mateo, 'active');
  enroll(groupA, diego, 'withdrawn');
  enroll(groupB, lucia, 'active');

  const skill = Object.fromEntries(
    [['fractions', 'Fracciones'], ['multiplication', 'Multiplicaciones'], ['place_value', 'Valor posicional'],
      ['problem_solving', 'Resolución de problemas'], ['reading_comprehension', 'Comprensión lectora']]
      .map(([code, name]) => [code, id('INSERT INTO skills (code, name) VALUES (?, ?)', code, name)]),
  );
  const q = {};
  const question = (grade, code, n) => {
    for (let i = 1; i <= n; i += 1) {
      const qid = id(
        "INSERT INTO questions (skill_id, grade, stem, hint_1, hint_2, hint_3) VALUES (?, ?, ?, 'Pista 1', 'Pista 2', 'Pista 3')",
        skill[code], grade, `Reactivo de prueba ${grade}-${code}-${i}`,
      );
      db.prepare("INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'A', 'Opción correcta', 1)").run(qid);
      db.prepare("INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, 'B', 'Distractor', 0, 'test_error', 'Explicación de prueba')").run(qid);
      (q[`${grade}:${code}`] ??= []).push(qid);
    }
  };
  question(3, 'fractions', 4);
  question(3, 'multiplication', 2);
  question(3, 'place_value', 3);
  question(4, 'fractions', 3);

  const staffToken = (sub, role, schoolId) => tokenFor({ sub: String(sub), role, schoolId });
  return {
    db,
    q,
    ids: { schoolA, teacherA, teacherB, directorA, groupA, groupB, sofia, mateo, diego, lucia },
    tokens: {
      teacherA: staffToken(teacherA, 'teacher', schoolA),
      teacherB: staffToken(teacherB, 'teacher', schoolA),
      directorA: staffToken(directorA, 'director', schoolA),
      directorB: staffToken(directorB, 'director', schoolB),
      sofia: tokenFor({ sub: String(sofia), role: 'student', schoolId: schoolA, groupId: groupA }),
    },
  };
}

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const assertNoSensitive = (body) => {
  const text = JSON.stringify(body);
  assert.ok(!text.includes('internal_folio') && !text.includes('internalFolio'), 'no expone el folio');
  assert.ok(!text.includes('AXI-'), 'no expone valores de folio');
  assert.ok(!text.includes('password'), 'no expone contraseñas');
};

describe('assessments API', () => {
  let fx;
  let api;
  let assignPath;

  beforeEach(async () => {
    fx = createFixtures();
    api = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
    assignPath = `/api/v1/assessments/groups/${fx.ids.groupA}/assignments`;
  });

  afterEach(async () => {
    await api.close();
    fx.db.close();
  });

  const createAs = (token, body, groupId = fx.ids.groupA) =>
    api.call('POST', `/api/v1/assessments/groups/${groupId}/assignments`, { token, body });
  const validBody = (overrides = {}) => ({ title: 'Fracciones · prueba', modality: 'screen', skills: ['fractions'], ...overrides });

  describe('sesión y roles', () => {
    test('sin sesión → 401 en todos los endpoints', async () => {
      for (const [method, path] of [
        ['GET', '/api/v1/assessments/questions'],
        ['GET', assignPath],
        ['POST', assignPath],
        ['GET', '/api/v1/assessments/assignments/1'],
      ]) {
        const res = await api.call(method, path, { body: method === 'POST' ? validBody() : undefined });
        assert.equal(res.status, 401, `${method} ${path}`);
        assert.equal(res.body.error.code, 'AUTH_REQUIRED');
      }
    });

    test('un alumno recibe 403 en todo (incluido el banco con respuestas)', async () => {
      const created = await createAs(fx.tokens.teacherA, validBody());
      for (const [method, path] of [
        ['GET', '/api/v1/assessments/questions'],
        ['GET', assignPath],
        ['POST', assignPath],
        ['GET', `/api/v1/assessments/assignments/${created.body.data.id}`],
      ]) {
        const res = await api.call(method, path, { token: fx.tokens.sofia, body: method === 'POST' ? validBody() : undefined });
        assert.equal(res.status, 403, `${method} ${path}`);
        assert.equal(res.body.error.code, 'FORBIDDEN');
      }
    });

    test('ids de ruta no válidos → 400', async () => {
      for (const path of [
        '/api/v1/assessments/groups/abc/assignments',
        '/api/v1/assessments/groups/0/assignments',
        '/api/v1/assessments/assignments/-1',
        '/api/v1/assessments/assignments/1.5',
      ]) {
        const res = await api.call('GET', path, { token: fx.tokens.teacherA });
        assert.equal(res.status, 400, path);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('GET /questions', () => {
    test('devuelve el banco con pistas, correcta y errores típicos', async () => {
      const { status, body } = await api.call('GET', '/api/v1/assessments/questions', { token: fx.tokens.teacherA });
      assert.equal(status, 200);
      assert.equal(body.meta.count, 12);
      const first = body.data[0];
      assert.deepEqual(Object.keys(first).sort(), ['contentId', 'difficulty', 'grade', 'hints', 'id', 'options', 'skill', 'stem', 'visual'].sort());
      assert.equal(first.hints.length, 3);
      assert.deepEqual(first.skill, { code: 'fractions', name: 'Fracciones' });
      assert.ok(first.options.every((o) => Number.isInteger(o.id) && o.id > 0), 'cada opción trae su id');
      assert.deepEqual(first.options.map(({ id, ...rest }) => rest), [
        { label: 'A', text: 'Opción correcta', isCorrect: true, errorTag: null, errorExplanation: null },
        { label: 'B', text: 'Distractor', isCorrect: false, errorTag: 'test_error', errorExplanation: 'Explicación de prueba' },
      ]);
    });

    test('filtra por grado y habilidad', async () => {
      const res = await api.call('GET', '/api/v1/assessments/questions?grade=3&skill=fractions', { token: fx.tokens.directorA });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data.map((x) => x.id), fx.q['3:fractions']);
      const byGrade = await api.call('GET', '/api/v1/assessments/questions?grade=4', { token: fx.tokens.teacherA });
      assert.deepEqual(byGrade.body.data.map((x) => x.id), fx.q['4:fractions']);
    });

    test('filtros inválidos → 400', async () => {
      for (const qs of ['grade=0', 'grade=7', 'grade=abc', 'grade=3.5', 'grade=3&grade=4', 'skill=geometry', 'skill=']) {
        const res = await api.call('GET', `/api/v1/assessments/questions?${qs}`, { token: fx.tokens.teacherA });
        assert.equal(res.status, 400, qs);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('POST /groups/:groupId/assignments', () => {
    test('con skills: todos los reactivos del grado del grupo, en orden estable', async () => {
      const { status, body } = await createAs(fx.tokens.teacherA, validBody({ skills: ['place_value', 'fractions'] }));
      assert.equal(status, 201);
      const d = body.data;
      assert.equal(d.title, 'Fracciones · prueba');
      assert.equal(d.modality, 'screen');
      assert.equal(d.status, 'active');
      assert.equal(d.questionCount, 7);
      assert.deepEqual(d.skills, [
        { code: 'place_value', name: 'Valor posicional', questionCount: 3 },
        { code: 'fractions', name: 'Fracciones', questionCount: 4 },
      ]);
      assert.deepEqual(d.questions.map((x) => x.id), [...fx.q['3:place_value'], ...fx.q['3:fractions']]);
      assert.deepEqual(d.questions.map((x) => x.position), [1, 2, 3, 4, 5, 6, 7]);
      // Solo alumnos activos: Diego está dado de baja.
      assert.deepEqual(d.targets.map((t) => t.studentId).sort(), [fx.ids.sofia, fx.ids.mateo].sort());
      assert.deepEqual(d.targetCounts, { total: 2, pending: 2, in_progress: 0, completed_screen: 0, completed_paper: 0 });
      assertNoSensitive(body);
    });

    test('con questionIds respeta el orden elegido y studentIds explícitos', async () => {
      const ids = [...fx.q['3:fractions']].reverse().slice(0, 3);
      const { status, body } = await createAs(fx.tokens.teacherA, validBody({ skills: undefined, questionIds: ids, studentIds: [fx.ids.mateo] }));
      assert.equal(status, 201);
      assert.deepEqual(body.data.questions.map((x) => x.id), ids);
      assert.deepEqual(body.data.targets, [{ studentId: fx.ids.mateo, status: 'pending', isScreenLocked: false }]);
    });

    test('en pantalla, sin bloqueo; en papel, todos pending con is_screen_locked = 1', async () => {
      const screen = await createAs(fx.tokens.teacherA, validBody());
      assert.ok(screen.body.data.targets.every((t) => t.status === 'pending' && t.isScreenLocked === false));

      const paper = await createAs(fx.tokens.teacherA, validBody({ modality: 'paper' }));
      assert.equal(paper.status, 201);
      assert.ok(paper.body.data.targets.every((t) => t.status === 'pending' && t.isScreenLocked === true));
      const rows = fx.db.prepare('SELECT status, is_screen_locked FROM assignment_targets WHERE assignment_id = ?').all(paper.body.data.id);
      assert.equal(rows.length, 2);
      assert.ok(rows.every((r) => r.status === 'pending' && r.is_screen_locked === 1));
    });

    describe('regla de 3 reactivos por habilidad', () => {
      test('2 reactivos de una habilidad (skills) → 422 con insufficient', async () => {
        const res = await createAs(fx.tokens.teacherA, validBody({ skills: ['fractions', 'multiplication'] }));
        assert.equal(res.status, 422);
        assert.equal(res.body.error.code, 'INSUFFICIENT_QUESTIONS_PER_SKILL');
        assert.deepEqual(res.body.error.details.insufficient, [{ skill: 'multiplication', count: 2, missing: 1 }]);
        assert.equal(count(fx.db, 'assignments'), 0);
      });

      test('1 reactivo (questionIds) → 422; 3 → 201', async () => {
        const one = await createAs(fx.tokens.teacherA, validBody({ skills: undefined, questionIds: [fx.q['3:fractions'][0]] }));
        assert.equal(one.status, 422);
        assert.deepEqual(one.body.error.details.insufficient, [{ skill: 'fractions', count: 1, missing: 2 }]);

        const mixed = await createAs(fx.tokens.teacherA, validBody({
          skills: undefined, questionIds: [...fx.q['3:place_value'], ...fx.q['3:fractions'].slice(0, 2)],
        }));
        assert.equal(mixed.status, 422);
        assert.deepEqual(mixed.body.error.details.insufficient, [{ skill: 'fractions', count: 2, missing: 1 }]);

        const three = await createAs(fx.tokens.teacherA, validBody({ skills: undefined, questionIds: fx.q['3:place_value'] }));
        assert.equal(three.status, 201);
        assert.equal(three.body.data.questionCount, 3);
      });

      test('habilidad sin reactivos en el grado → 422 con count 0 (no se descarta)', async () => {
        const res = await createAs(fx.tokens.teacherA, validBody({ skills: ['reading_comprehension'] }));
        assert.equal(res.status, 422);
        assert.equal(res.body.error.code, 'INSUFFICIENT_QUESTIONS_PER_SKILL');
        assert.deepEqual(res.body.error.details.insufficient, [{ skill: 'reading_comprehension', count: 0, missing: 3 }]);
      });

      test('una habilidad con reactivos y otra sin ninguno → 422 solo con la vacía, sin crear nada', async () => {
        const res = await createAs(fx.tokens.teacherA, validBody({ skills: ['fractions', 'problem_solving'] }));
        assert.equal(res.status, 422);
        assert.equal(res.body.error.code, 'INSUFFICIENT_QUESTIONS_PER_SKILL');
        assert.deepEqual(res.body.error.details.insufficient, [{ skill: 'problem_solving', count: 0, missing: 3 }]);
        assert.equal(count(fx.db, 'assignments'), 0);
        assert.equal(count(fx.db, 'assignment_questions'), 0);
        assert.equal(count(fx.db, 'assignment_targets'), 0);
      });

      test('mensajes de validación sin nombres técnicos; el campo va en details', async () => {
        const none = await createAs(fx.tokens.teacherA, validBody({ skills: undefined }));
        assert.equal(none.body.error.message, 'Elige al menos un reactivo o una habilidad.');
        const modality = await createAs(fx.tokens.teacherA, validBody({ modality: 'online' }));
        assert.equal(modality.body.error.message, 'Elige si la prueba será en pantalla o en papel.');
        assert.equal(modality.body.error.details.field, 'modality');
        const skill = await createAs(fx.tokens.teacherA, validBody({ skills: ['geometry'] }));
        assert.equal(skill.body.error.message, 'Elige una habilidad válida.');
        const ids = await createAs(fx.tokens.teacherA, validBody({ skills: undefined, questionIds: [] }));
        assert.equal(ids.body.error.details.field, 'questionIds');
        for (const res of [none, modality, skill, ids]) {
          assert.ok(!/questionIds|studentIds|skills|modality|screen|paper|geometry/.test(res.body.error.message), res.body.error.message);
        }
      });
    });

    describe('validaciones (400)', () => {
      const cases = () => [
        ['ambas formas', validBody({ questionIds: fx.q['3:fractions'] })],
        ['ninguna forma', validBody({ skills: undefined })],
        ['modalidad inválida', validBody({ modality: 'online' })],
        ['modalidad no texto', validBody({ modality: 1 })],
        ['título vacío', validBody({ title: '   ' })],
        ['título largo', validBody({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) })],
        ['título no texto', validBody({ title: 123 })],
        ['skills vacío', validBody({ skills: [] })],
        ['skills objeto', validBody({ skills: {} })],
        ['skills desconocida', validBody({ skills: ['geometry'] })],
        ['skills repetidas', validBody({ skills: ['fractions', 'fractions'] })],
        ['questionIds vacío', validBody({ skills: undefined, questionIds: [] })],
        ['questionIds objeto', validBody({ skills: undefined, questionIds: {} })],
        ['questionIds texto', validBody({ skills: undefined, questionIds: fx.q['3:fractions'].map(String) })],
        ['questionIds repetidos', validBody({ skills: undefined, questionIds: [...fx.q['3:place_value'], fx.q['3:place_value'][0]] })],
        ['questionIds demasiados', validBody({ skills: undefined, questionIds: Array.from({ length: MAX_QUESTIONS_PER_ASSIGNMENT + 1 }, (_, i) => i + 1) })],
        ['studentIds vacío', validBody({ studentIds: [] })],
        ['studentIds texto', validBody({ studentIds: [String(fx.ids.sofia)] })],
        ['studentIds repetidos', validBody({ studentIds: [fx.ids.sofia, fx.ids.sofia] })],
        ['cuerpo arreglo', []],
      ];

      test('rechaza entradas inválidas sin crear nada', async () => {
        for (const [label, body] of cases()) {
          const res = await createAs(fx.tokens.teacherA, body);
          assert.equal(res.status, 400, label);
          assert.equal(res.body.error.code, 'VALIDATION_ERROR', label);
        }
        assert.equal(count(fx.db, 'assignments'), 0);
      });

      test('reactivo de otro grado o inexistente → 400 con detalles', async () => {
        const res = await createAs(fx.tokens.teacherA, validBody({ skills: undefined, questionIds: [...fx.q['3:place_value'], fx.q['4:fractions'][0], 99999] }));
        assert.equal(res.status, 400);
        assert.deepEqual(res.body.error.details, { unknownQuestionIds: [99999], wrongGradeQuestionIds: [fx.q['4:fractions'][0]] });
      });

      test('alumno dado de baja o de otro grupo → 400 con invalidStudentIds', async () => {
        for (const sid of [fx.ids.diego, fx.ids.lucia, 99999]) {
          const res = await createAs(fx.tokens.teacherA, validBody({ studentIds: [fx.ids.sofia, sid] }));
          assert.equal(res.status, 400);
          assert.deepEqual(res.body.error.details, { invalidStudentIds: [sid] });
        }
        assert.equal(count(fx.db, 'assignments'), 0);
      });

      test('grupo sin alumnos activos → 422 NO_ACTIVE_STUDENTS', async () => {
        fx.db.prepare("UPDATE group_enrollments SET status = 'withdrawn' WHERE group_id = ?").run(fx.ids.groupA);
        const res = await createAs(fx.tokens.teacherA, validBody());
        assert.equal(res.status, 422);
        assert.equal(res.body.error.code, 'NO_ACTIVE_STUDENTS');
      });
    });
  });

  describe('lectura de asignaciones', () => {
    test('GET /groups/:groupId/assignments lista con habilidades y conteo por estado', async () => {
      const paper = await createAs(fx.tokens.teacherA, validBody({ title: 'Papel', modality: 'paper', skills: ['fractions', 'place_value'] }));
      fx.db.prepare("UPDATE assignment_targets SET status = 'completed_paper' WHERE assignment_id = ? AND student_id = ?")
        .run(paper.body.data.id, fx.ids.sofia);

      const { status, body } = await api.call('GET', assignPath, { token: fx.tokens.teacherA });
      assert.equal(status, 200);
      assert.equal(body.meta.count, 1);
      assert.deepEqual(body.data[0], {
        id: paper.body.data.id,
        groupId: fx.ids.groupA,
        title: 'Papel',
        modality: 'paper',
        status: 'active',
        createdAt: paper.body.data.createdAt,
        questionCount: 7,
        skills: [
          { code: 'fractions', name: 'Fracciones', questionCount: 4 },
          { code: 'place_value', name: 'Valor posicional', questionCount: 3 },
        ],
        targetCounts: { total: 2, pending: 1, in_progress: 0, completed_screen: 0, completed_paper: 1 },
      });
      assertNoSensitive(body);
    });

    test('GET /assignments/:id devuelve reactivos en orden y destinatarios', async () => {
      const created = await createAs(fx.tokens.teacherA, validBody({ modality: 'paper' }));
      const res = await api.call('GET', `/api/v1/assessments/assignments/${created.body.data.id}`, { token: fx.tokens.teacherA });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, created.body.data);
      assert.deepEqual(res.body.data.questions.map((x) => x.position), [1, 2, 3, 4]);
      assert.ok(res.body.data.targets.every((t) => Object.keys(t).sort().join() === 'isScreenLocked,status,studentId'));
      assertNoSensitive(res.body);
    });
  });

  describe('aislamiento', () => {
    test('la docente B no lista, no ve ni asigna en lo de A (404)', async () => {
      const created = await createAs(fx.tokens.teacherA, validBody());
      const list = await api.call('GET', assignPath, { token: fx.tokens.teacherB });
      assert.equal(list.status, 404);
      assert.equal(list.body.error.code, 'GROUP_NOT_FOUND');
      const detail = await api.call('GET', `/api/v1/assessments/assignments/${created.body.data.id}`, { token: fx.tokens.teacherB });
      assert.equal(detail.status, 404);
      assert.equal(detail.body.error.code, 'ASSIGNMENT_NOT_FOUND');
      const missing = await api.call('GET', '/api/v1/assessments/assignments/99999', { token: fx.tokens.teacherA });
      assert.deepEqual(missing.body, detail.body, 'inexistente y ajeno responden igual');
      const post = await createAs(fx.tokens.teacherB, validBody());
      assert.equal(post.status, 404);
      // 404 antes que 400: no revela que el grupo existe aunque el cuerpo sea inválido.
      const postInvalid = await createAs(fx.tokens.teacherB, {});
      assert.equal(postInvalid.status, 404);
      assert.equal(count(fx.db, 'assignments'), 1);
    });

    test('el director lee su escuela pero no asigna (403); otro director → 404', async () => {
      const created = await createAs(fx.tokens.teacherA, validBody());
      const list = await api.call('GET', assignPath, { token: fx.tokens.directorA });
      assert.equal(list.status, 200);
      assert.equal(list.body.data.length, 1);
      const detail = await api.call('GET', `/api/v1/assessments/assignments/${created.body.data.id}`, { token: fx.tokens.directorA });
      assert.equal(detail.status, 200);
      const post = await createAs(fx.tokens.directorA, validBody());
      assert.equal(post.status, 403);
      assert.equal(post.body.error.code, 'FORBIDDEN');

      const other = await api.call('GET', `/api/v1/assessments/assignments/${created.body.data.id}`, { token: fx.tokens.directorB });
      assert.equal(other.status, 404);
      const otherList = await api.call('GET', assignPath, { token: fx.tokens.directorB });
      assert.equal(otherList.status, 404);
    });
  });

  describe('atomicidad', () => {
    test('si falla a medias, no queda nada creado', () => {
      const repository = createAssessmentsRepository(fx.db);
      const failing = {
        ...repository,
        insertTargets: (assignmentId, studentIds, state) => {
          repository.insertTargets(assignmentId, studentIds.slice(0, 1), state);
          throw new Error('fallo simulado');
        },
      };
      const service = createAssessmentsService({
        repository: failing,
        groupsRepository: createGroupsRepository(fx.db),
        transaction: (fn) => withTransaction(fx.db, fn),
      });
      const auth = { sub: String(fx.ids.teacherA), role: 'teacher', schoolId: fx.ids.schoolA };
      assert.throws(() => service.createAssignment(auth, String(fx.ids.groupA), validBody()), /fallo simulado/);
      assert.equal(count(fx.db, 'assignments'), 0);
      assert.equal(count(fx.db, 'assignment_questions'), 0);
      assert.equal(count(fx.db, 'assignment_targets'), 0);
    });
  });
});

describe('assessments API con el seed demo', () => {
  let db;
  let api;
  let token;
  let groupId;

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    const teacher = db.prepare('SELECT id, school_id FROM users WHERE email = ?').get(DEMO.teacher.email);
    groupId = db.prepare('SELECT id FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode).id;
    token = tokenFor({ sub: String(teacher.id), role: 'teacher', schoolId: teacher.school_id });
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });

  after(async () => {
    await api.close();
    db.close();
  });

  test('banco de 3.º: 4 reactivos por habilidad con 4 opciones y 3 pistas', async () => {
    const res = await api.call('GET', '/api/v1/assessments/questions?grade=3', { token });
    assert.equal(res.body.meta.count, 20);
    assert.ok(res.body.data.every((q) => q.options.length === 4 && q.hints.length === 3));
    assert.ok(res.body.data.every((q) => q.options.filter((o) => o.isCorrect).length === 1));
  });

  test('3.º A lista 4 pruebas en pantalla cerradas, 1 práctica abierta y 1 en papel activa bloqueada', async () => {
    const res = await api.call('GET', `/api/v1/assessments/groups/${groupId}/assignments`, { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.meta.count, 6);
    const paper = res.body.data.filter((a) => a.modality === 'paper');
    assert.equal(paper.length, 1);
    assert.equal(paper[0].status, 'active');
    assert.deepEqual(paper[0].skills.map((s) => s.code), ['fractions']);
    assert.equal(paper[0].targetCounts.pending, paper[0].targetCounts.total);
    assert.equal(res.body.data.filter((a) => a.modality === 'screen' && a.status === 'closed').length, 4);
    const practice = res.body.data.filter((a) => a.modality === 'screen' && a.status === 'active');
    assert.equal(practice.length, 1);
    assert.deepEqual(practice[0].skills.map((s) => s.code), ['multiplication']);

    const detail = await api.call('GET', `/api/v1/assessments/assignments/${paper[0].id}`, { token });
    assert.ok(detail.body.data.targets.every((t) => t.isScreenLocked));
    assertNoSensitive(detail.body);
  });

  test('asignar todas las habilidades al grupo de 45 alumnos', async () => {
    const res = await api.call('POST', `/api/v1/assessments/groups/${groupId}/assignments`, {
      token,
      body: { title: 'Diagnóstico completo', modality: 'screen', skills: ['fractions', 'multiplication', 'place_value', 'problem_solving', 'reading_comprehension'] },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.questionCount, 20);
    assert.equal(res.body.data.targetCounts.total, 45);
  });
});
