import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import { MAX_NOTES_LENGTH } from '../src/modules/curriculum/curriculum.domain.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * Escuela A: docente A (3.º A), docente B (4.º B), director A y una alumna de 3.º A.
 * Escuela B: director B. Temario mínimo ficticio: 3 contenidos de 3.º (uno sin habilidad) y 1 de 4.º.
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
  const groupA = group(teacherA, 3, 'A', 'CURR3A');
  const groupB = group(teacherB, 4, 'B', 'CURR4B');

  const sofia = id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, 'AXI-AAAAAAAA', 'Sofía', 'Ramírez García', 'SR', '#F4B6C2')", schoolA);
  db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'active')").run(groupA, sofia);

  const fractions = id("INSERT INTO skills (code, name) VALUES ('fractions', 'Fracciones')");
  const placeValue = id("INSERT INTO skills (code, name) VALUES ('place_value', 'Valor posicional')");
  const content = (grade, field, title, skill, order) =>
    id('INSERT INTO curriculum_contents (phase, grade, formative_field, title, pda, skill_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      Math.floor((grade + 1) / 2) + 2, grade, field, title, `PDA de ejemplo ${order}`, skill, order);
  const c3Place = content(3, 'saberes_pensamiento_cientifico', 'Contenido 3 VP', placeValue, 1);
  const c3Frac = content(3, 'saberes_pensamiento_cientifico', 'Contenido 3 F', fractions, 2);
  const c3Extra = content(3, 'saberes_pensamiento_cientifico', 'Contenido 3 extra', null, 3);
  const c4Frac = content(4, 'saberes_pensamiento_cientifico', 'Contenido 4 F', fractions, 1);
  db.prepare("INSERT INTO group_curriculum_progress (group_id, content_id, status, notes) VALUES (?, ?, 'in_progress', 'nota previa')").run(groupA, c3Place);

  const staffToken = (sub, role, schoolId) => tokenFor({ sub: String(sub), role, schoolId });
  return {
    db,
    ids: { groupA, groupB, c3Place, c3Frac, c3Extra, c4Frac },
    tokens: {
      teacherA: staffToken(teacherA, 'teacher', schoolA),
      teacherB: staffToken(teacherB, 'teacher', schoolA),
      directorA: staffToken(directorA, 'director', schoolA),
      directorB: staffToken(directorB, 'director', schoolB),
      sofia: tokenFor({ sub: String(sofia), role: 'student', schoolId: schoolA, groupId: groupA }),
    },
  };
}

describe('curriculum API', () => {
  let fx;
  let api;
  const base = () => `/api/v1/curriculum/groups/${fx.ids.groupA}`;
  const patchPath = (contentId = fx.ids.c3Frac, groupId = fx.ids.groupA) =>
    `/api/v1/curriculum/groups/${groupId}/contents/${contentId}`;

  beforeEach(async () => {
    fx = createFixtures();
    api = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });

  afterEach(async () => {
    await api.close();
    fx.db.close();
  });

  describe('GET /groups/:groupId', () => {
    test('devuelve solo el temario del grado del grupo con su avance y cobertura en meta', async () => {
      const res = await api.call('GET', base(), { token: fx.tokens.teacherA });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data.map((c) => c.id), [fx.ids.c3Place, fx.ids.c3Frac, fx.ids.c3Extra]);

      const [place, frac, extra] = res.body.data;
      assert.deepEqual(Object.keys(place).sort(), [
        'formativeField', 'formativeFieldName', 'grade', 'id', 'notes', 'pda', 'phase', 'skill', 'sortOrder', 'status', 'title', 'updatedAt',
      ]);
      assert.equal(place.status, 'in_progress');
      assert.equal(place.notes, 'nota previa');
      assert.ok(place.updatedAt);
      assert.deepEqual(place.skill, { code: 'place_value', name: 'Valor posicional' });
      assert.equal(place.phase, 4);
      assert.equal(frac.status, 'pending');
      assert.equal(frac.notes, null);
      assert.equal(frac.updatedAt, null);
      assert.equal(extra.skill, null);

      const { meta } = res.body;
      assert.equal(meta.count, 3);
      assert.deepEqual(meta.group, { id: fx.ids.groupA, grade: 3, phase: 4 });
      assert.equal(meta.contentReview, 'por validar con docente');
      assert.equal(meta.coverage.total, 3);
      assert.equal(meta.coverage.pending, 2);
      assert.equal(meta.coverage.in_progress, 1);
      assert.equal(meta.coverage.seen, 0);
      assert.equal(meta.coverage.coveragePercentage, 0);
    });

    test('el director de la escuela puede leerlo', async () => {
      const res = await api.call('GET', base(), { token: fx.tokens.directorA });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 3);
    });
  });

  describe('GET /groups/:groupId/coverage', () => {
    test('devuelve conteos, porcentaje y cobertura por habilidad', async () => {
      const res = await api.call('GET', `${base()}/coverage`, { token: fx.tokens.teacherA });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, {
        total: 3,
        pending: 2,
        in_progress: 1,
        seen: 0,
        coveragePercentage: 0,
        bySkill: [
          { code: 'place_value', name: 'Valor posicional', total: 1, pending: 0, in_progress: 1, seen: 0, coveragePercentage: 0 },
          { code: 'fractions', name: 'Fracciones', total: 1, pending: 1, in_progress: 0, seen: 0, coveragePercentage: 0 },
        ],
      });
      assert.deepEqual(res.body.meta, { group: { id: fx.ids.groupA, grade: 3, phase: 4 } });
    });

    test('la cobertura cambia tras marcar seen', async () => {
      assert.equal((await api.call('PATCH', patchPath(), { token: fx.tokens.teacherA, body: { status: 'seen' } })).status, 200);
      const res = await api.call('GET', `${base()}/coverage`, { token: fx.tokens.teacherA });
      assert.equal(res.body.data.seen, 1);
      assert.equal(res.body.data.pending, 1);
      assert.equal(res.body.data.coveragePercentage, 33.33);
      assert.equal(res.body.data.bySkill.find((s) => s.code === 'fractions').coveragePercentage, 100);
    });
  });

  describe('PATCH /groups/:groupId/contents/:contentId', () => {
    test('crea el registro de avance y devuelve el contenido actualizado', async () => {
      const res = await api.call('PATCH', patchPath(), {
        token: fx.tokens.teacherA,
        body: { status: 'in_progress', notes: '  Usar tiras de papel  ' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, fx.ids.c3Frac);
      assert.equal(res.body.data.status, 'in_progress');
      assert.equal(res.body.data.notes, 'Usar tiras de papel');
      assert.ok(res.body.data.updatedAt);
      assert.deepEqual(res.body.data.skill, { code: 'fractions', name: 'Fracciones' });
    });

    test('actualiza un registro existente: conserva lo no enviado y actualiza updated_at', async () => {
      fx.db.prepare("UPDATE group_curriculum_progress SET updated_at = '2020-01-01 00:00:00' WHERE content_id = ?").run(fx.ids.c3Place);
      const res = await api.call('PATCH', patchPath(fx.ids.c3Place), { token: fx.tokens.teacherA, body: { status: 'seen' } });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'seen');
      assert.equal(res.body.data.notes, 'nota previa');
      assert.notEqual(res.body.data.updatedAt, '2020-01-01 00:00:00');

      const cleared = await api.call('PATCH', patchPath(fx.ids.c3Place), { token: fx.tokens.teacherA, body: { notes: null } });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.data.notes, null);
      assert.equal(cleared.body.data.status, 'seen');
      const rows = fx.db.prepare('SELECT COUNT(*) AS n FROM group_curriculum_progress WHERE group_id = ?').get(fx.ids.groupA).n;
      assert.equal(rows, 1, 'upsert sin duplicar');
    });

    test('400 con status inválido', async () => {
      for (const status of ['visto', 'SEEN', 3, null]) {
        const res = await api.call('PATCH', patchPath(), { token: fx.tokens.teacherA, body: { status } });
        assert.equal(res.status, 400, `status ${JSON.stringify(status)}`);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });

    test('400 con notes demasiado largo o de tipo inesperado', async () => {
      for (const notes of ['a'.repeat(MAX_NOTES_LENGTH + 1), [], {}, 12]) {
        const res = await api.call('PATCH', patchPath(), { token: fx.tokens.teacherA, body: { notes } });
        assert.equal(res.status, 400, `notes ${JSON.stringify(notes).slice(0, 20)}`);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
    });

    test('400 con cuerpo vacío o sin campos conocidos, sin guardar nada', async () => {
      for (const body of [{}, { estado: 'seen' }, []]) {
        const res = await api.call('PATCH', patchPath(), { token: fx.tokens.teacherA, body });
        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      }
      const noBody = await api.call('PATCH', patchPath(), { token: fx.tokens.teacherA });
      assert.equal(noBody.status, 400);
      const row = fx.db.prepare('SELECT 1 FROM group_curriculum_progress WHERE content_id = ?').get(fx.ids.c3Frac);
      assert.equal(row, undefined);
    });

    test('404 si el contenido es de otro grado o no existe', async () => {
      const otherGrade = await api.call('PATCH', patchPath(fx.ids.c4Frac), { token: fx.tokens.teacherA, body: { status: 'seen' } });
      assert.equal(otherGrade.status, 404);
      assert.equal(otherGrade.body.error.code, 'CONTENT_NOT_FOUND');
      const missing = await api.call('PATCH', patchPath(99999), { token: fx.tokens.teacherA, body: { status: 'seen' } });
      assert.equal(missing.status, 404);
      assert.equal(fx.db.prepare('SELECT 1 FROM group_curriculum_progress WHERE content_id = ?').get(fx.ids.c4Frac), undefined);
    });
  });

  describe('validación de ids', () => {
    test('400 con ids de grupo o contenido no válidos', async () => {
      for (const bad of ['abc', '0', '-1', '1.5', '1e3']) {
        const get = await api.call('GET', `/api/v1/curriculum/groups/${bad}`, { token: fx.tokens.teacherA });
        assert.equal(get.status, 400, `GET ${bad}`);
        const cov = await api.call('GET', `/api/v1/curriculum/groups/${bad}/coverage`, { token: fx.tokens.teacherA });
        assert.equal(cov.status, 400, `coverage ${bad}`);
        const patchGroup = await api.call('PATCH', patchPath(fx.ids.c3Frac, bad), { token: fx.tokens.teacherA, body: { status: 'seen' } });
        assert.equal(patchGroup.status, 400, `PATCH grupo ${bad}`);
        const patchContent = await api.call('PATCH', patchPath(bad), { token: fx.tokens.teacherA, body: { status: 'seen' } });
        assert.equal(patchContent.status, 400, `PATCH contenido ${bad}`);
        assert.equal(patchContent.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('aislamiento y roles', () => {
    test('401 sin sesión', async () => {
      assert.equal((await api.call('GET', base())).status, 401);
      assert.equal((await api.call('GET', `${base()}/coverage`)).status, 401);
      assert.equal((await api.call('PATCH', patchPath(), { body: { status: 'seen' } })).status, 401);
    });

    test('la docente B no lee ni edita el temario del grupo de A (404)', async () => {
      const get = await api.call('GET', base(), { token: fx.tokens.teacherB });
      assert.equal(get.status, 404);
      assert.equal(get.body.error.code, 'GROUP_NOT_FOUND');
      assert.equal((await api.call('GET', `${base()}/coverage`, { token: fx.tokens.teacherB })).status, 404);
      const patch = await api.call('PATCH', patchPath(), { token: fx.tokens.teacherB, body: { status: 'seen' } });
      assert.equal(patch.status, 404);
      assert.equal(fx.db.prepare('SELECT 1 FROM group_curriculum_progress WHERE content_id = ?').get(fx.ids.c3Frac), undefined);
    });

    test('la docente B sí ve el temario de 4.º de su grupo', async () => {
      const res = await api.call('GET', `/api/v1/curriculum/groups/${fx.ids.groupB}`, { token: fx.tokens.teacherB });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data.map((c) => c.id), [fx.ids.c4Frac]);
    });

    test('el director lee pero no edita (403); el de otra escuela recibe 404', async () => {
      const patch = await api.call('PATCH', patchPath(), { token: fx.tokens.directorA, body: { status: 'seen' } });
      assert.equal(patch.status, 403);
      assert.equal(patch.body.error.code, 'FORBIDDEN');
      assert.equal((await api.call('GET', base(), { token: fx.tokens.directorB })).status, 404);
    });

    test('el alumno recibe 403 en los tres endpoints', async () => {
      for (const [method, path] of [['GET', base()], ['GET', `${base()}/coverage`], ['PATCH', patchPath()]]) {
        const res = await api.call(method, path, { token: fx.tokens.sofia, body: method === 'PATCH' ? { status: 'seen' } : undefined });
        assert.equal(res.status, 403, `${method} ${path}`);
      }
    });
  });
});

describe('curriculum API con el seed demo', () => {
  let db;
  let api;
  let group;
  let token;

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    group = db.prepare('SELECT id, teacher_id, school_id FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode);
    token = tokenFor({ sub: String(group.teacher_id), role: 'teacher', schoolId: group.school_id });
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });

  after(async () => {
    await api.close();
    db.close();
  });

  test('3.º A: 11 contenidos (5 con habilidad) y el avance del seed', async () => {
    const res = await api.call('GET', `/api/v1/curriculum/groups/${group.id}`, { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 11);
    assert.ok(res.body.data.every((c) => c.grade === 3 && c.phase === 4));
    assert.equal(res.body.data.filter((c) => c.skill).length, 5);
    const { coverage } = res.body.meta;
    assert.equal(coverage.total, 11);
    assert.equal(coverage.seen, 4);
    assert.equal(coverage.in_progress, 2);
    assert.equal(coverage.pending, 5);
    assert.equal(coverage.bySkill.length, 5);
  });
});
