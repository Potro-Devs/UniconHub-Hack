/**
 * Casos límite del módulo curriculum: aislamiento, PATCH parcial, cobertura, robustez y privacidad.
 * Complementa `curriculum.test.js` (no repite sus casos). Datos ficticios.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import { MAX_NOTES_LENGTH } from '../src/modules/curriculum/curriculum.domain.js';
import { configWith, silentLogger, tokenFor } from './helpers.js';

/** Igual que `startServer` de helpers, pero permite cabeceras y cuerpo crudo con cualquier content-type. */
async function startRawServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, raw, token, contentType } = {}) => {
    const headers = {};
    if (body !== undefined || raw !== undefined) headers['content-type'] = contentType ?? 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  };
  return { call, close: () => new Promise((resolve) => server.close(resolve)) };
}

/**
 * Escuela A: docente A (3.º A y 5.º A sin temario, 6.º A sin avance), docente B (3.º B, mismo grado que 3.º A),
 * director A, alumna de 3.º A. Escuela B: docente C y director B (grupo 3.º C).
 * Temario 3.º: 4 contenidos (2 sin habilidad). Temario 6.º: 2 contenidos.
 */
function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const schoolA = id("INSERT INTO schools (name) VALUES ('Escuela A')");
  const schoolB = id("INSERT INTO schools (name) VALUES ('Escuela B')");
  const user = (school, email, role) =>
    id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, 'HASH-SECRETO', 'Persona Demo', ?)", school, email, role);
  const teacherA = user(schoolA, 'a@axi.test', 'teacher');
  const teacherB = user(schoolA, 'b@axi.test', 'teacher');
  const teacherC = user(schoolB, 'c@axi.test', 'teacher');
  const directorA = user(schoolA, 'dir-a@axi.test', 'director');
  const directorB = user(schoolB, 'dir-b@axi.test', 'director');

  const group = (school, teacher, grade, section, code) =>
    id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, ?, ?, '2026-2027', ?)",
      school, teacher, grade, section, code);
  const groupA = group(schoolA, teacherA, 3, 'A', 'EDGE3A');
  const groupA5 = group(schoolA, teacherA, 5, 'A', 'EDGE5A');
  const groupA6 = group(schoolA, teacherA, 6, 'A', 'EDGE6A');
  const groupB = group(schoolA, teacherB, 3, 'B', 'EDGE3B');
  const groupC = group(schoolB, teacherC, 3, 'C', 'EDGE3C');

  const sofia = id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, 'AXI-EDGE0001', 'Sofía', 'Ramírez García', 'SR', '#F4B6C2')", schoolA);
  db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'active')").run(groupA, sofia);

  const fractions = id("INSERT INTO skills (code, name) VALUES ('fractions', 'Fracciones')");
  const placeValue = id("INSERT INTO skills (code, name) VALUES ('place_value', 'Valor posicional')");
  const content = (grade, title, skill, order) =>
    id('INSERT INTO curriculum_contents (phase, grade, formative_field, title, pda, skill_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      Math.floor((grade + 1) / 2) + 2, grade, 'saberes_pensamiento_cientifico', title, `PDA de ejemplo ${order}`, skill, order);
  const c3Place = content(3, 'C3 VP', placeValue, 1);
  const c3Frac = content(3, 'C3 F', fractions, 2);
  const c3NoSkill1 = content(3, 'C3 sin habilidad 1', null, 3);
  const c3NoSkill2 = content(3, 'C3 sin habilidad 2', null, 4);
  const c6Frac = content(6, 'C6 F', fractions, 1);
  const c6Place = content(6, 'C6 VP', placeValue, 2);

  const staff = (sub, role, schoolId) => tokenFor({ sub: String(sub), role, schoolId });
  return {
    db,
    ids: { schoolA, schoolB, teacherA, groupA, groupA5, groupA6, groupB, groupC, c3Place, c3Frac, c3NoSkill1, c3NoSkill2, c6Frac, c6Place },
    tokens: {
      teacherA: staff(teacherA, 'teacher', schoolA),
      teacherAWrongSchool: staff(teacherA, 'teacher', schoolB),
      teacherB: staff(teacherB, 'teacher', schoolA),
      teacherC: staff(teacherC, 'teacher', schoolB),
      directorA: staff(directorA, 'director', schoolA),
      directorB: staff(directorB, 'director', schoolB),
      sofia: tokenFor({ sub: String(sofia), role: 'student', schoolId: schoolA, groupId: groupA }),
    },
  };
}

const progressRows = (db, groupId, contentId) =>
  db.prepare('SELECT status, notes FROM group_curriculum_progress WHERE group_id = ? AND content_id = ?').all(groupId, contentId).map((r) => ({ ...r }));
const progressCount = (db) => db.prepare('SELECT COUNT(*) AS n FROM group_curriculum_progress').get().n;

describe('curriculum: casos límite', () => {
  let fx;
  let api;
  const cur = (groupId) => `/api/v1/curriculum/groups/${groupId}`;
  const cov = (groupId) => `${cur(groupId)}/coverage`;
  const patchPath = (groupId, contentId) => `${cur(groupId)}/contents/${contentId}`;
  const patch = (body, { groupId = fx.ids.groupA, contentId = fx.ids.c3Frac, token = fx.tokens.teacherA } = {}) =>
    api.call('PATCH', patchPath(groupId, contentId), { token, body });

  beforeEach(async () => {
    fx = createFixtures();
    api = await startRawServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });

  afterEach(async () => {
    await api.close();
    fx.db.close();
  });

  describe('aislamiento', () => {
    test('grupo ajeno responde 404 con el mismo cuerpo que un grupo inexistente en los 3 endpoints', async () => {
      const cases = [
        ['GET', cur(fx.ids.groupA), cur(999999)],
        ['GET', cov(fx.ids.groupA), cov(999999)],
        ['PATCH', patchPath(fx.ids.groupA, fx.ids.c3Frac), patchPath(999999, fx.ids.c3Frac)],
      ];
      for (const [method, foreign, missing] of cases) {
        const body = method === 'PATCH' ? { status: 'seen' } : undefined;
        const a = await api.call(method, foreign, { token: fx.tokens.teacherB, body });
        const b = await api.call(method, missing, { token: fx.tokens.teacherB, body });
        assert.equal(a.status, 404, `${method} ${foreign}`);
        assert.equal(a.text, b.text, `${method}: el cuerpo no debe revelar si el grupo existe`);
        assert.deepEqual(a.body, { error: { code: 'GROUP_NOT_FOUND', message: a.body.error.message } });
      }
      assert.equal(progressCount(fx.db), 0);
    });

    test('docente de otra escuela y director de otra escuela → 404 en lectura', async () => {
      for (const token of [fx.tokens.teacherC, fx.tokens.directorB]) {
        for (const path of [cur(fx.ids.groupA), cov(fx.ids.groupA)]) {
          const res = await api.call('GET', path, { token });
          assert.equal(res.status, 404, path);
          assert.equal(res.body.error.code, 'GROUP_NOT_FOUND');
        }
      }
      // A su vez, el director A no ve el grupo de la escuela B.
      assert.equal((await api.call('GET', cur(fx.ids.groupC), { token: fx.tokens.directorA })).status, 404);
    });

    test('token del docente dueño pero con schoolId de otra escuela → 404', async () => {
      assert.equal((await api.call('GET', cur(fx.ids.groupA), { token: fx.tokens.teacherAWrongSchool })).status, 404);
      assert.equal((await patch({ status: 'seen' }, { token: fx.tokens.teacherAWrongSchool })).status, 404);
      assert.equal(progressCount(fx.db), 0);
    });

    test('el avance de un grupo no se mezcla con otro grupo del mismo grado', async () => {
      const resB = await patch({ status: 'seen', notes: 'nota de B' }, { groupId: fx.ids.groupB, token: fx.tokens.teacherB });
      assert.equal(resB.status, 200);
      const resA = await api.call('GET', cur(fx.ids.groupA), { token: fx.tokens.teacherA });
      const fracA = resA.body.data.find((c) => c.id === fx.ids.c3Frac);
      assert.equal(fracA.status, 'pending');
      assert.equal(fracA.notes, null);
      assert.equal(resA.body.meta.coverage.seen, 0);
      assert.ok(!resA.text.includes('nota de B'));
    });

    test('director (propia u otra escuela) y alumno no escriben nada', async () => {
      for (const token of [fx.tokens.directorA, fx.tokens.directorB, fx.tokens.sofia]) {
        const res = await patch({ status: 'seen' }, { token });
        assert.equal(res.status, 403);
        assert.deepEqual(res.body, { error: { code: 'FORBIDDEN', message: res.body.error.message } });
      }
      assert.equal(progressCount(fx.db), 0);
    });

    test('alumno → 403 FORBIDDEN incluso en el grupo al que pertenece y en grupos ajenos', async () => {
      for (const path of [cur(fx.ids.groupA), cov(fx.ids.groupA), cur(fx.ids.groupB), cov(999999)]) {
        const res = await api.call('GET', path, { token: fx.tokens.sofia });
        assert.equal(res.status, 403, path);
        assert.equal(res.body.error.code, 'FORBIDDEN');
      }
    });

    test('401 con token inválido o con esquema distinto de Bearer', async () => {
      const bad = await api.call('GET', cur(fx.ids.groupA), { token: 'no-es-un-jwt' });
      assert.equal(bad.status, 401);
      assert.ok(bad.body.error.code);
      const forged = await api.call('GET', cov(fx.ids.groupA), { token: `${fx.tokens.teacherA.slice(0, -3)}abc` });
      assert.equal(forged.status, 401);
    });
  });

  describe('PATCH parcial y persistencia', () => {
    test('contenido de otro grado → 404 CONTENT_NOT_FOUND idéntico al inexistente, sin registro', async () => {
      const other = await patch({ status: 'seen', notes: 'x' }, { contentId: fx.ids.c6Frac });
      const missing = await patch({ status: 'seen', notes: 'x' }, { contentId: 999999 });
      assert.equal(other.status, 404);
      assert.equal(other.body.error.code, 'CONTENT_NOT_FOUND');
      assert.equal(other.text, missing.text);
      assert.equal(progressCount(fx.db), 0);
    });

    test('solo notes conserva status; solo status conserva notes', async () => {
      await patch({ status: 'seen' });
      const onlyNotes = await patch({ notes: 'Repasar con material concreto' });
      assert.equal(onlyNotes.status, 200);
      assert.equal(onlyNotes.body.data.status, 'seen');
      assert.equal(onlyNotes.body.data.notes, 'Repasar con material concreto');

      const onlyStatus = await patch({ status: 'in_progress' });
      assert.equal(onlyStatus.body.data.status, 'in_progress');
      assert.equal(onlyStatus.body.data.notes, 'Repasar con material concreto');
      assert.deepEqual(progressRows(fx.db, fx.ids.groupA, fx.ids.c3Frac), [{ status: 'in_progress', notes: 'Repasar con material concreto' }]);
    });

    test('solo notes sin registro previo crea el avance como pending', async () => {
      const res = await patch({ notes: 'Primera nota' });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'pending');
      assert.deepEqual(progressRows(fx.db, fx.ids.groupA, fx.ids.c3Frac), [{ status: 'pending', notes: 'Primera nota' }]);
    });

    test('notes null borra y notes con solo espacios se guarda como null', async () => {
      await patch({ notes: 'algo' });
      assert.equal((await patch({ notes: null })).body.data.notes, null);
      await patch({ notes: 'otra' });
      const blank = await patch({ notes: '   \t\n ' });
      assert.equal(blank.status, 200);
      assert.equal(blank.body.data.notes, null);
      assert.equal(progressRows(fx.db, fx.ids.groupA, fx.ids.c3Frac)[0].notes, null);
    });

    test('notes de 500 caracteres pasa (también con espacios alrededor); 501 no y no guarda', async () => {
      const exact = 'n'.repeat(MAX_NOTES_LENGTH);
      assert.equal(MAX_NOTES_LENGTH, 500);
      const ok = await patch({ notes: exact });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.notes.length, 500);
      const padded = await patch({ notes: `   ${exact}   ` });
      assert.equal(padded.status, 200);
      assert.equal(padded.body.data.notes, exact);

      const tooLong = await patch({ status: 'seen', notes: `${exact}x` });
      assert.equal(tooLong.status, 400);
      assert.equal(tooLong.body.error.code, 'VALIDATION_ERROR');
      assert.deepEqual(progressRows(fx.db, fx.ids.groupA, fx.ids.c3Frac), [{ status: 'pending', notes: exact }], 'el status válido no se aplica si notes es inválido');
    });

    test('status válido con notes inválido no guarda nada', async () => {
      const res = await patch({ status: 'seen', notes: 42 });
      assert.equal(res.status, 400);
      assert.equal(progressCount(fx.db), 0);
    });

    test('varios PATCH seguidos dejan un solo registro por grupo y contenido', async () => {
      const bodies = [{ status: 'in_progress' }, { notes: 'a' }, { status: 'seen' }, { notes: null }, { status: 'pending', notes: 'b' }, { status: 'seen' }];
      for (const body of bodies) assert.equal((await patch(body)).status, 200);
      assert.deepEqual(progressRows(fx.db, fx.ids.groupA, fx.ids.c3Frac), [{ status: 'seen', notes: 'b' }]);
      assert.equal(progressCount(fx.db), 1);
    });

    test('PATCH concurrentes sobre el mismo contenido no duplican el registro', async () => {
      const results = await Promise.all(['in_progress', 'seen', 'pending', 'seen'].map((status) => patch({ status })));
      assert.ok(results.every((r) => r.status === 200));
      assert.equal(progressRows(fx.db, fx.ids.groupA, fx.ids.c3Frac).length, 1);
    });
  });

  describe('cobertura', () => {
    test('cuadra con los estados guardados; contenidos sin habilidad cuentan en total pero no en bySkill', async () => {
      await patch({ status: 'seen' }, { contentId: fx.ids.c3NoSkill1 });
      await patch({ status: 'in_progress' }, { contentId: fx.ids.c3NoSkill2 });
      await patch({ status: 'seen' }, { contentId: fx.ids.c3Place });

      const res = await api.call('GET', cov(fx.ids.groupA), { token: fx.tokens.teacherA });
      assert.equal(res.status, 200);
      const data = res.body.data;
      const db = fx.db.prepare('SELECT status, COUNT(*) AS n FROM group_curriculum_progress WHERE group_id = ? GROUP BY status').all(fx.ids.groupA);
      const fromDb = Object.fromEntries(db.map((r) => [r.status, r.n]));
      assert.equal(data.total, 4);
      assert.equal(data.seen, fromDb.seen);
      assert.equal(data.in_progress, fromDb.in_progress);
      assert.equal(data.pending, data.total - data.seen - data.in_progress);
      assert.equal(data.coveragePercentage, 50);

      const sum = (key) => data.bySkill.reduce((acc, s) => acc + s[key], 0);
      assert.equal(sum('total'), 2, 'solo los 2 contenidos con habilidad');
      assert.equal(sum('seen'), 1);
      assert.equal(sum('in_progress'), 0);
      assert.deepEqual(data.bySkill.find((s) => s.code === 'place_value'), {
        code: 'place_value', name: 'Valor posicional', total: 1, pending: 0, in_progress: 0, seen: 1, coveragePercentage: 100,
      });
    });

    test('coverage y meta.coverage de GET /groups/:id coinciden', async () => {
      await patch({ status: 'seen' }, { contentId: fx.ids.c3NoSkill1 });
      const full = await api.call('GET', cur(fx.ids.groupA), { token: fx.tokens.teacherA });
      const only = await api.call('GET', cov(fx.ids.groupA), { token: fx.tokens.teacherA });
      assert.deepEqual(full.body.meta.coverage, only.body.data);
      assert.equal(full.body.data.filter((c) => c.status === 'seen').length, only.body.data.seen);
    });

    test('grupo de un grado sin registros de avance: todo pending', async () => {
      const res = await api.call('GET', cov(fx.ids.groupA6), { token: fx.tokens.teacherA });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.total, 2);
      assert.equal(res.body.data.pending, 2);
      assert.equal(res.body.data.seen, 0);
      assert.equal(res.body.data.in_progress, 0);
      assert.equal(res.body.data.coveragePercentage, 0);
      assert.ok(res.body.data.bySkill.every((s) => s.pending === s.total && s.seen === 0));
      assert.deepEqual(res.body.meta.group, { id: fx.ids.groupA6, grade: 6, phase: 5 });
    });

    test('grado sin contenidos: total 0, 0% y bySkill vacío (sin división entre cero)', async () => {
      const res = await api.call('GET', cur(fx.ids.groupA5), { token: fx.tokens.teacherA });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.meta.count, 0);
      assert.deepEqual(res.body.meta.coverage, { total: 0, pending: 0, in_progress: 0, seen: 0, coveragePercentage: 0, bySkill: [] });
    });

    test('porcentaje con 2 decimales (1 de 3, 2 de 3)', async () => {
      // 6.º A tiene 2 contenidos; 3.º A tiene 4. Usamos 3.º A con 3 vistos → 75 y 6.º A con 1 → 50.
      for (const c of [fx.ids.c3Place, fx.ids.c3Frac, fx.ids.c3NoSkill1]) await patch({ status: 'seen' }, { contentId: c });
      assert.equal((await api.call('GET', cov(fx.ids.groupA), { token: fx.tokens.teacherA })).body.data.coveragePercentage, 75);
      await patch({ status: 'seen' }, { groupId: fx.ids.groupA6, contentId: fx.ids.c6Frac });
      assert.equal((await api.call('GET', cov(fx.ids.groupA6), { token: fx.tokens.teacherA })).body.data.coveragePercentage, 50);
    });
  });

  describe('robustez', () => {
    test('ids enormes: 15 dígitos → 404; 16+ dígitos → 400; nunca 500', async () => {
      const big15 = await api.call('GET', cur('999999999999999'), { token: fx.tokens.teacherA });
      assert.equal(big15.status, 404);
      for (const bad of ['9999999999999999', '99999999999999999999999', '-5', 'NaN', 'Infinity', '2.0', '0x10', '%201', '1%20', 'null']) {
        for (const [method, path] of [
          ['GET', cur(bad)],
          ['GET', cov(bad)],
          ['PATCH', patchPath(fx.ids.groupA, bad)],
          ['PATCH', patchPath(bad, fx.ids.c3Frac)],
        ]) {
          const res = await api.call(method, path, { token: fx.tokens.teacherA, body: method === 'PATCH' ? { status: 'seen' } : undefined });
          assert.equal(res.status, 400, `${method} ${path}`);
          assert.equal(res.body.error.code, 'VALIDATION_ERROR');
        }
      }
      const bigContent = await patch({ status: 'seen' }, { contentId: '999999999999999' });
      assert.equal(bigContent.status, 404);
      assert.equal(bigContent.body.error.code, 'CONTENT_NOT_FOUND');
      assert.equal(progressCount(fx.db), 0);
    });

    test('ceros a la izquierda se aceptan como el mismo id', async () => {
      const res = await api.call('GET', cur(`000${fx.ids.groupA}`), { token: fx.tokens.teacherA });
      assert.equal(res.status, 200);
      assert.equal(res.body.meta.group.id, fx.ids.groupA);
    });

    test('cuerpo que es texto JSON, número, JSON roto o text/plain → 400 sin guardar', async () => {
      for (const raw of ['"seen"', '42', 'true', '{"status": "seen"', 'status=seen']) {
        const res = await api.call('PATCH', patchPath(fx.ids.groupA, fx.ids.c3Frac), { token: fx.tokens.teacherA, raw });
        assert.equal(res.status, 400, raw);
        assert.ok(['INVALID_JSON', 'VALIDATION_ERROR'].includes(res.body.error.code), raw);
      }
      const plain = await api.call('PATCH', patchPath(fx.ids.groupA, fx.ids.c3Frac), {
        token: fx.tokens.teacherA, raw: '{"status":"seen"}', contentType: 'text/plain',
      });
      assert.equal(plain.status, 400);
      assert.equal(plain.body.error.code, 'VALIDATION_ERROR');
      const arr = await patch([{ status: 'seen' }]);
      assert.equal(arr.status, 400);
      assert.equal(progressCount(fx.db), 0);
    });

    test('status en mayúsculas, con espacios o con otro formato → 400', async () => {
      for (const status of ['Seen', 'IN_PROGRESS', ' seen', 'seen ', 'in progress', 'in-progress', '', ['seen'], { s: 'seen' }, true]) {
        const res = await patch({ status });
        assert.equal(res.status, 400, JSON.stringify(status));
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
      assert.equal(progressCount(fx.db), 0);
    });

    test('campos extra desconocidos se ignoran (no se rechazan) y no alteran otro grupo ni contenido', async () => {
      const res = await patch({ status: 'seen', group_id: fx.ids.groupB, content_id: fx.ids.c3Place, updated_at: '2000-01-01', foo: 1 });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, fx.ids.c3Frac);
      assert.notEqual(res.body.data.updatedAt, '2000-01-01');
      assert.equal(progressCount(fx.db), 1);
      assert.equal(progressRows(fx.db, fx.ids.groupA, fx.ids.c3Frac).length, 1);
    });

    test('un cuerpo mayor a 100 kb → 413 PAYLOAD_TOO_LARGE', async () => {
      const res = await patch({ notes: 'x'.repeat(120 * 1024) });
      assert.equal(res.status, 413);
      assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
    });

    test('notes con HTML se guarda tal cual como texto (el frontend debe escaparlo)', async () => {
      const res = await patch({ notes: '<script>alert(1)</script>' });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.notes, '<script>alert(1)</script>');
    });

    test('métodos no soportados devuelven 404 con formato de error', async () => {
      for (const [method, path] of [['POST', cur(fx.ids.groupA)], ['DELETE', patchPath(fx.ids.groupA, fx.ids.c3Frac)], ['PUT', patchPath(fx.ids.groupA, fx.ids.c3Frac)]]) {
        const res = await api.call(method, path, { token: fx.tokens.teacherA, body: { status: 'seen' } });
        assert.equal(res.status, 404, `${method} ${path}`);
        assert.equal(res.body.error.code, 'NOT_FOUND');
      }
    });
  });

  describe('privacidad y formato', () => {
    test('ninguna respuesta incluye datos de alumnos, internal_folio ni password_hash', async () => {
      const responses = [
        await api.call('GET', cur(fx.ids.groupA), { token: fx.tokens.teacherA }),
        await api.call('GET', cov(fx.ids.groupA), { token: fx.tokens.teacherA }),
        await api.call('GET', cur(fx.ids.groupA), { token: fx.tokens.directorA }),
        await patch({ status: 'seen', notes: 'ok' }),
        await patch({ status: 'nope' }),
        await api.call('GET', cur(fx.ids.groupA), { token: fx.tokens.teacherB }),
      ];
      for (const res of responses) {
        for (const forbidden of ['internal_folio', 'internalFolio', 'AXI-EDGE0001', 'password', 'HASH-SECRETO', 'Sofía', 'Ramírez', 'joinCode', 'EDGE3A', 'curp', 'CURP']) {
          assert.ok(!res.text.includes(forbidden), `la respuesta ${res.status} incluye ${forbidden}`);
        }
      }
    });

    test('éxitos traen { data, meta? } y errores solo { error: { code, message } }', async () => {
      const ok = await api.call('GET', cov(fx.ids.groupA), { token: fx.tokens.teacherA });
      assert.deepEqual(Object.keys(ok.body).sort(), ['data', 'meta']);
      const updated = await patch({ status: 'seen' });
      assert.ok('data' in updated.body && !('error' in updated.body));
      for (const res of [
        await api.call('GET', cov(fx.ids.groupA)),
        await api.call('GET', cov(fx.ids.groupA), { token: fx.tokens.sofia }),
        await api.call('GET', cov(fx.ids.groupB), { token: fx.tokens.teacherA }),
        await patch({}),
      ]) {
        assert.deepEqual(Object.keys(res.body), ['error']);
        assert.equal(typeof res.body.error.code, 'string');
        assert.equal(typeof res.body.error.message, 'string');
      }
    });
  });
});

describe('curriculum con el seed demo: consistencia y privacidad', () => {
  let db;
  let api;
  let group;
  let token;

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    group = db.prepare('SELECT id, teacher_id, school_id, grade FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode);
    token = tokenFor({ sub: String(group.teacher_id), role: 'teacher', schoolId: group.school_id });
    api = await startRawServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });

  after(async () => {
    await api.close();
    db.close();
  });

  test('los estados del API coinciden uno a uno con group_curriculum_progress', async () => {
    const res = await api.call('GET', `/api/v1/curriculum/groups/${group.id}`, { token });
    const rows = db.prepare('SELECT content_id, status FROM group_curriculum_progress WHERE group_id = ?').all(group.id);
    const byId = new Map(rows.map((r) => [r.content_id, r.status]));
    for (const c of res.body.data) assert.equal(c.status, byId.get(c.id) ?? 'pending', `contenido ${c.id}`);
    assert.equal(res.body.meta.coverage.coveragePercentage, 36.36, '4 de 11 vistos');
    const sorted = [...res.body.data].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    assert.deepEqual(res.body.data.map((c) => c.id), sorted.map((c) => c.id));
  });

  test('las respuestas no contienen folios, nombres de alumnos ni hashes del seed', async () => {
    const texts = [
      (await api.call('GET', `/api/v1/curriculum/groups/${group.id}`, { token })).text,
      (await api.call('GET', `/api/v1/curriculum/groups/${group.id}/coverage`, { token })).text,
    ];
    const folios = db.prepare('SELECT internal_folio FROM students').all().map((r) => r.internal_folio);
    const fullNames = db.prepare('SELECT first_names || \' \' || last_names AS n FROM students').all().map((r) => r.n);
    const hashes = db.prepare('SELECT password_hash FROM users').all().map((r) => r.password_hash);
    assert.ok(folios.length >= 45);
    for (const text of texts) {
      for (const secret of [...folios, ...fullNames, ...hashes, 'internal_folio', 'password']) {
        assert.ok(!text.includes(secret), `incluye ${secret}`);
      }
    }
  });
});
