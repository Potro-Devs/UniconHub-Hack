import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

function fixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const insert = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);
  const school = insert("INSERT INTO schools (name) VALUES ('Escuela de práctica')");
  const otherSchool = insert("INSERT INTO schools (name) VALUES ('Escuela distinta')");
  const teacher = insert("INSERT INTO users (school_id,email,password_hash,full_name) VALUES (?,'practice@test.mx','secret-hash','Docente ficticia')", school);
  const group = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'A','2026-2027','GAME3A')", school, teacher);
  const otherGroup = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,4,'B','2026-2027','GAME4B')", school, teacher);
  const student = (schoolId, folio, name) => insert("INSERT INTO students (school_id,internal_folio,first_names,last_names,initials,avatar_color) VALUES (?,?,?,'Privado','AP','#123456')", schoolId, folio, name);
  const learner = student(school, 'GAME-PRIVATE-FOLIO', 'Aprendiz ficticio');
  const foreign = student(otherSchool, 'GAME-FOREIGN-FOLIO', 'Nombre otra escuela');
  for (const id of [learner, foreign]) insert("INSERT INTO group_enrollments (group_id,student_id,status) VALUES (?,?,'active')", group, id);
  const assignment = insert("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'Papel independiente','paper')", group, teacher);
  insert("INSERT INTO assignment_targets (assignment_id,student_id,is_screen_locked) VALUES (?,?,1)", assignment, learner);
  const claims = { role: 'student', sub: String(learner), groupId: group, schoolId: school };
  return { db, ids: { learner, group, otherGroup }, tokens: {
    learner: tokenFor(claims), teacher: tokenFor({ sub: String(teacher), role: 'teacher', schoolId: school }),
    foreign: tokenFor({ ...claims, sub: String(foreign) }), otherGroup: tokenFor({ ...claims, groupId: otherGroup }),
    otherSchool: tokenFor({ ...claims, schoolId: otherSchool }), missing: tokenFor({ ...claims, sub: '99999' }),
  } };
}

const ALL_CODES = ['fractions', 'multiplication', 'place_value', 'grammar_fix', 'mental_math', 'symmetry'];

describe('games API: práctica privada independiente de diagnósticos', () => {
  let fx;
  let api;
  const root = '/api/v1/games';
  const get = (path = root, token = fx.tokens.learner) => api.call('GET', path, { token });
  const submit = (code, body, token = fx.tokens.learner) => api.call('POST', `${root}/${code}/check`, { token, body });
  beforeEach(async () => {
    fx = fixtures();
    api = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });
  afterEach(async () => { await api.close(); fx.db.close(); });

  test('catálogo y retos ofrecen tres prácticas por grado sin nombres ni solución oculta', async () => {
    const catalog = await get();
    assert.equal(catalog.status, 200);
    assert.deepEqual(catalog.body.data.games.map((game) => game.code), ALL_CODES);
    // Los propios van primero y sin patrocinio; los patrocinados son demo con la marca de ejemplo.
    assert.ok(catalog.body.data.games.slice(0, 3).every((game) => game.sponsor === null));
    for (const game of catalog.body.data.games.slice(3)) {
      assert.deepEqual(Object.keys(game.sponsor).sort(), ['category', 'demo', 'name']);
      assert.equal(game.sponsor.name, 'Marca patrocinadora de ejemplo');
      assert.equal(game.sponsor.demo, true);
    }
    assert.equal(catalog.body.data.practiceOnly, true);
    assert.equal(catalog.body.data.contentReview, 'por validar con docente');
    const visitKeys = (value) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        assert.ok(!/^(answer|correct|correctAnswer|explanation|solution|internal_folio|password_hash)$/i.test(key), key);
        visitKeys(child);
      }
    };
    for (const grade of [1, 2, 3, 4, 5, 6]) {
      fx.db.prepare('UPDATE groups SET grade = ? WHERE id = ?').run(grade, fx.ids.group);
      for (const code of ALL_CODES) {
        const response = await get(`${root}/${code}`);
        assert.equal(response.status, 200);
        assert.equal(response.body.data.grade, grade);
        assert.equal(response.body.data.rounds.length, 3);
        assert.ok(response.body.data.rounds.every((round) => round.hints.length === 3));
        visitKeys(response.body);
        const serialized = JSON.stringify(response.body);
        assert.ok(!/GAME-PRIVATE-FOLIO|Aprendiz ficticio|Privado|secret-hash/.test(serialized));
      }
    }
  });

  test('acceso requiere token alumno; matrícula y escuela se revisan en cada petición', async () => {
    const endpoints = [['GET', root], ['GET', `${root}/fractions`], ['POST', `${root}/fractions/check`]];
    for (const [method, path] of endpoints) {
      const body = method === 'POST' ? { roundId: 'fractions-1', answer: 3 } : undefined;
      assert.equal((await api.call(method, path, { body })).status, 401);
      assert.equal((await api.call(method, path, { body, token: 'invalid-token' })).status, 401);
      assert.equal((await api.call(method, path, { body, token: fx.tokens.teacher })).status, 403);
      for (const token of [fx.tokens.foreign, fx.tokens.otherGroup, fx.tokens.otherSchool, fx.tokens.missing]) {
        const response = await api.call(method, path, { body, token });
        assert.equal(response.status, 403);
        assert.equal(response.body.error.code, 'STUDENT_ACCESS_REVOKED');
      }
    }
    assert.equal((await get()).status, 200);
    fx.db.prepare("UPDATE group_enrollments SET status = 'withdrawn' WHERE group_id = ? AND student_id = ?").run(fx.ids.group, fx.ids.learner);
    for (const [method, path] of endpoints) {
      const response = await api.call(method, path, { token: fx.tokens.learner, body: method === 'POST' ? { roundId: 'fractions-1', answer: 3 } : undefined });
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, 'STUDENT_ACCESS_REVOKED');
    }
  });

  test('verificar correcto e incorrecto permite repetir y jamás escribe diagnósticos ni bloquea por papel', async () => {
    const before = fx.db.prepare('SELECT total_changes() AS n').get().n;
    for (const [code, answer, wrong] of [['fractions', 3, 0], ['multiplication', [4, 4, 4], [3, 4, 5]], ['place_value', { hundreds: 1, tens: 3, units: 2 }, { hundreds: 1, tens: 2, units: 3 }]]) {
      const correct = await submit(code, { roundId: `${code}-1`, answer });
      assert.equal(correct.status, 200);
      assert.equal(correct.body.data.correct, true);
      assert.equal(typeof correct.body.data.explanation, 'string');
      const repeated = await submit(code, { roundId: `${code}-1`, answer });
      assert.deepEqual(repeated.body, correct.body);
      const incorrect = await submit(code, { roundId: `${code}-1`, answer: wrong });
      assert.equal(incorrect.status, 200);
      assert.equal(incorrect.body.data.correct, false);
      assert.ok(!/reprobado|deficiente|fallaste/i.test(JSON.stringify(incorrect.body)));
    }
    assert.equal(fx.db.prepare('SELECT total_changes() AS n').get().n, before);
    for (const table of ['student_responses', 'skill_mastery_history', 'student_achievements']) assert.equal(fx.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
    const target = fx.db.prepare('SELECT status,is_screen_locked FROM assignment_targets').get();
    assert.equal(target.status, 'pending');
    assert.equal(target.is_screen_locked, 1);
  });

  test('juegos patrocinados (demo): se revisan en el servidor y tampoco escriben nada', async () => {
    const before = fx.db.prepare('SELECT total_changes() AS n').get().n;
    const symmetry = (await get(`${root}/symmetry`)).body.data.rounds[0].material;
    const mirror = symmetry.left.map((row) => [...row].reverse());
    const wrongMirror = symmetry.left.map((row) => [...row]);
    // 3.º: "Los niños juega en el patio." → juega (2) → "juegan" (1); meta 100 → 45 + 55.
    for (const [code, answer, wrong] of [
      ['grammar_fix', { wordIndex: 2, optionIndex: 1 }, { wordIndex: 2, optionIndex: 0 }],
      ['mental_math', [0, 2], [0, 1]],
      ['symmetry', mirror, wrongMirror],
    ]) {
      const correct = await submit(code, { roundId: `${code}-1`, answer });
      assert.equal(correct.status, 200, JSON.stringify(correct.body));
      assert.equal(correct.body.data.correct, true, code);
      const incorrect = await submit(code, { roundId: `${code}-1`, answer: wrong });
      assert.equal(incorrect.body.data.correct, false, code);
      assert.ok(!/reprobado|deficiente|fallaste|compra/i.test(JSON.stringify(incorrect.body)));
    }
    // Encontrar la palabra pero escribirla mal da una pista distinta.
    const almost = await submit('grammar_fix', { roundId: 'grammar_fix-1', answer: { wordIndex: 2, optionIndex: 2 } });
    assert.match(almost.body.data.explanation, /Encontraste la palabra/);
    for (const [code, answer] of [
      ['grammar_fix', { wordIndex: 2 }], ['grammar_fix', { wordIndex: 9, optionIndex: 0 }], ['grammar_fix', { wordIndex: 2, optionIndex: 1, x: 1 }],
      ['mental_math', [0, 0]], ['mental_math', [0]], ['mental_math', [0, 7]],
      ['symmetry', [[true]]], ['symmetry', symmetry.left.map((row) => row.map(() => 1))],
    ]) assert.equal((await submit(code, { roundId: `${code}-1`, answer })).status, 400, `${code} ${JSON.stringify(answer)}`);
    assert.equal(fx.db.prepare('SELECT total_changes() AS n').get().n, before);
  });

  test('cuerpos inválidos, datos extra y override de grado se rechazan sin persistir', async () => {
    const cases = [
      ['fractions', { roundId: 'fractions-1', answer: 3, grade: 6 }],
      ['fractions', { roundId: 'fractions-1', answer: '3' }],
      ['fractions', { roundId: 'fractions-1', answer: -1 }],
      ['fractions', { roundId: 'fractions-1', answer: 5 }],
      ['fractions', { roundId: 'fractions-1', answer: 2.1 }],
      ['fractions', { roundId: 'fractions-unknown', answer: 3 }],
      ['fractions', { roundId: 'place_value-1', answer: 3 }],
      ['fractions', null], ['fractions', {}], ['fractions', []],
      ['multiplication', { roundId: 'multiplication-1', answer: [4, 4] }],
      ['multiplication', { roundId: 'multiplication-1', answer: [4, 4, '4'] }],
      ['place_value', { roundId: 'place_value-1', answer: { hundreds: 1, tens: 3, units: 2, extra: 1 } }],
      ['place_value', { roundId: 'place_value-1', answer: { hundreds: 1, tens: 3, units: 12 } }],
    ];
    for (const [code, body] of cases) {
      const response = await submit(code, body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.error.code, body === null ? 'INVALID_JSON' : 'VALIDATION_ERROR');
    }
    const missing = await get(`${root}/unknown`);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'GAME_NOT_FOUND');
    assert.equal((await submit('unknown', { roundId: 'fractions-1', answer: 3 })).status, 404);
    // El grado viene del grupo aunque el cliente intente sustituirlo por query string.
    assert.equal((await get(`${root}/place_value?grade=1`)).body.data.grade, 3);
  });
});
