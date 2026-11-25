import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import { runMigrations } from '../src/db/migrate.js';
import { createRequireAuth } from '../src/shared/middleware/authenticate.js';
import { createErrorHandler } from '../src/shared/middleware/errorHandler.js';

const SECRET = 'test-secret-for-auth-module-0123456789';
const PASSWORD = 'Secreta123';
const silentLogger = { error() {} };

function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const school = id("INSERT INTO schools (name) VALUES ('Escuela de prueba')");
  const teacher = id(
    "INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, 'docente@axi.demo', ?, 'Mtra. Prueba', 'teacher')",
    school, bcrypt.hashSync(PASSWORD, 4),
  );
  const director = id(
    "INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, 'direccion@axi.demo', ?, 'Mtro. Director', 'director')",
    school, bcrypt.hashSync(PASSWORD, 4),
  );
  const oldGroup = id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 2, 'A', '2025-2026', 'SEGA2A')", school, teacher);
  const group = id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'A', '2026-2027', 'MAPA3A')", school, teacher);

  const student = (first, last, initials, folio) =>
    id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, '#F4B6C2')",
      school, folio, first, last, initials);
  const sofia = student('Sofía', 'Ramírez García', 'SR', 'AXI-AAAAAAAA');
  const mateo = student('Mateo', 'Hernández López', 'MH', 'AXI-BBBBBBBB');
  const diego = student('Diego', 'Cruz Pérez', 'DC', 'AXI-CCCCCCCC');

  const enroll = (g, s, status) => db.prepare('INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, ?)').run(g, s, status);
  enroll(group, sofia, 'active');
  enroll(group, mateo, 'active');
  enroll(group, diego, 'withdrawn');
  enroll(oldGroup, sofia, 'completed');

  return { db, ids: { school, teacher, director, group, oldGroup, sofia, mateo, diego } };
}

async function startServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { body, raw, token } = {}) => {
    const headers = {};
    if (body !== undefined || raw !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    return { status: res.status, body: await res.json() };
  };
  return { call, close: () => new Promise((resolve) => server.close(resolve)) };
}

function configWith(overrides = {}) {
  return loadConfig({ NODE_ENV: 'test', JWT_SECRET: SECRET, ...overrides });
}

describe('auth API', () => {
  let fx;
  let api;

  before(async () => {
    fx = createFixtures();
    api = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });

  after(async () => {
    await api.close();
    fx.db.close();
  });

  test('health sigue respondiendo', async () => {
    const { status, body } = await api.call('GET', '/api/v1/health');
    assert.equal(status, 200);
    assert.equal(body.data.status, 'ok');
  });

  describe('POST /auth/login', () => {
    test('inicia sesión con correo y contraseña (sin importar mayúsculas)', async () => {
      const { status, body } = await api.call('POST', '/api/v1/auth/login', {
        body: { email: '  Docente@AXI.demo ', password: PASSWORD },
      });
      assert.equal(status, 200);
      assert.ok(body.data.token);
      assert.ok(Date.parse(body.data.expiresAt) > Date.now());
      assert.deepEqual(body.data.user, {
        id: fx.ids.teacher, fullName: 'Mtra. Prueba', email: 'docente@axi.demo', role: 'teacher', schoolId: fx.ids.school,
      });
    });

    test('el token solo lleva identificadores y rol', async () => {
      const { body } = await api.call('POST', '/api/v1/auth/login', { body: { email: 'docente@axi.demo', password: PASSWORD } });
      const claims = jwt.verify(body.data.token, SECRET);
      assert.equal(claims.sub, String(fx.ids.teacher));
      assert.equal(claims.role, 'teacher');
      assert.equal(claims.iss, 'axi-api');
      assert.ok(!JSON.stringify(claims).includes('Prueba'));
      assert.ok(!('email' in claims));
    });

    test('contraseña incorrecta y correo inexistente dan el mismo error', async () => {
      const wrong = await api.call('POST', '/api/v1/auth/login', { body: { email: 'docente@axi.demo', password: 'otra' } });
      const unknown = await api.call('POST', '/api/v1/auth/login', { body: { email: 'nadie@axi.demo', password: PASSWORD } });
      assert.equal(wrong.status, 401);
      assert.deepEqual(wrong.body, unknown.body);
      assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
    });

    test('valida el cuerpo', async () => {
      for (const body of [{}, { email: 'no-es-correo', password: 'x' }, { email: 'a@b.mx', password: '' }, { email: 'a@b.mx', password: 'x'.repeat(73) }]) {
        const res = await api.call('POST', '/api/v1/auth/login', { body });
        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });

    test('responde 400 ante JSON mal formado', async () => {
      const res = await api.call('POST', '/api/v1/auth/login', { raw: '{"email":' });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_JSON');
    });
  });

  describe('GET /auth/me', () => {
    test('devuelve la identidad de la docente', async () => {
      const login = await api.call('POST', '/api/v1/auth/login', { body: { email: 'docente@axi.demo', password: PASSWORD } });
      const { status, body } = await api.call('GET', '/api/v1/auth/me', { token: login.body.data.token });
      assert.equal(status, 200);
      assert.equal(body.data.role, 'teacher');
      assert.equal(body.data.user.id, fx.ids.teacher);
    });

    test('exige sesión', async () => {
      const res = await api.call('GET', '/api/v1/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'AUTH_REQUIRED');
    });

    test('rechaza tokens inválidos, de otro emisor o expirados', async () => {
      const bad = await api.call('GET', '/api/v1/auth/me', { token: 'no.es.token' });
      assert.equal(bad.body.error.code, 'INVALID_TOKEN');

      const forged = jwt.sign({ sub: String(fx.ids.teacher), role: 'teacher' }, 'otro-secreto', { issuer: 'axi-api' });
      assert.equal((await api.call('GET', '/api/v1/auth/me', { token: forged })).body.error.code, 'INVALID_TOKEN');

      const noneAlg = jwt.sign({ sub: String(fx.ids.teacher), role: 'teacher', iss: 'axi-api' }, null, { algorithm: 'none' });
      assert.equal((await api.call('GET', '/api/v1/auth/me', { token: noneAlg })).body.error.code, 'INVALID_TOKEN');

      const expired = jwt.sign(
        { sub: String(fx.ids.teacher), role: 'teacher', exp: Math.floor(Date.now() / 1000) - 60 },
        SECRET, { issuer: 'axi-api' },
      );
      const res = await api.call('GET', '/api/v1/auth/me', { token: expired });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
    });
  });

  describe('acceso del alumno', () => {
    test('POST /student-join devuelve tarjetas sin apellidos completos ni folio', async () => {
      const { status, body } = await api.call('POST', '/api/v1/auth/student-join', { body: { joinCode: ' mapa 3a ' } });
      assert.equal(status, 200);
      assert.deepEqual(body.data.group, { id: fx.ids.group, name: '3.º A', grade: 3, section: 'A', schoolYear: '2026-2027' });
      assert.deepEqual(body.data.students, [
        { id: fx.ids.mateo, displayName: 'Mateo H.', initials: 'MH', avatarColor: '#F4B6C2', avatarId: null },
        { id: fx.ids.sofia, displayName: 'Sofía R.', initials: 'SR', avatarColor: '#F4B6C2', avatarId: null },
      ]);
      const serialized = JSON.stringify(body);
      assert.ok(!serialized.includes('AXI-'));
      assert.ok(!serialized.includes('Ramírez'));
    });

    test('POST /student-join valida el formato y avisa si el código no existe', async () => {
      const invalid = await api.call('POST', '/api/v1/auth/student-join', { body: { joinCode: 'ABC' } });
      assert.equal(invalid.status, 400);
      const missing = await api.call('POST', '/api/v1/auth/student-join', { body: { joinCode: 'ZZZZZZ' } });
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, 'GROUP_NOT_FOUND');
    });

    test('POST /student-join/select entrega una sesión de alumno', async () => {
      const { status, body } = await api.call('POST', '/api/v1/auth/student-join/select', {
        body: { joinCode: 'MAPA3A', studentId: fx.ids.sofia },
      });
      assert.equal(status, 200);
      assert.equal(body.data.student.displayName, 'Sofía R.');
      const claims = jwt.verify(body.data.token, SECRET);
      assert.deepEqual(
        { sub: claims.sub, role: claims.role, groupId: claims.groupId, schoolId: claims.schoolId },
        { sub: String(fx.ids.sofia), role: 'student', groupId: fx.ids.group, schoolId: fx.ids.school },
      );

      const me = await api.call('GET', '/api/v1/auth/me', { token: body.data.token });
      assert.equal(me.body.data.role, 'student');
      assert.equal(me.body.data.student.id, fx.ids.sofia);
    });

    test('no permite elegir un alumno de otro grupo o dado de baja', async () => {
      for (const studentId of [fx.ids.diego, 9999]) {
        const res = await api.call('POST', '/api/v1/auth/student-join/select', { body: { joinCode: 'MAPA3A', studentId } });
        assert.equal(res.status, 404);
        assert.equal(res.body.error.code, 'STUDENT_NOT_IN_GROUP');
      }
      const oldGroup = await api.call('POST', '/api/v1/auth/student-join/select', { body: { joinCode: 'SEGA2A', studentId: fx.ids.sofia } });
      assert.equal(oldGroup.status, 404);
    });
  });

  describe('accesos rápidos de demostración', () => {
    test('GET /quick-login informa si están activos', async () => {
      assert.deepEqual((await api.call('GET', '/api/v1/auth/quick-login')).body, { data: { enabled: true } });
    });

    test('Entrar como Docente', async () => {
      const { status, body } = await api.call('POST', '/api/v1/auth/quick-login/teacher');
      assert.equal(status, 200);
      assert.equal(body.data.user.email, 'docente@axi.demo');
    });

    test('Entrar como Directivo', async () => {
      const { status, body } = await api.call('POST', '/api/v1/auth/quick-login/director');
      assert.equal(status, 200);
      assert.equal(body.data.user.email, 'direccion@axi.demo');
      assert.equal(body.data.user.role, 'director');
      const me = await api.call('GET', '/api/v1/auth/me', { token: body.data.token });
      assert.equal(me.body.data.role, 'director');
    });

    test('Entrar como Alumno usa al primer alumno activo del grupo actual', async () => {
      const { status, body } = await api.call('POST', '/api/v1/auth/quick-login/student');
      assert.equal(status, 200);
      assert.equal(body.data.student.id, fx.ids.sofia);
      assert.equal(body.data.group.id, fx.ids.group);
    });
  });

  test('rutas desconocidas de la API responden 404 con el formato estándar', async () => {
    const res = await api.call('GET', '/api/v1/no-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});

describe('auth API · configuración', () => {
  test('accesos rápidos desactivados → 403', async () => {
    const fx = createFixtures();
    const api = await startServer(createApp({ db: fx.db, config: configWith({ ENABLE_QUICK_LOGIN: 'false' }), logger: silentLogger }));
    try {
      assert.deepEqual((await api.call('GET', '/api/v1/auth/quick-login')).body, { data: { enabled: false } });
      for (const path of ['/api/v1/auth/quick-login/teacher', '/api/v1/auth/quick-login/director', '/api/v1/auth/quick-login/student']) {
        const res = await api.call('POST', path);
        assert.equal(res.status, 403);
        assert.equal(res.body.error.code, 'QUICK_LOGIN_DISABLED');
      }
    } finally {
      await api.close();
      fx.db.close();
    }
  });

  test('sin datos demo → 404 DEMO_DATA_MISSING', async () => {
    const fx = createFixtures();
    const api = await startServer(createApp({
      db: fx.db, config: configWith({ QUICK_LOGIN_TEACHER_EMAIL: 'otra@axi.demo' }), logger: silentLogger,
    }));
    try {
      const res = await api.call('POST', '/api/v1/auth/quick-login/teacher');
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'DEMO_DATA_MISSING');
    } finally {
      await api.close();
      fx.db.close();
    }
  });

  test('Directivo: correo demo que no es director → 404 DEMO_DATA_MISSING', async () => {
    const fx = createFixtures();
    const api = await startServer(createApp({
      db: fx.db, config: configWith({ QUICK_LOGIN_DIRECTOR_EMAIL: 'docente@axi.demo' }), logger: silentLogger,
    }));
    try {
      const res = await api.call('POST', '/api/v1/auth/quick-login/director');
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'DEMO_DATA_MISSING');
    } finally {
      await api.close();
      fx.db.close();
    }
  });

  test('limita los intentos de login por IP', async () => {
    const fx = createFixtures();
    const api = await startServer(createApp({ db: fx.db, config: configWith({ AUTH_RATE_LIMIT_MAX: '2' }), logger: silentLogger }));
    try {
      const attempt = () => api.call('POST', '/api/v1/auth/login', { body: { email: 'docente@axi.demo', password: 'mal' } });
      assert.equal((await attempt()).status, 401);
      assert.equal((await attempt()).status, 401);
      const blocked = await attempt();
      assert.equal(blocked.status, 429);
      assert.equal(blocked.body.error.code, 'TOO_MANY_ATTEMPTS');
      assert.ok(blocked.body.error.details.retryAfterSeconds > 0);
    } finally {
      await api.close();
      fx.db.close();
    }
  });

  test('en producción exige un JWT_SECRET robusto y apaga los accesos rápidos', () => {
    for (const JWT_SECRET of [undefined, 'change_me', 'corto']) {
      assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET }), /JWT_SECRET/);
    }
    const prod = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) });
    assert.equal(prod.auth.quickLoginEnabled, false);
    assert.equal(loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32), ENABLE_QUICK_LOGIN: 'true' }).auth.quickLoginEnabled, true);
  });
});

describe('requireAuth por rol', () => {
  test('rechaza con 403 un rol no permitido', async () => {
    const app = express();
    const requireAuth = createRequireAuth({ secret: SECRET });
    app.get('/solo-docentes', requireAuth('teacher', 'director'), (_req, res) => res.json({ data: 'ok' }));
    app.use(createErrorHandler({ logger: silentLogger }));
    const api = await startServer(app);
    try {
      const studentToken = jwt.sign({ sub: '1', role: 'student' }, SECRET, { issuer: 'axi-api' });
      const teacherToken = jwt.sign({ sub: '1', role: 'teacher' }, SECRET, { issuer: 'axi-api' });
      const denied = await api.call('GET', '/solo-docentes', { token: studentToken });
      assert.equal(denied.status, 403);
      assert.equal(denied.body.error.code, 'FORBIDDEN');
      assert.equal((await api.call('GET', '/solo-docentes', { token: teacherToken })).status, 200);
    } finally {
      await api.close();
    }
  });
});
