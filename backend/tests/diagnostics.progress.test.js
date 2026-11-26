import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * Grupo de 2.º A (fracciones no está en el programa de 2.º).
 * Sofía: 2 cortes de valor posicional (40 % → 80 %), 1 corte de fracciones heredado y 2 logros.
 * Mateo: sin cortes y 1 logro. Diego: dado de baja.
 * Datos ficticios, no es contenido pedagógico.
 */
function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const school = id("INSERT INTO schools (name) VALUES ('Escuela A')");
  const teacher = id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, 'a@axi.test', 'x', 'Persona Demo', 'teacher')", school);
  const group = id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 2, 'A', '2026-2027', 'PROG2A')", school, teacher);

  const student = (first, folio, status) => {
    const sid = id(
      "INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, 'Demo', 'XX', '#F4B6C2')",
      school, folio, first,
    );
    db.prepare('INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, ?)').run(group, sid, status);
    return sid;
  };
  const sofia = student('Sofía', 'AXI-AAAAAAAA', 'active');
  const mateo = student('Mateo', 'AXI-BBBBBBBB', 'active');
  const diego = student('Diego', 'AXI-CCCCCCCC', 'withdrawn');

  const skill = {};
  for (const [code, name] of [
    ['fractions', 'Fracciones'], ['multiplication', 'Multiplicaciones'], ['place_value', 'Valor posicional'],
    ['problem_solving', 'Resolución de problemas'], ['reading_comprehension', 'Comprensión lectora'],
  ]) skill[code] = id('INSERT INTO skills (code, name) VALUES (?, ?)', code, name);

  const assignment = id("INSERT INTO assignments (group_id, created_by, title, modality) VALUES (?, ?, 'Repaso de decenas', 'screen')", group, teacher);
  const cut = (s, sk, assignmentId, grade, index, mastery, level, autonomous, at) =>
    db.prepare(`INSERT INTO skill_mastery_history (student_id, skill_id, assignment_id, grade, session_index, session_percentage,
        autonomous_percentage, supported_percentage, mastery_percentage, mastery_level, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).run(s, sk, assignmentId, grade, index, mastery, autonomous, mastery, level, at);
  cut(sofia, skill.place_value, assignment, 2, 1, 40, 'in_progress', 20, '2026-09-01 10:00:00');
  cut(sofia, skill.place_value, assignment, 2, 2, 80, 'mastered', 60, '2026-10-01 10:00:00');
  cut(sofia, skill.fractions, null, 2, 1, 30, 'in_progress', 30, '2026-08-01 10:00:00');

  const achievement = (s, code, size, sk, a, at) =>
    db.prepare('INSERT INTO student_achievements (student_id, achievement_code, size, skill_id, assignment_id, awarded_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(s, code, size, sk, a, at);
  achievement(sofia, 'block_completed', 'small', null, assignment, '2026-10-01 10:00:00');
  achievement(sofia, 'level_up', 'medium', skill.place_value, assignment, '2026-10-01 10:00:01');
  achievement(mateo, 'block_completed', 'small', null, assignment, '2026-10-02 10:00:00');

  const studentToken = (sid) => tokenFor({ sub: String(sid), role: 'student', schoolId: school, groupId: group });
  return {
    db,
    ids: { sofia, mateo, diego },
    tokens: {
      sofia: studentToken(sofia),
      mateo: studentToken(mateo),
      diego: studentToken(diego),
      teacher: tokenFor({ sub: String(teacher), role: 'teacher', schoolId: school }),
    },
  };
}

describe('GET /diagnostics/students/:studentId/progress', () => {
  let server;
  let ids;
  let tokens;
  const path = (sid) => `/api/v1/diagnostics/students/${sid}/progress`;

  before(async () => {
    const fx = createFixtures();
    ({ ids, tokens } = fx);
    server = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });
  after(() => server.close());

  test('dominio por habilidad del grado, más las que ya tienen historial', async () => {
    const res = await server.call('GET', path(ids.sofia), { token: tokens.sofia });
    assert.equal(res.status, 200);
    const { grade, skills } = res.body.data;
    assert.equal(grade, 2);
    // Fracciones no es de 2.º, pero aparece porque Sofía ya tiene un corte.
    assert.deepEqual(skills.map((s) => s.code), ['fractions', 'multiplication', 'place_value', 'problem_solving', 'reading_comprehension']);

    const placeValue = skills.find((s) => s.code === 'place_value');
    assert.equal(placeValue.masteryPercentage, 80);
    assert.equal(placeValue.level, 'mastered');
    assert.equal(placeValue.label, 'Dominado');
    assert.equal(placeValue.sessionCount, 2);
    assert.equal(placeValue.autonomyTrend.trend, 'toward_autonomy');

    const multiplication = skills.find((s) => s.code === 'multiplication');
    assert.deepEqual(
      [multiplication.masteryPercentage, multiplication.level, multiplication.label, multiplication.sessionCount],
      [null, null, 'Sin evaluar', 0],
    );
  });

  test('logros propios, más recientes primero, con texto para el alumno', async () => {
    const res = await server.call('GET', path(ids.sofia), { token: tokens.sofia });
    const { achievements } = res.body.data;
    assert.deepEqual(achievements.map((a) => [a.code, a.size, a.title]), [
      ['level_up', 'medium', 'Subiste de nivel'],
      ['block_completed', 'small', 'Prueba terminada'],
    ]);
    assert.equal(achievements[0].description, 'Avanzaste un nivel en Valor posicional.');
    assert.equal(achievements[0].skillCode, 'place_value');
    assert.equal(achievements[1].description, 'Terminaste "Repaso de decenas".');
    assert.equal(achievements[1].skillCode, null);
  });

  test('sin datos de otros alumnos ni folio', async () => {
    const sofia = await server.call('GET', path(ids.sofia), { token: tokens.sofia });
    assert.doesNotMatch(JSON.stringify(sofia.body), /AXI-|Mateo|Diego|rank/i);

    const mateo = await server.call('GET', path(ids.mateo), { token: tokens.mateo });
    assert.equal(mateo.status, 200);
    assert.equal(mateo.body.data.achievements.length, 1);
    // Sin historial de fracciones, no se muestra (no es de 2.º).
    assert.ok(!mateo.body.data.skills.some((s) => s.code === 'fractions'));
    assert.ok(mateo.body.data.skills.every((s) => s.masteryPercentage === null));
  });

  test('otro alumno, dado de baja o id inválido → 404 / 400', async () => {
    const other = await server.call('GET', path(ids.mateo), { token: tokens.sofia });
    assert.equal(other.status, 404);
    assert.equal(other.body.error.code, 'STUDENT_NOT_FOUND');
    assert.equal((await server.call('GET', path(ids.diego), { token: tokens.diego })).status, 404);
    assert.equal((await server.call('GET', path('abc'), { token: tokens.sofia })).status, 400);
  });

  test('docente → 403, sin sesión → 401', async () => {
    assert.equal((await server.call('GET', path(ids.sofia), { token: tokens.teacher })).status, 403);
    assert.equal((await server.call('GET', path(ids.sofia))).status, 401);
  });
});
