/**
 * Casos límite del módulo assessments que no cubre `assessments.test.js`:
 * regla de 3 con la forma `skills`, bloqueo en papel con `studentIds`, aislamiento entre escuelas,
 * alumno que cambió de grupo, privacidad en todos los endpoints, robustez de entradas,
 * atomicidad con la base real y consistencia de `targetCounts` con el seed.
 * Datos ficticios; no es contenido pedagógico.
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import { MAX_QUESTIONS_PER_ASSIGNMENT, MAX_TARGETS_PER_ASSIGNMENT } from '../src/modules/assessments/assessments.domain.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

const SKILLS = ['fractions', 'multiplication', 'place_value', 'problem_solving', 'reading_comprehension'];

/**
 * Escuela A: docente A (3.º A y 3.º C), docente B (3.º B). Escuela B: docente Z (3.º Z) y director Z.
 * Banco: 3.º fractions ×4, multiplication ×2, place_value ×3, problem_solving ×1.
 * Pablo: `completed` en 3.º A y `active` en 3.º C (cambio de grupo).
 */
function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const schoolA = id("INSERT INTO schools (name) VALUES ('Escuela A')");
  const schoolB = id("INSERT INTO schools (name) VALUES ('Escuela B')");
  const user = (school, email, role) =>
    id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, '$2a$10$hashficticio', 'Persona Demo', ?)", school, email, role);
  const teacherA = user(schoolA, 'a@axi.test', 'teacher');
  const teacherB = user(schoolA, 'b@axi.test', 'teacher');
  const teacherZ = user(schoolB, 'z@axi.test', 'teacher');
  const directorZ = user(schoolB, 'dir-z@axi.test', 'director');

  const group = (school, teacher, section, code) =>
    id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, ?, '2026-2027', ?)",
      school, teacher, section, code);
  const groupA = group(schoolA, teacherA, 'A', 'GRP03A');
  const groupB = group(schoolA, teacherB, 'B', 'GRP03B');
  const groupC = group(schoolA, teacherA, 'C', 'GRP03C');
  const groupZ = group(schoolB, teacherZ, 'Z', 'GRP03Z');

  const names = [];
  const student = (school, first, last, initials, folio) => {
    names.push(`${first} ${last}`);
    return id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, '#F4B6C2')",
      school, folio, first, last, initials);
  };
  const enroll = (g, s, status = 'active') =>
    db.prepare('INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, ?)').run(g, s, status);

  const groupAStudents = [];
  for (let i = 0; i < 5; i += 1) {
    const sid = student(schoolA, `Nombre${i}`, `Apellido${i} Ficticio`, 'NA', `AXI-A000000${i}`);
    enroll(groupA, sid);
    groupAStudents.push(sid);
  }
  const pablo = student(schoolA, 'Pablo', 'Cambio Grupo', 'PC', 'AXI-PABLO001');
  enroll(groupA, pablo, 'completed');
  enroll(groupC, pablo, 'active');
  const bruno = student(schoolA, 'Bruno', 'Otro Grupo', 'BO', 'AXI-BRUNO001');
  enroll(groupB, bruno);
  const zoe = student(schoolB, 'Zoe', 'Otra Escuela', 'ZO', 'AXI-ZOE00001');
  enroll(groupZ, zoe);

  const skill = Object.fromEntries(SKILLS.map((code) => [code, id('INSERT INTO skills (code, name) VALUES (?, ?)', code, code)]));
  const q = {};
  const question = (code, n) => {
    for (let i = 1; i <= n; i += 1) {
      const qid = id(
        "INSERT INTO questions (skill_id, grade, stem, hint_1, hint_2, hint_3) VALUES (?, 3, ?, 'Pista 1', 'Pista 2', 'Pista 3')",
        skill[code], `Reactivo de prueba ${code}-${i}`,
      );
      db.prepare("INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'A', 'Correcta', 1)").run(qid);
      db.prepare("INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, 'B', 'Distractor', 0, 'tag', 'Explicación')").run(qid);
      (q[code] ??= []).push(qid);
    }
  };
  question('fractions', 4);
  question('multiplication', 2);
  question('place_value', 3);
  question('problem_solving', 1);

  const staff = (sub, role, schoolId) => tokenFor({ sub: String(sub), role, schoolId });
  return {
    db,
    q,
    names,
    ids: { schoolA, schoolB, groupA, groupB, groupC, groupZ, groupAStudents, pablo, bruno, zoe },
    tokens: {
      teacherA: staff(teacherA, 'teacher', schoolA),
      teacherB: staff(teacherB, 'teacher', schoolA),
      teacherZ: staff(teacherZ, 'teacher', schoolB),
      directorZ: staff(directorZ, 'director', schoolB),
    },
  };
}

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

/** Falla si el JSON contiene folio, hash, nombres de alumnos o el campo `password_hash`. */
function assertPrivate(body, names, label) {
  const text = JSON.stringify(body);
  for (const bad of ['internal_folio', 'internalFolio', 'AXI-', 'password', '$2a$', 'first_names', 'last_names', 'firstNames', 'lastNames', 'curp', 'CURP']) {
    assert.ok(!text.includes(bad), `${label}: expone "${bad}"`);
  }
  for (const name of names) assert.ok(!text.includes(name), `${label}: expone el nombre "${name}"`);
}

describe('assessments · casos límite', () => {
  let fx;
  let api;
  const path = (groupId) => `/api/v1/assessments/groups/${groupId}/assignments`;
  const create = (body, { token = fx.tokens.teacherA, groupId = fx.ids.groupA } = {}) =>
    api.call('POST', path(groupId), { token, body });
  const body = (overrides = {}) => ({ title: 'Prueba', modality: 'screen', skills: ['fractions'], ...overrides });

  beforeEach(async () => {
    fx = createFixtures();
    api = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });

  afterEach(async () => {
    await api.close();
    fx.db.close();
  });

  describe('regla de 3 reactivos por habilidad (§4.1)', () => {
    test('skills con una habilidad en 2 y otra en 4 → 422 solo con la de 2, sin crear nada', async () => {
      const res = await create(body({ skills: ['multiplication', 'fractions'] }));
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'INSUFFICIENT_QUESTIONS_PER_SKILL');
      assert.deepEqual(res.body.error.details.insufficient, [{ skill: 'multiplication', count: 2, missing: 1 }]);
      assert.equal(count(fx.db, 'assignments'), 0);
    });

    test('skills con exactamente 3 reactivos → 201', async () => {
      const res = await create(body({ skills: ['place_value'] }));
      assert.equal(res.status, 201);
      assert.deepEqual(res.body.data.skills.map((s) => [s.code, s.questionCount]), [['place_value', 3]]);
    });

    test('skills: el grado solo tiene 1 reactivo de la habilidad → 422 con missing 2', async () => {
      const res = await create(body({ skills: ['problem_solving'] }));
      assert.equal(res.status, 422);
      assert.deepEqual(res.body.error.details.insufficient, [{ skill: 'problem_solving', count: 1, missing: 2 }]);
    });

    test('questionIds: 3 + 4 → 201; 3 + 2 de otra habilidad → 422 solo con la de 2', async () => {
      const ok = await create(body({ skills: undefined, questionIds: [...fx.q.place_value, ...fx.q.fractions] }));
      assert.equal(ok.status, 201);
      const bad = await create(body({ skills: undefined, questionIds: [...fx.q.fractions, ...fx.q.multiplication] }));
      assert.equal(bad.status, 422);
      assert.deepEqual(bad.body.error.details.insufficient, [{ skill: 'multiplication', count: 2, missing: 1 }]);
      assert.equal(count(fx.db, 'assignments'), 1);
    });
  });

  describe('bloqueo pantalla/papel (§4.9)', () => {
    test('papel con studentIds: solo esos destinatarios y todos con is_screen_locked = 1', async () => {
      const chosen = fx.ids.groupAStudents.slice(0, 3);
      const res = await create(body({ modality: 'paper', studentIds: chosen }));
      assert.equal(res.status, 201);
      const rows = fx.db.prepare('SELECT student_id, status, is_screen_locked FROM assignment_targets WHERE assignment_id = ?')
        .all(res.body.data.id);
      assert.deepEqual(rows.map((r) => r.student_id).sort(), [...chosen].sort());
      assert.ok(rows.every((r) => r.is_screen_locked === 1 && r.status === 'pending'));
      assert.ok(res.body.data.targets.every((t) => t.isScreenLocked === true));
    });

    test('pantalla con studentIds: todos con is_screen_locked = 0', async () => {
      const res = await create(body({ studentIds: fx.ids.groupAStudents.slice(0, 2) }));
      assert.equal(res.status, 201);
      const rows = fx.db.prepare('SELECT is_screen_locked FROM assignment_targets WHERE assignment_id = ?').all(res.body.data.id);
      assert.equal(rows.length, 2);
      assert.ok(rows.every((r) => r.is_screen_locked === 0));
    });
  });

  describe('aislamiento', () => {
    test('detalle de otra escuela u otra docente → 404 idéntico al de un id inexistente', async () => {
      const own = await create(body());
      const foreign = await create(body(), { token: fx.tokens.teacherZ, groupId: fx.ids.groupZ });
      assert.equal(foreign.status, 201);
      const missing = await api.call('GET', '/api/v1/assessments/assignments/999999', { token: fx.tokens.teacherA });
      assert.equal(missing.status, 404);

      for (const [token, assignmentId, label] of [
        [fx.tokens.teacherA, foreign.body.data.id, 'docente A → escuela B'],
        [fx.tokens.teacherB, own.body.data.id, 'docente B → grupo de A'],
        [fx.tokens.teacherZ, own.body.data.id, 'docente Z → escuela A'],
        [fx.tokens.directorZ, own.body.data.id, 'director Z → escuela A'],
      ]) {
        const res = await api.call('GET', `/api/v1/assessments/assignments/${assignmentId}`, { token });
        assert.equal(res.status, 404, label);
        assert.deepEqual(res.body, missing.body, label);
      }
    });

    test('director de otra escuela: 404 al listar y 403 al asignar; docente de otra escuela: 404 al asignar', async () => {
      const list = await api.call('GET', path(fx.ids.groupA), { token: fx.tokens.directorZ });
      assert.equal(list.status, 404);
      assert.equal(list.body.error.code, 'GROUP_NOT_FOUND');
      const post = await create(body(), { token: fx.tokens.directorZ });
      assert.equal(post.status, 403);
      const postZ = await create(body(), { token: fx.tokens.teacherZ });
      assert.equal(postZ.status, 404);
      assert.equal(count(fx.db, 'assignments'), 0);
    });

    test('alumno que cambió de grupo (completed en A, activo en C) no es destinatario en A', async () => {
      const explicit = await create(body({ studentIds: [fx.ids.groupAStudents[0], fx.ids.pablo] }));
      assert.equal(explicit.status, 400);
      assert.deepEqual(explicit.body.error.details, { invalidStudentIds: [fx.ids.pablo] });

      const all = await create(body());
      assert.equal(all.status, 201);
      assert.ok(!all.body.data.targets.some((t) => t.studentId === fx.ids.pablo), 'no se incluye por defecto');
      assert.equal(all.body.data.targetCounts.total, fx.ids.groupAStudents.length);

      const inC = await create(body({ studentIds: [fx.ids.pablo] }), { groupId: fx.ids.groupC });
      assert.equal(inC.status, 201, 'sí es destinatario en su grupo actual');
    });

    test('alumno de otra escuela como destinatario → 400 invalidStudentIds', async () => {
      const res = await create(body({ studentIds: [fx.ids.zoe] }));
      assert.equal(res.status, 400);
      assert.deepEqual(res.body.error.details, { invalidStudentIds: [fx.ids.zoe] });
    });
  });

  test('privacidad: ningún endpoint expone folio, hash ni nombres de alumnos', async () => {
    const created = await create(body({ modality: 'paper', skills: ['fractions', 'place_value'] }));
    const responses = {
      create: created,
      questions: await api.call('GET', '/api/v1/assessments/questions', { token: fx.tokens.teacherA }),
      list: await api.call('GET', path(fx.ids.groupA), { token: fx.tokens.teacherA }),
      detail: await api.call('GET', `/api/v1/assessments/assignments/${created.body.data.id}`, { token: fx.tokens.teacherA }),
      invalidStudents: await create(body({ studentIds: [fx.ids.zoe, fx.ids.pablo] })),
      notFound: await api.call('GET', `/api/v1/assessments/assignments/${created.body.data.id}`, { token: fx.tokens.teacherZ }),
    };
    for (const [label, res] of Object.entries(responses)) {
      assert.ok(res.status < 500, label);
      assertPrivate(res.body, fx.names, label);
      // Formato estándar.
      // `meta` es opcional en todo el proyecto (sendData lo omite si no hay); los listados sí lo traen.
      if (res.status < 400) assert.deepEqual(Object.keys(res.body).filter((k) => k !== 'meta'), ['data'], `${label}: { data, meta? }`);
      else assert.deepEqual(Object.keys(res.body), ['error'], `${label}: { error }`);
    }
  });

  describe('robustez de entradas', () => {
    test('ids de ruta enormes, negativos, NaN o con signos → 400; 15 dígitos inexistente → 404', async () => {
      for (const raw of ['9999999999999999', '99999999999999999999', '-5', 'NaN', 'Infinity', '1e3', '+1', '0x10', '%20']) {
        for (const p of [`/api/v1/assessments/assignments/${raw}`, path(raw)]) {
          const res = await api.call('GET', p, { token: fx.tokens.teacherA });
          assert.equal(res.status, 400, p);
          assert.equal(res.body.error.code, 'VALIDATION_ERROR', p);
        }
        const post = await create(body(), { groupId: raw });
        assert.equal(post.status, 400, `POST ${raw}`);
      }
      const big = await api.call('GET', '/api/v1/assessments/assignments/999999999999999', { token: fx.tokens.teacherA });
      assert.equal(big.status, 404);
    });

    test(`questionIds con ${MAX_QUESTIONS_PER_ASSIGNMENT + 1} → 400 con details.max; studentIds con ${MAX_TARGETS_PER_ASSIGNMENT + 1} → 400`, async () => {
      const many = (n) => Array.from({ length: n }, (_, i) => i + 1);
      const q = await create(body({ skills: undefined, questionIds: many(MAX_QUESTIONS_PER_ASSIGNMENT + 1) }));
      assert.equal(q.status, 400);
      assert.equal(q.body.error.details.max, MAX_QUESTIONS_PER_ASSIGNMENT);
      const s = await create(body({ studentIds: many(MAX_TARGETS_PER_ASSIGNMENT + 1) }));
      assert.equal(s.status, 400);
      assert.equal(s.body.error.code, 'VALIDATION_ERROR');
      assert.equal(s.body.error.details.max, MAX_TARGETS_PER_ASSIGNMENT);
      assert.equal(count(fx.db, 'assignments'), 0);
    });

    test('studentIds y questionIds con valores no enteros o fuera de rango → 400', async () => {
      for (const ids of [[0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 2], [null], [true], [[1]]]) {
        const s = await create(body({ studentIds: ids }));
        assert.equal(s.status, 400, `studentIds ${JSON.stringify(ids)}`);
        const q = await create(body({ skills: undefined, questionIds: ids }));
        assert.equal(q.status, 400, `questionIds ${JSON.stringify(ids)}`);
      }
      assert.equal(count(fx.db, 'assignments'), 0);
    });

    test('title: espacios, tabuladores y saltos de línea → 400; espacios internos se normalizan', async () => {
      for (const title of ['', ' ', '\t\n  \r', null]) {
        const res = await create(body({ title }));
        assert.equal(res.status, 400, JSON.stringify(title));
      }
      const ok = await create(body({ title: '  Fracciones \n  semana   1 ' }));
      assert.equal(ok.status, 201);
      assert.equal(ok.body.data.title, 'Fracciones semana 1');
    });

    test('query params repetidos o con forma de arreglo/objeto → 400', async () => {
      for (const qs of ['grade=3&grade=4', 'grade=3&grade=3', 'skill=fractions&skill=place_value', 'grade[]=3', 'grade[a]=3', 'skill[]=fractions', 'grade=', 'grade=%203x']) {
        const res = await api.call('GET', `/api/v1/assessments/questions?${qs}`, { token: fx.tokens.teacherA });
        // `grade[]=3` puede ignorarse si el parser no anida; en ese caso debe responder 200 sin filtrar mal.
        if (res.status === 200) {
          assert.ok(qs.includes('[]') || qs.includes('[a]'), `${qs} → 200 inesperado`);
          assert.equal(res.body.meta.count, 10, `${qs}: si se ignora, devuelve todo el banco`);
        } else {
          assert.equal(res.status, 400, qs);
          assert.equal(res.body.error.code, 'VALIDATION_ERROR', qs);
        }
      }
    });

    test('cuerpo que no es objeto JSON → 400 sin 500 ni registros', async () => {
      for (const raw of ['"hola"', '42', 'null', 'true', '[]', '[1,2]', '{"title":', '']) {
        const res = await api.call('POST', path(fx.ids.groupA), { token: fx.tokens.teacherA, raw });
        assert.equal(res.status, 400, `raw ${JSON.stringify(raw)}`);
        assert.ok(['VALIDATION_ERROR', 'INVALID_JSON'].includes(res.body.error.code), `raw ${JSON.stringify(raw)}`);
      }
      assert.equal(count(fx.db, 'assignments'), 0);
    });

    test('campos extra o prototipo en el cuerpo no alteran el resultado', async () => {
      const extra = JSON.stringify({ ...body(), status: 'closed', groupId: fx.ids.groupZ, createdBy: 999 });
      const raw = `${extra.slice(0, -1)},"__proto__":{"modality":"paper","studentIds":[${fx.ids.zoe}]}}`;
      const res = await api.call('POST', path(fx.ids.groupA), { token: fx.tokens.teacherA, raw });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.status, 'active');
      assert.equal(res.body.data.groupId, fx.ids.groupA);
      assert.equal(res.body.data.modality, 'screen');
    });
  });

  test('atomicidad con la base real: si un INSERT de destinatario falla, no queda nada (500 genérico)', async () => {
    const victim = fx.ids.groupAStudents[3];
    fx.db.exec(`CREATE TRIGGER fail_target BEFORE INSERT ON assignment_targets
      WHEN NEW.student_id = ${victim} BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END;`);
    const res = await create(body({ modality: 'paper' }));
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } });
    assert.equal(count(fx.db, 'assignments'), 0);
    assert.equal(count(fx.db, 'assignment_questions'), 0);
    assert.equal(count(fx.db, 'assignment_targets'), 0);

    // La conexión sigue usable después del ROLLBACK.
    fx.db.exec('DROP TRIGGER fail_target');
    const retry = await create(body({ modality: 'paper' }));
    assert.equal(retry.status, 201);
    assert.equal(retry.body.data.targetCounts.total, fx.ids.groupAStudents.length);
  });
});

describe('assessments · consistencia con el seed', () => {
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

  test('targetCounts, questionCount y skills de las 5 pruebas demo cuadran con la base', async () => {
    const res = await api.call('GET', `/api/v1/assessments/groups/${groupId}/assignments`, { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 5);
    const active = db.prepare("SELECT COUNT(*) AS n FROM group_enrollments WHERE group_id = ? AND status = 'active'").get(groupId).n;
    assert.equal(active, 45);

    for (const a of res.body.data) {
      const rows = db.prepare('SELECT status, COUNT(*) AS n FROM assignment_targets WHERE assignment_id = ? GROUP BY status').all(a.id);
      const expected = { total: 0, pending: 0, in_progress: 0, completed_screen: 0, completed_paper: 0 };
      for (const r of rows) {
        expected[r.status] += r.n;
        expected.total += r.n;
      }
      assert.deepEqual(a.targetCounts, expected, a.title);
      assert.equal(a.targetCounts.total, 45, `${a.title}: los 45 alumnos`);
      const qn = db.prepare('SELECT COUNT(*) AS n FROM assignment_questions WHERE assignment_id = ?').get(a.id).n;
      assert.equal(a.questionCount, qn, a.title);
      assert.ok(a.skills.every((s) => s.questionCount >= 3), `${a.title}: ≥ 3 por habilidad`);

      if (a.modality === 'screen') assert.equal(a.targetCounts.completed_screen, 45, a.title);
      const locks = db.prepare('SELECT DISTINCT is_screen_locked AS l FROM assignment_targets WHERE assignment_id = ?').all(a.id).map((r) => r.l);
      assert.deepEqual(locks, [a.modality === 'paper' ? 1 : 0], `${a.title}: bloqueo según modalidad`);
    }
  });

  test('ninguna respuesta del seed expone nombres de los 45 alumnos ni folios', async () => {
    const names = db.prepare('SELECT first_names || \' \' || last_names AS n FROM students').all().map((r) => r.n);
    const list = await api.call('GET', `/api/v1/assessments/groups/${groupId}/assignments`, { token });
    const bank = await api.call('GET', '/api/v1/assessments/questions', { token });
    assertPrivate(list.body, names, 'list');
    assertPrivate(bank.body, names, 'questions');
    for (const a of list.body.data) {
      const detail = await api.call('GET', `/api/v1/assessments/assignments/${a.id}`, { token });
      assertPrivate(detail.body, names, `detail ${a.id}`);
    }
  });
});
