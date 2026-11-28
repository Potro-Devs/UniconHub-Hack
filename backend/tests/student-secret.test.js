import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  hashSecret,
  isSetupWindowOpen,
  nextJoinStep,
  parseSecretImages,
  parseSetupMinutes,
  secretLengthForGrade,
  secretMatches,
} from '../src/modules/auth/auth.secret.domain.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

describe('dominio de la imagen secreta', () => {
  test('1 imagen en 1.º y 2.º; 2 de 3.º a 6.º', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(secretLengthForGrade), [1, 1, 2, 2, 2, 2]);
  });

  test('qué sigue después de tocar la tarjeta', () => {
    assert.equal(nextJoinStep({ hasSecret: true, windowOpen: false }), 'verify');
    assert.equal(nextJoinStep({ hasSecret: false, windowOpen: true }), 'setup');
    assert.equal(nextJoinStep({ hasSecret: false, windowOpen: false }), 'ask_teacher');
  });

  test('valida cantidad y catálogo de imágenes', () => {
    assert.deepEqual(parseSecretImages({ images: ['cat', 'cat'] }, 2), ['cat', 'cat']);
    for (const body of [{}, { images: 'cat' }, { images: ['cat'] }, { images: ['cat', 'lion'] }, { images: ['cat', 1] }]) {
      assert.throws(() => parseSecretImages(body, 2), (e) => e.code === 'VALIDATION_ERROR', JSON.stringify(body));
    }
  });

  test('el hash depende del alumno y del orden; la comparación detecta diferencias', () => {
    const h = hashSecret(1, ['cat', 'sun'], 'k');
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.notEqual(h, hashSecret(2, ['cat', 'sun'], 'k'), 'la misma imagen de otro alumno da otro hash');
    assert.equal(secretMatches(h, 1, ['cat', 'sun'], 'k'), true);
    assert.equal(secretMatches(h, 1, ['sun', 'cat'], 'k'), false, 'el orden importa');
    assert.equal(secretMatches(h, 1, ['cat', 'sun'], 'otra-clave'), false);
    assert.equal(secretMatches(null, 1, ['cat', 'sun'], 'k'), false);
  });

  test('ventana abierta y minutos válidos', () => {
    const now = Date.parse('2026-11-28T10:00:00Z');
    assert.equal(isSetupWindowOpen('2026-11-28 10:30:00', now), true);
    assert.equal(isSetupWindowOpen('2026-11-28 09:59:59', now), false);
    assert.equal(isSetupWindowOpen(null, now), false);
    assert.equal(parseSetupMinutes({}), 60);
    assert.equal(parseSetupMinutes({ minutes: 30 }), 30);
    for (const minutes of [4, 241, 1.5, '30']) assert.throws(() => parseSetupMinutes({ minutes }), (e) => e.code === 'VALIDATION_ERROR');
  });
});

/**
 * Docente A: 3.º A (Sofía, Mateo, Ana, Diego dado de baja) y 1.º B (Luis). Docente B y director.
 * 50 alumnos extra en 3.º C para simular un salón completo entrando desde la misma IP.
 */
function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);
  const school = id("INSERT INTO schools (name) VALUES ('Escuela A')");
  const user = (email, role) => id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, 'x', 'Persona Demo', ?)", school, email, role);
  const teacherA = user('a@axi.test', 'teacher');
  const teacherB = user('b@axi.test', 'teacher');
  const director = user('dir@axi.test', 'director');
  const group = (teacher, grade, section, code) =>
    id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, ?, ?, '2026-2027', ?)", school, teacher, grade, section, code);
  const g3 = group(teacherA, 3, 'A', 'SECR3A');
  const g1 = group(teacherA, 1, 'B', 'SECR2B');
  const gBig = group(teacherA, 3, 'C', 'SAPHX3');
  let folio = 0;
  const student = (g, first, status = 'active') => {
    const sid = id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, 'Demo', 'XD', '#F4B6C2')", school, `AXI-${String(++folio).padStart(8, '0')}`, first);
    db.prepare('INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, ?)').run(g, sid, status);
    return sid;
  };
  const ids = { g3, g1, gBig, sofia: student(g3, 'Sofia'), mateo: student(g3, 'Mateo'), ana: student(g3, 'Ana'), diego: student(g3, 'Diego', 'withdrawn'), luis: student(g1, 'Luis') };
  ids.big = Array.from({ length: 50 }, (_, i) => student(gBig, `Alumno${String.fromCharCode(65 + (i % 26))}${i}`));
  const staff = (sub, role) => tokenFor({ sub: String(sub), role, schoolId: school });
  return { db, ids, tokens: { teacherA: staff(teacherA, 'teacher'), teacherB: staff(teacherB, 'teacher'), director: staff(director, 'director') } };
}

describe('imagen secreta del alumno (HTTP)', () => {
  let server;
  let db;
  let ids;
  let tokens;
  const select = (joinCode, studentId) => server.call('POST', '/api/v1/auth/student-join/select', { body: { joinCode, studentId } });
  const secret = (joinCode, studentId, images) => server.call('POST', '/api/v1/auth/student-join/secret', { body: { joinCode, studentId, images } });
  const openWindow = (groupId, body = {}) => server.call('POST', `/api/v1/groups/${groupId}/secret-setup`, { token: tokens.teacherA, body });

  before(async () => {
    const fx = createFixtures();
    ({ db, ids, tokens } = fx);
    // Límite por alumno bajo para poder probarlo; el límite por IP queda en su valor por defecto.
    server = await startServer(createApp({ db, config: configWith({ AUTH_SECRET_ATTEMPTS_MAX: '6' }), logger: silentLogger }));
  });
  after(() => server.close());

  test('sin imagen y con la ventana cerrada: pedir ayuda a la maestra, sin sesión', async () => {
    const res = await select('SECR3A', ids.sofia);
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.data.step, res.body.data.imageCount, res.body.data.images.length], ['ask_teacher', 2, 0]);
    assert.equal(res.body.data.token, undefined);
    const attempt = await secret('SECR3A', ids.sofia, ['cat', 'sun']);
    assert.equal(attempt.status, 409);
    assert.equal(attempt.body.error.code, 'SECRET_SETUP_CLOSED');
  });

  test('la docente abre la ventana (solo ella; minutos válidos)', async () => {
    assert.equal((await server.call('POST', `/api/v1/groups/${ids.g3}/secret-setup`, { token: tokens.director, body: {} })).status, 403);
    assert.equal((await server.call('POST', `/api/v1/groups/${ids.g3}/secret-setup`, { token: tokens.teacherB, body: {} })).status, 404);
    assert.equal((await openWindow(ids.g3, { minutes: 999 })).status, 400);
    const res = await openWindow(ids.g3, { minutes: 30 });
    assert.equal(res.status, 200);
    assert.ok(isSetupWindowOpen(res.body.data.secretSetupUntil), res.body.data.secretSetupUntil);
  });

  test('configurar la primera vez: 3.º pide 2 imágenes; se guarda solo el hash', async () => {
    const step = await select('SECR3A', ids.sofia);
    assert.equal(step.body.data.step, 'setup');
    assert.equal(step.body.data.images.length, 9);
    assert.equal((await secret('SECR3A', ids.sofia, ['cat'])).status, 400, 'en 3.º faltan imágenes');

    const res = await secret('SECR3A', ids.sofia, ['cat', 'sun']);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.token);
    const row = db.prepare('SELECT secret_hash, secret_set_at FROM students WHERE id = ?').get(ids.sofia);
    assert.match(row.secret_hash, /^[0-9a-f]{64}$/);
    assert.ok(row.secret_set_at);
    assert.ok(!/cat|sun/.test(row.secret_hash));
  });

  test('las siguientes veces: verificar; equivocarse da un mensaje amable', async () => {
    assert.equal((await select('SECR3A', ids.sofia)).body.data.step, 'verify');
    const wrong = await secret('SECR3A', ids.sofia, ['sun', 'cat']);
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.code, 'SECRET_MISMATCH');
    assert.match(wrong.body.error.message, /Intenta otra vez/);
    const ok = await secret('SECR3A', ids.sofia, ['cat', 'sun']);
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.token);
  });

  test('1.º pide una sola imagen', async () => {
    await openWindow(ids.g1);
    const step = await select('SECR2B', ids.luis);
    assert.deepEqual([step.body.data.step, step.body.data.imageCount], ['setup', 1]);
    assert.equal((await secret('SECR2B', ids.luis, ['dog'])).status, 200);
  });

  test('el hash nunca sale del servidor; la docente solo ve si ya tiene imagen', async () => {
    const list = await server.call('GET', `/api/v1/groups/${ids.g3}/students`, { token: tokens.teacherA });
    const sofia = list.body.data.find((s) => s.id === ids.sofia);
    const mateo = list.body.data.find((s) => s.id === ids.mateo);
    assert.deepEqual([sofia.hasSecret, mateo.hasSecret], [true, false]);
    const join = await server.call('POST', '/api/v1/auth/student-join', { body: { joinCode: 'SECR3A' } });
    const sel = await select('SECR3A', ids.sofia);
    for (const body of [list.body, join.body, sel.body]) assert.ok(!/secret_hash|[0-9a-f]{64}/.test(JSON.stringify(body)));
  });

  test('la docente restablece la imagen: el alumno la vuelve a elegir', async () => {
    const reset = await server.call('POST', `/api/v1/groups/${ids.g3}/students/${ids.sofia}/secret/reset`, { token: tokens.teacherA });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.data.hasSecret, false);
    assert.equal((await select('SECR3A', ids.sofia)).body.data.step, 'setup');
    assert.equal((await secret('SECR3A', ids.sofia, ['tree', 'star'])).status, 200);
    assert.equal((await secret('SECR3A', ids.sofia, ['cat', 'sun'])).status, 401, 'la imagen anterior ya no sirve');
  });

  test('cerrar la ventana: los que ya tienen imagen siguen entrando; los demás piden ayuda', async () => {
    const closed = await server.call('DELETE', `/api/v1/groups/${ids.g3}/secret-setup`, { token: tokens.teacherA });
    assert.equal(closed.body.data.secretSetupUntil, null);
    assert.equal((await select('SECR3A', ids.sofia)).body.data.step, 'verify');
    assert.equal((await select('SECR3A', ids.mateo)).body.data.step, 'ask_teacher');
  });

  test('alumno dado de baja u otro grupo → 404', async () => {
    assert.equal((await select('SECR3A', ids.diego)).status, 404);
    assert.equal((await secret('SECR3A', ids.luis, ['dog', 'dog'])).status, 404);
  });

  test('límite por alumno: tras varios intentos pide ayuda; no bloquea a los compañeros', async () => {
    // Ana tiene ventana cerrada y sin imagen: cada intento responde 409 y cuenta para su límite (6).
    for (let i = 0; i < 6; i += 1) assert.equal((await secret('SECR3A', ids.ana, ['cat', 'cat'])).status, 409);
    const blocked = await secret('SECR3A', ids.ana, ['cat', 'cat']);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'SECRET_TOO_MANY_ATTEMPTS');
    assert.match(blocked.body.error.message, /Pídele ayuda a tu maestra/);
    // Entrar bien no consume intentos: Sofía (misma IP) entró varias veces y sigue entrando.
    assert.equal((await secret('SECR3A', ids.sofia, ['tree', 'star'])).status, 200);
  });

  test('un salón completo desde la misma IP puede entrar (sin 429 por IP)', async () => {
    await openWindow(ids.gBig);
    for (const sid of ids.big) {
      const join = await server.call('POST', '/api/v1/auth/student-join', { body: { joinCode: 'SAPHX3' } });
      assert.equal(join.status, 200, `join ${sid}`);
      assert.equal((await select('SAPHX3', sid)).status, 200, `select ${sid}`);
      assert.equal((await secret('SAPHX3', sid, ['fish', 'flower'])).status, 200, `secret ${sid}`);
    }
  });
});
