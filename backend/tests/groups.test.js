import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { AVATAR_PALETTE, CODE_ALPHABET, MAX_BULK_LINES } from '../src/modules/groups/groups.domain.js';
import { createGroupsRepository } from '../src/modules/groups/groups.repository.js';
import { createGroupsService } from '../src/modules/groups/groups.service.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * Escuela A: docente A (grupo 3.º A), docente B (grupo 4.º B) y director A.
 * Escuela B: director B y grupo 5.º A sin docente. Datos ficticios.
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
  const groupOther = group(schoolB, null, 5, 'A', 'OTRA5A');

  const student = (school, first, last, initials, folio) =>
    id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, '#F4B6C2')",
      school, folio, first, last, initials);
  const sofia = student(schoolA, 'Sofía', 'Ramírez García', 'SR', 'AXI-AAAAAAAA');
  const mateo = student(schoolA, 'Mateo', 'Hernández López', 'MH', 'AXI-BBBBBBBB');
  const diego = student(schoolA, 'Diego', 'Cruz Pérez', 'DC', 'AXI-CCCCCCCC');
  const lucia = student(schoolA, 'Lucía', 'Torres Vega', 'LT', 'AXI-DDDDDDDD');

  const enroll = (g, s, status) => db.prepare('INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, ?)').run(g, s, status);
  enroll(groupA, sofia, 'active');
  enroll(groupA, mateo, 'active');
  enroll(groupA, diego, 'withdrawn');
  enroll(groupB, lucia, 'active');

  const staffToken = (sub, role, schoolId) => tokenFor({ sub: String(sub), role, schoolId });
  const studentToken = (sub, groupId) => tokenFor({ sub: String(sub), role: 'student', schoolId: schoolA, groupId });

  return {
    db,
    ids: { schoolA, schoolB, teacherA, teacherB, directorA, groupA, groupB, groupOther, sofia, mateo, diego, lucia },
    tokens: {
      teacherA: staffToken(teacherA, 'teacher', schoolA),
      teacherB: staffToken(teacherB, 'teacher', schoolA),
      directorA: staffToken(directorA, 'director', schoolA),
      directorB: staffToken(directorB, 'director', schoolB),
      sofia: studentToken(sofia, groupA),
      lucia: studentToken(lucia, groupB),
    },
  };
}

const countStudents = (db) => db.prepare('SELECT COUNT(*) AS n FROM students').get().n;
const assertNoSensitive = (body) => {
  const text = JSON.stringify(body);
  assert.ok(!text.includes('internal_folio') && !text.includes('internalFolio'), 'no expone el folio');
  assert.ok(!text.includes('AXI-'), 'no expone valores de folio');
  assert.ok(!text.includes('password'), 'no expone contraseñas');
};

describe('groups API', () => {
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

  describe('sesión y roles', () => {
    test('sin sesión → 401 en todos los endpoints', async () => {
      const calls = [
        ['GET', '/api/v1/groups'],
        ['POST', '/api/v1/groups'],
        ['GET', `/api/v1/groups/${fx.ids.groupA}`],
        ['PATCH', `/api/v1/groups/${fx.ids.groupA}`],
        ['GET', `/api/v1/groups/${fx.ids.groupA}/students`],
        ['POST', `/api/v1/groups/${fx.ids.groupA}/students`],
        ['POST', `/api/v1/groups/${fx.ids.groupA}/students/bulk`],
        ['PATCH', `/api/v1/groups/students/${fx.ids.sofia}/avatar`],
      ];
      for (const [method, path] of calls) {
        const res = await api.call(method, path, { body: method === 'GET' ? undefined : {} });
        assert.equal(res.status, 401, `${method} ${path}`);
        assert.equal(res.body.error.code, 'AUTH_REQUIRED');
      }
    });

    test('un alumno no puede listar ni gestionar grupos (403)', async () => {
      const token = fx.tokens.sofia;
      for (const [method, path] of [
        ['GET', '/api/v1/groups'],
        ['POST', '/api/v1/groups'],
        ['GET', `/api/v1/groups/${fx.ids.groupA}`],
        ['GET', `/api/v1/groups/${fx.ids.groupA}/students`],
        ['POST', `/api/v1/groups/${fx.ids.groupA}/students`],
      ]) {
        const res = await api.call(method, path, { token, body: method === 'GET' ? undefined : {} });
        assert.equal(res.status, 403, `${method} ${path}`);
        assert.equal(res.body.error.code, 'FORBIDDEN');
      }
    });

    test('ids de ruta no numéricos → 400', async () => {
      for (const path of ['/api/v1/groups/abc', '/api/v1/groups/0', '/api/v1/groups/-1/students', '/api/v1/groups/1.5']) {
        const res = await api.call('GET', path, { token: fx.tokens.teacherA });
        assert.equal(res.status, 400, path);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
      const avatar = await api.call('PATCH', '/api/v1/groups/students/x/avatar', { token: fx.tokens.teacherA, body: { avatarId: 'rosa' } });
      assert.equal(avatar.status, 400);
    });
  });

  describe('GET /groups', () => {
    test('la docente ve solo sus grupos con conteo de alumnos activos', async () => {
      const { status, body } = await api.call('GET', '/api/v1/groups', { token: fx.tokens.teacherA });
      assert.equal(status, 200);
      assert.deepEqual(body.data, [{
        id: fx.ids.groupA, name: '3.º A', grade: 3, section: 'A', schoolYear: '2026-2027', phase: 4,
        joinCode: 'MAPA3A', teacherId: fx.ids.teacherA, studentCount: 2, secretSetupUntil: null,
      }]);
      assert.deepEqual(body.meta, { count: 1 });
    });

    test('el director ve los grupos de su escuela y no los de otra', async () => {
      const a = await api.call('GET', '/api/v1/groups', { token: fx.tokens.directorA });
      assert.deepEqual(a.body.data.map((g) => g.id).sort(), [fx.ids.groupA, fx.ids.groupB].sort());
      const b = await api.call('GET', '/api/v1/groups', { token: fx.tokens.directorB });
      assert.deepEqual(b.body.data.map((g) => g.id), [fx.ids.groupOther]);
    });
  });

  describe('POST /groups', () => {
    test('crea un grupo con código único de 6 caracteres', async () => {
      const { status, body } = await api.call('POST', '/api/v1/groups', {
        token: fx.tokens.teacherA, body: { grade: 5, section: ' b ', schoolYear: '2026-2027' },
      });
      assert.equal(status, 201);
      assert.equal(body.data.name, '5.º B');
      assert.equal(body.data.phase, 5);
      assert.equal(body.data.studentCount, 0);
      assert.equal(body.data.teacherId, fx.ids.teacherA);
      assert.match(body.data.joinCode, /^[A-HJKMNP-Z2-9]{6}$/);
      const row = fx.db.prepare('SELECT school_id, teacher_id FROM groups WHERE id = ?').get(body.data.id);
      assert.deepEqual({ ...row }, { school_id: fx.ids.schoolA, teacher_id: fx.ids.teacherA });
    });

    test('valida grado, sección y ciclo', async () => {
      const bad = [
        {},
        { grade: 0, section: 'A', schoolYear: '2026-2027' },
        { grade: 7, section: 'A', schoolYear: '2026-2027' },
        { grade: 2.5, section: 'A', schoolYear: '2026-2027' },
        { grade: 3, section: '', schoolYear: '2026-2027' },
        { grade: 3, section: 'ABC', schoolYear: '2026-2027' },
        { grade: 3, section: '1', schoolYear: '2026-2027' },
        { grade: 3, section: 'A', schoolYear: '2026' },
        { grade: 3, section: 'A', schoolYear: '2026-2028' },
        { grade: 3, section: 'A', schoolYear: '2027-2026' },
      ];
      for (const body of bad) {
        const res = await api.call('POST', '/api/v1/groups', { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });

    test('grupo duplicado en la escuela → 409', async () => {
      const res = await api.call('POST', '/api/v1/groups', {
        token: fx.tokens.teacherA, body: { grade: 4, section: 'b', schoolYear: '2026-2027' },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'GROUP_ALREADY_EXISTS');
    });

    test('el director no crea grupos (solo lectura)', async () => {
      const res = await api.call('POST', '/api/v1/groups', {
        token: fx.tokens.directorA, body: { grade: 1, section: 'A', schoolYear: '2026-2027' },
      });
      assert.equal(res.status, 403);
    });
  });

  describe('GET y PATCH /groups/:groupId', () => {
    test('detalle del grupo propio', async () => {
      const { status, body } = await api.call('GET', `/api/v1/groups/${fx.ids.groupA}`, { token: fx.tokens.teacherA });
      assert.equal(status, 200);
      assert.equal(body.data.joinCode, 'MAPA3A');
    });

    const createEmptyGroup = async () =>
      (await api.call('POST', '/api/v1/groups', { token: fx.tokens.teacherA, body: { grade: 1, section: 'C', schoolYear: '2026-2027' } })).body.data;

    test('edita grado, sección y ciclo de un grupo sin historial', async () => {
      const empty = await createEmptyGroup();
      const { status, body } = await api.call('PATCH', `/api/v1/groups/${empty.id}`, {
        token: fx.tokens.teacherA, body: { grade: '5', section: 'd' },
      });
      assert.equal(status, 200);
      assert.deepEqual([body.data.grade, body.data.section, body.data.schoolYear, body.data.phase], [5, 'D', '2026-2027', 5]);
      assert.equal(body.data.joinCode, empty.joinCode, 'el código no cambia');

      const year = await api.call('PATCH', `/api/v1/groups/${empty.id}`, { token: fx.tokens.teacherA, body: { schoolYear: '2027-2028' } });
      assert.equal(year.body.data.schoolYear, '2027-2028');
    });

    test('valida el PATCH y detecta duplicados', async () => {
      for (const body of [{}, [], { grade: 9 }, { grade: {} }, { section: 'a1' }, { section: 1 }, { schoolYear: '26-27' }]) {
        const res = await api.call('PATCH', `/api/v1/groups/${fx.ids.groupA}`, { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 400, JSON.stringify(body));
      }
      const empty = await createEmptyGroup();
      const dup = await api.call('PATCH', `/api/v1/groups/${empty.id}`, { token: fx.tokens.teacherA, body: { grade: 4, section: 'B' } });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.error.code, 'GROUP_ALREADY_EXISTS');
      assert.equal(dup.body.error.message, 'Ese grupo ya está registrado en tu escuela.');
      const same = await api.call('PATCH', `/api/v1/groups/${fx.ids.groupA}`, { token: fx.tokens.teacherA, body: { grade: 3 } });
      assert.equal(same.status, 200, 'guardar sin cambios no es duplicado');
    });

    test('con historial: no cambia grado ni ciclo (409), sí la sección', async () => {
      const path = `/api/v1/groups/${fx.ids.groupA}`;
      for (const body of [{ grade: 4 }, { schoolYear: '2027-2028' }, { grade: 4, section: 'C' }]) {
        const res = await api.call('PATCH', path, { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 409, JSON.stringify(body));
        assert.equal(res.body.error.code, 'GROUP_HAS_HISTORY');
      }
      const row = fx.db.prepare('SELECT grade, section, school_year FROM groups WHERE id = ?').get(fx.ids.groupA);
      assert.deepEqual({ ...row }, { grade: 3, section: 'A', school_year: '2026-2027' }, 'no cambió nada');

      const sameValues = await api.call('PATCH', path, { token: fx.tokens.teacherA, body: { grade: 3, schoolYear: '2026-2027', section: 'C' } });
      assert.equal(sameValues.status, 200, 'los mismos valores no cuentan como cambio');
      assert.equal(sameValues.body.data.section, 'C');
      const dupSection = await api.call('PATCH', path, { token: fx.tokens.teacherA, body: { section: 'B', grade: 3 } });
      assert.equal(dupSection.status, 200, '3.º B no existe: solo la sección cambia');
    });

    test('inscripciones dadas de baja o asignaciones también cuentan como historial', async () => {
      const empty = await createEmptyGroup();
      const path = `/api/v1/groups/${empty.id}`;
      const patchGrade = async (grade) => (await api.call('PATCH', path, { token: fx.tokens.teacherA, body: { grade } })).status;

      fx.db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'withdrawn')").run(empty.id, fx.ids.diego);
      assert.equal(await patchGrade(2), 409);
      fx.db.prepare('DELETE FROM group_enrollments WHERE group_id = ?').run(empty.id);

      fx.db.prepare("INSERT INTO assignments (group_id, title, modality) VALUES (?, 'Prueba', 'screen')").run(empty.id);
      assert.equal(await patchGrade(2), 409);
      fx.db.prepare('DELETE FROM assignments WHERE group_id = ?').run(empty.id);

      assert.equal(await patchGrade(2), 200);
    });

    test('POST /groups con tipos inesperados → 400', async () => {
      for (const body of [[], { grade: {} }, { grade: 3, section: 1, schoolYear: '2026-2027' }, { grade: 3, section: 'A', schoolYear: 2026 }]) {
        const res = await api.call('POST', '/api/v1/groups', { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });

    test('reintenta el join_code si el generado ya existe', async () => {
      // 'MAPA3A' ya existe: el primer intento lo produce y el segundo, con 0, da 'AAAAAA'.
      const first = [...'MAPA3A'].map((ch) => (CODE_ALPHABET.indexOf(ch) + 0.5) / CODE_ALPHABET.length);
      let i = 0;
      const random = () => (i < first.length ? first[i++] : 0);
      const service = createGroupsService({ repository: createGroupsRepository(fx.db), transaction: (fn) => fn(), random });
      const auth = { sub: String(fx.ids.teacherA), role: 'teacher', schoolId: fx.ids.schoolA };
      const group = service.createGroup(auth, { grade: 2, section: 'A', schoolYear: '2026-2027' });
      assert.equal(i, first.length, 'consumió el primer código');
      assert.equal(group.joinCode, 'AAAAAA');
    });

    test('createGroup exige que la sesión siga siendo de una docente de esa escuela', async () => {
      const body = { grade: 2, section: 'Z', schoolYear: '2026-2027' };
      const wrongSchool = tokenFor({ sub: String(fx.ids.teacherA), role: 'teacher', schoolId: fx.ids.schoolB });
      const ghost = tokenFor({ sub: '9999', role: 'teacher', schoolId: fx.ids.schoolA });
      const promoted = tokenFor({ sub: String(fx.ids.directorA), role: 'teacher', schoolId: fx.ids.schoolA });
      for (const token of [wrongSchool, ghost, promoted]) {
        const res = await api.call('POST', '/api/v1/groups', { token, body });
        assert.equal(res.status, 401);
        assert.equal(res.body.error.code, 'SESSION_INVALID');
      }
    });

    test('director: lee grupos de su escuela, no de otra, y no edita', async () => {
      assert.equal((await api.call('GET', `/api/v1/groups/${fx.ids.groupB}`, { token: fx.tokens.directorA })).status, 200);
      assert.equal((await api.call('GET', `/api/v1/groups/${fx.ids.groupA}`, { token: fx.tokens.directorB })).status, 404);
      assert.equal((await api.call('PATCH', `/api/v1/groups/${fx.ids.groupA}`, { token: fx.tokens.directorA, body: { grade: 2 } })).status, 403);
    });
  });

  describe('aislamiento entre docentes', () => {
    test('la docente B no ve, edita ni da de alta en grupos de la docente A (404)', async () => {
      const token = fx.tokens.teacherB;
      const g = fx.ids.groupA;
      const before = countStudents(fx.db);
      for (const [method, path, body] of [
        ['GET', `/api/v1/groups/${g}`],
        ['PATCH', `/api/v1/groups/${g}`, { grade: 2 }],
        ['GET', `/api/v1/groups/${g}/students`],
        ['POST', `/api/v1/groups/${g}/students`, { firstNames: 'Ana', lastNames: 'Ruiz' }],
        ['POST', `/api/v1/groups/${g}/students/bulk`, { text: 'Ana Ruiz' }],
        ['PATCH', `/api/v1/groups/students/${fx.ids.sofia}/avatar`, { avatarId: 'azul' }],
      ]) {
        const res = await api.call(method, path, { token, body });
        assert.equal(res.status, 404, `${method} ${path}`);
      }
      assert.equal(countStudents(fx.db), before);
      const list = await api.call('GET', '/api/v1/groups', { token });
      assert.deepEqual(list.body.data.map((x) => x.id), [fx.ids.groupB]);
    });

    test('un grupo inexistente responde igual que uno ajeno', async () => {
      const missing = await api.call('GET', '/api/v1/groups/9999', { token: fx.tokens.teacherA });
      const foreign = await api.call('GET', `/api/v1/groups/${fx.ids.groupB}`, { token: fx.tokens.teacherA });
      assert.equal(missing.status, 404);
      assert.deepEqual(missing.body, foreign.body);
    });
  });

  describe('alumnos', () => {
    test('GET /students lista solo activos, con nombre completo y sin folio', async () => {
      const { status, body } = await api.call('GET', `/api/v1/groups/${fx.ids.groupA}/students`, { token: fx.tokens.teacherA });
      assert.equal(status, 200);
      assert.deepEqual(body.data, [
        { id: fx.ids.mateo, firstNames: 'Mateo', lastNames: 'Hernández López', initials: 'MH', avatarColor: '#F4B6C2', avatarId: null, hasSecret: false },
        { id: fx.ids.sofia, firstNames: 'Sofía', lastNames: 'Ramírez García', initials: 'SR', avatarColor: '#F4B6C2', avatarId: null, hasSecret: false },
      ]);
      assert.ok(!body.data.some((s) => s.id === fx.ids.diego), 'el alumno dado de baja no aparece');
      assertNoSensitive(body);
    });

    test('director: alumnos de su escuela sí, de otra no', async () => {
      assert.equal((await api.call('GET', `/api/v1/groups/${fx.ids.groupA}/students`, { token: fx.tokens.directorA })).status, 200);
      assert.equal((await api.call('GET', `/api/v1/groups/${fx.ids.groupA}/students`, { token: fx.tokens.directorB })).status, 404);
      const add = await api.call('POST', `/api/v1/groups/${fx.ids.groupA}/students`, {
        token: fx.tokens.directorA, body: { firstNames: 'Ana', lastNames: 'Ruiz' },
      });
      assert.equal(add.status, 403);
    });

    test('POST /students da de alta con iniciales, color de paleta y folio interno', async () => {
      const { status, body } = await api.call('POST', `/api/v1/groups/${fx.ids.groupA}/students`, {
        token: fx.tokens.teacherA, body: { firstNames: '  ana   PAULA ', lastNames: 'de la cruz ruiz' },
      });
      assert.equal(status, 201);
      assert.equal(body.data.firstNames, 'Ana Paula');
      assert.equal(body.data.lastNames, 'De la Cruz Ruiz');
      assert.equal(body.data.initials, 'AD');
      assert.ok(AVATAR_PALETTE.includes(body.data.avatarColor));
      assertNoSensitive(body);

      const row = fx.db.prepare(`
        SELECT s.internal_folio, s.school_id, e.status FROM students s
        JOIN group_enrollments e ON e.student_id = s.id WHERE s.id = ?`).get(body.data.id);
      assert.match(row.internal_folio, /^AXI-[A-Z2-9]{8}$/);
      assert.equal(row.school_id, fx.ids.schoolA);
      assert.equal(row.status, 'active');

      const list = await api.call('GET', `/api/v1/groups/${fx.ids.groupA}/students`, { token: fx.tokens.teacherA });
      assert.equal(list.body.meta.count, 3);
    });

    test('POST /students valida nombres', async () => {
      for (const body of [
        {}, { firstNames: 'Ana' }, { firstNames: '   ', lastNames: 'Ruiz' }, { firstNames: 'Ana1', lastNames: 'Ruiz' },
        { firstNames: 'Ana', lastNames: '<script>' }, { firstNames: 'A'.repeat(81), lastNames: 'Ruiz' }, { firstNames: 5, lastNames: 'Ruiz' },
      ]) {
        const res = await api.call('POST', `/api/v1/groups/${fx.ids.groupA}/students`, { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });

    test('reintenta si el folio generado ya existe', async () => {
      // 1 valor para el color + 8 para el folio (todo ceros → AXI-AAAAAAAA, que ya es de Sofía);
      // el reintento recibe 0.5 → otro folio.
      const values = [0, ...Array(8).fill(0)];
      let i = 0;
      const random = () => (i < values.length ? values[i++] : 0.5);
      const service = createGroupsService({ repository: createGroupsRepository(fx.db), transaction: (fn) => fn(), random });
      const auth = { sub: String(fx.ids.teacherA), role: 'teacher', schoolId: fx.ids.schoolA };
      const created = service.addStudent(auth, String(fx.ids.groupA), { firstNames: 'Ana', lastNames: 'Ruiz' });
      const folio = fx.db.prepare('SELECT internal_folio FROM students WHERE id = ?').get(created.id).internal_folio;
      assert.notEqual(folio, 'AXI-AAAAAAAA');
      assert.match(folio, /^AXI-[A-Z2-9]{8}$/);
    });
  });

  describe('POST /students/bulk', () => {
    test('crea a todos si todas las líneas son válidas', async () => {
      const text = '1. Ana Paula Ruiz Soto\n\n- Torres Vega, Luis\n';
      const { status, body } = await api.call('POST', `/api/v1/groups/${fx.ids.groupA}/students/bulk`, { token: fx.tokens.teacherA, body: { text } });
      assert.equal(status, 201);
      assert.deepEqual(body.data.created.map((s) => [s.firstNames, s.lastNames, s.initials]), [
        ['Ana Paula', 'Ruiz Soto', 'AR'],
        ['Luis', 'Torres Vega', 'LT'],
      ]);
      assert.deepEqual(body.meta, { createdCount: 2 });
      assertNoSensitive(body.data.created);
      const list = await api.call('GET', `/api/v1/groups/${fx.ids.groupA}/students`, { token: fx.tokens.teacherA });
      assert.equal(list.body.meta.count, 4);
    });

    test('una sola línea inválida rechaza el lote completo sin guardar nada', async () => {
      const before = countStudents(fx.db);
      const text = '1. Ana Paula Ruiz Soto\n\n- Torres Vega, Luis\nXimena\nPedro 123 Gómez\n';
      const res = await api.call('POST', `/api/v1/groups/${fx.ids.groupA}/students/bulk`, { token: fx.tokens.teacherA, body: { text } });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.deepEqual(res.body.error.details.invalidLines, [{ line: 4, text: 'Ximena' }, { line: 5, text: 'Pedro 123 Gómez' }]);
      assert.equal(countStudents(fx.db), before);
    });

    test('sin alumnos válidos, texto vacío, tipos inesperados o demasiadas líneas → 400', async () => {
      const path = `/api/v1/groups/${fx.ids.groupA}/students/bulk`;
      const none = await api.call('POST', path, { token: fx.tokens.teacherA, body: { text: 'Ximena\nLuis' } });
      assert.equal(none.status, 400);
      assert.equal(none.body.error.details.invalidLines.length, 2);
      for (const body of [{}, [], { text: '   ' }, { text: 123 }, { text: ['Ana Ruiz'] }, { text: {} }]) {
        const res = await api.call('POST', path, { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
      const many = Array.from({ length: MAX_BULK_LINES + 1 }, (_, i) => `Alumno${'a'.repeat(i % 3)} Prueba`).join('\n');
      const tooMany = await api.call('POST', path, { token: fx.tokens.teacherA, body: { text: many } });
      assert.equal(tooMany.status, 400);
      assert.equal(tooMany.body.error.details.maxLines, MAX_BULK_LINES);
    });

    test('es atómica: si falla un alta, no se guarda ninguna', async () => {
      fx.db.exec(`CREATE TRIGGER fail_on_marker BEFORE INSERT ON students
        WHEN NEW.first_names = 'Falla' BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END;`);
      const before = countStudents(fx.db);
      const enrollments = fx.db.prepare('SELECT COUNT(*) AS n FROM group_enrollments').get().n;
      const res = await api.call('POST', `/api/v1/groups/${fx.ids.groupA}/students/bulk`, {
        token: fx.tokens.teacherA, body: { text: 'Ana Ruiz\nLuis Soto\nFalla Prueba\nEva Luna' },
      });
      assert.equal(res.status, 500);
      assert.equal(countStudents(fx.db), before);
      assert.equal(fx.db.prepare('SELECT COUNT(*) AS n FROM group_enrollments').get().n, enrollments);
    });

    test('la docente B (404) y el director (403) no pueden hacer la carga masiva en el grupo de A', async () => {
      const before = countStudents(fx.db);
      const path = `/api/v1/groups/${fx.ids.groupA}/students/bulk`;
      const body = { text: 'Ana Ruiz\nLuis Soto' };
      const teacherB = await api.call('POST', path, { token: fx.tokens.teacherB, body });
      assert.equal(teacherB.status, 404);
      assert.equal(teacherB.body.error.code, 'GROUP_NOT_FOUND');
      const director = await api.call('POST', path, { token: fx.tokens.directorA, body });
      assert.equal(director.status, 403);
      assert.equal(countStudents(fx.db), before);
    });
  });

  describe('PATCH /groups/students/:studentId/avatar', () => {
    const path = (id) => `/api/v1/groups/students/${id}/avatar`;

    test('la docente cambia avatar y color de un alumno de su grupo', async () => {
      const { status, body } = await api.call('PATCH', path(fx.ids.sofia), {
        token: fx.tokens.teacherA, body: { avatarId: 'azul', avatarColor: AVATAR_PALETTE[2].toLowerCase() },
      });
      assert.equal(status, 200);
      assert.equal(body.data.avatarId, 'azul');
      assert.equal(body.data.avatarColor, AVATAR_PALETTE[2]);
      assertNoSensitive(body);

      const cleared = await api.call('PATCH', path(fx.ids.sofia), { token: fx.tokens.teacherA, body: { avatarId: null } });
      assert.equal(cleared.body.data.avatarId, null);
      assert.equal(cleared.body.data.avatarColor, AVATAR_PALETTE[2], 'el color se conserva');
    });

    test('el alumno cambia su propio avatar, no el de otro', async () => {
      const own = await api.call('PATCH', path(fx.ids.sofia), { token: fx.tokens.sofia, body: { avatarId: 'lila' } });
      assert.equal(own.status, 200);
      assert.equal(own.body.data.avatarId, 'lila');
      const other = await api.call('PATCH', path(fx.ids.mateo), { token: fx.tokens.sofia, body: { avatarId: 'lila' } });
      assert.equal(other.status, 404);
      const otherGroup = await api.call('PATCH', path(fx.ids.lucia), { token: fx.tokens.sofia, body: { avatarId: 'lila' } });
      assert.equal(otherGroup.status, 404);
    });

    test('no se puede cambiar el avatar de un alumno dado de baja', async () => {
      const res = await api.call('PATCH', path(fx.ids.diego), { token: fx.tokens.teacherA, body: { avatarId: 'rosa' } });
      assert.equal(res.status, 404);
      const studentToken = tokenFor({ sub: String(fx.ids.diego), role: 'student', schoolId: fx.ids.schoolA, groupId: fx.ids.groupA });
      assert.equal((await api.call('PATCH', path(fx.ids.diego), { token: studentToken, body: { avatarId: 'rosa' } })).status, 404);
    });

    test('valida avatarId y avatarColor', async () => {
      for (const body of [{}, { avatarId: 'linea' }, { avatarId: 'dragon' }, { avatarId: 3 }, { avatarColor: '#000000' }, { avatarColor: 'red' }]) {
        const res = await api.call('PATCH', path(fx.ids.sofia), { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });

    test('la docente B no cambia el avatar de un alumno de la docente A (404)', async () => {
      const res = await api.call('PATCH', path(fx.ids.sofia), { token: fx.tokens.teacherB, body: { avatarId: 'azul' } });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'STUDENT_NOT_FOUND');
      assert.equal(fx.db.prepare('SELECT avatar_id FROM students WHERE id = ?').get(fx.ids.sofia).avatar_id, null);
    });

    test('un alumno con token vigente pero dado de baja ya no cambia su avatar (404)', async () => {
      const token = fx.tokens.sofia;
      assert.equal((await api.call('PATCH', path(fx.ids.sofia), { token, body: { avatarId: 'rosa' } })).status, 200);
      fx.db.prepare("UPDATE group_enrollments SET status = 'withdrawn' WHERE group_id = ? AND student_id = ?").run(fx.ids.groupA, fx.ids.sofia);
      const res = await api.call('PATCH', path(fx.ids.sofia), { token, body: { avatarId: 'azul' } });
      assert.equal(res.status, 404);
    });

    test('alumno con inscripción completed en A y activo en B: A no lo ve ni lo edita', async () => {
      fx.db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'completed')").run(fx.ids.groupA, fx.ids.lucia);
      const edit = await api.call('PATCH', path(fx.ids.lucia), { token: fx.tokens.teacherA, body: { avatarId: 'azul' } });
      assert.equal(edit.status, 404);
      const list = await api.call('GET', `/api/v1/groups/${fx.ids.groupA}/students`, { token: fx.tokens.teacherA });
      assert.ok(!list.body.data.some((s) => s.id === fx.ids.lucia));
      const groups = await api.call('GET', '/api/v1/groups', { token: fx.tokens.teacherA });
      assert.equal(groups.body.data[0].studentCount, 2, 'no cuenta en el grupo anterior');
      const owner = await api.call('PATCH', path(fx.ids.lucia), { token: fx.tokens.teacherB, body: { avatarId: 'azul' } });
      assert.equal(owner.status, 200, 'la docente actual sí puede');
    });

    test('cuerpos con tipos inesperados → 400', async () => {
      for (const body of [[], { avatarId: {} }, { avatarColor: 1 }, { avatarId: ['rosa'] }]) {
        const res = await api.call('PATCH', path(fx.ids.sofia), { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 400, JSON.stringify(body));
      }
    });

    test('el director no cambia avatares', async () => {
      const res = await api.call('PATCH', path(fx.ids.sofia), { token: fx.tokens.directorA, body: { avatarId: 'rosa' } });
      assert.equal(res.status, 403);
    });
  });
});
