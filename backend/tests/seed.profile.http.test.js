/**
 * Seed alineado al programa de cada grado, visto por HTTP: perfil longitudinal de la alumna
 * destacada (Sofía), mapa de 3.º A y panel de Dirección. Datos ficticios (SQLite :memory:).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import { FEATURED_STUDENT } from '../src/db/seed/demo.data.js';
import { createApp } from '../src/app.js';
import { SKILL_GRADE_RANGE, isSkillInGrade } from '../src/modules/curriculum/curriculum.domain.js';
import { configWith, silentLogger, startServer } from './helpers.js';

const LEVEL = (p) => (p < 25 ? 'needs_support' : p < 50 ? 'in_progress' : p < 75 ? 'achieved' : 'mastered');
const LEAK = /AXI-[A-Z2-9]{8}|internal_?folio|password|curp/i;

describe('seed alineado por grado: perfil de Sofía, mapa y panel (HTTP)', () => {
  let db;
  let api;
  let teacher;
  let director;
  let groupId;
  let sofiaId;

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
    teacher = (await api.call('POST', '/api/v1/auth/quick-login/teacher')).body.data.token;
    director = (await api.call('POST', '/api/v1/auth/quick-login/director')).body.data.token;
    groupId = db.prepare('SELECT id FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode).id;
    sofiaId = db.prepare(`SELECT s.id FROM students s JOIN group_enrollments e ON e.student_id = s.id
      WHERE e.group_id = ? AND s.first_names = 'Sofía'`).get(groupId).id;
  });

  after(async () => {
    await api?.close();
    db?.close();
  });

  test('FEATURED_STUDENT no trae habilidades fuera del programa de 1.º y 2.º', () => {
    for (const code of Object.keys(FEATURED_STUDENT.firstGrade)) assert.ok(isSkillInGrade(code, 1), `1.º ${code}`);
    for (const code of Object.keys(FEATURED_STUDENT.secondGrade)) assert.ok(isSkillInGrade(code, 2), `2.º ${code}`);
  });

  test('el código de grupo muestra la tarjeta de Sofía sin folio y el acceso la identifica', async () => {
    const join = await api.call('POST', '/api/v1/auth/student-join', { body: { joinCode: DEMO.currentGroup.joinCode } });
    assert.equal(join.status, 200);
    assert.equal(join.body.data.students.length, 45);
    assert.ok(!LEAK.test(JSON.stringify(join.body)));
    const card = join.body.data.students.find((s) => s.id === sofiaId);
    assert.equal(card.displayName, 'Sofía R.');
    const sel = await api.call('POST', '/api/v1/auth/student-join/select', { body: { joinCode: DEMO.currentGroup.joinCode, studentId: sofiaId } });
    assert.equal(sel.status, 200);
    assert.equal(sel.body.data.student.id, sofiaId);
  });

  test('perfil: historial de 1.º, 2.º y 3.º solo con habilidades del grado', async () => {
    const res = await api.call('GET', `/api/v1/analytics/groups/${groupId}/students/${sofiaId}`, { token: teacher });
    assert.equal(res.status, 200);
    assert.ok(!LEAK.test(JSON.stringify(res.body)), 'el perfil no expone folio ni credenciales');
    const { history } = res.body.data;
    assert.deepEqual([...new Set(history.map((h) => h.grade))].sort(), [1, 2, 3]);
    for (const h of history) assert.ok(isSkillInGrade(h.skillCode, h.grade), `${h.skillCode} en ${h.grade}.º`);
    const at = (grade) => history.filter((h) => h.grade === grade).map((h) => h.skillCode).sort();
    assert.deepEqual(at(1), Object.keys(FEATURED_STUDENT.firstGrade).sort());
    assert.deepEqual(at(2), Object.keys(FEATURED_STUDENT.secondGrade).sort());
    for (const h of history.filter((x) => x.grade < 3)) {
      const scores = h.grade === 1 ? FEATURED_STUDENT.firstGrade : FEATURED_STUDENT.secondGrade;
      assert.equal(h.sessionPercentage, scores[h.skillCode], `${h.skillCode} ${h.grade}.º`);
    }
  });

  test('perfil: el dominio de cada corte es el promedio ponderado w_i = i y su nivel sigue la escala de 25%', async () => {
    const { history, skills } = (await api.call('GET', `/api/v1/analytics/groups/${groupId}/students/${sofiaId}`, { token: teacher })).body.data;
    const bySkill = Map.groupBy(history, (h) => h.skillCode);
    for (const [code, cuts] of bySkill) {
      const sorted = [...cuts].sort((a, b) => a.sessionIndex - b.sessionIndex);
      assert.deepEqual(sorted.map((c) => c.sessionIndex), sorted.map((_, i) => i + 1), `${code}: índices de sesión consecutivos`);
      sorted.forEach((cut, i) => {
        const upTo = sorted.slice(0, i + 1);
        const expected = upTo.reduce((s, c, j) => s + (j + 1) * c.sessionPercentage, 0) / upTo.reduce((s, _, j) => s + j + 1, 0);
        assert.ok(Math.abs(cut.masteryPercentage - expected) < 0.01, `${code} sesión ${cut.sessionIndex}: ${cut.masteryPercentage} vs ${expected}`);
        assert.equal(cut.level, LEVEL(cut.masteryPercentage), `${code} sesión ${cut.sessionIndex}`);
      });
      const current = skills.find((s) => s.code === code);
      assert.equal(current.masteryPercentage, sorted.at(-1).masteryPercentage, `${code}: dominio actual = último corte`);
    }
    assert.deepEqual(bySkill.get('problem_solving').map((c) => c.level), ['in_progress', 'in_progress', 'achieved']);
    // Fracciones de 3.º se asignó en papel y sigue pendiente: sin evaluar, nunca 0 %.
    const fr = skills.find((s) => s.code === 'fractions');
    assert.equal(fr.masteryPercentage, null);
    assert.equal(fr.label, 'Sin evaluar');
  });

  test('perfil: "Logrado con apoyo" va aparte del dominio autónomo', async () => {
    const { skills } = (await api.call('GET', `/api/v1/analytics/groups/${groupId}/students/${sofiaId}`, { token: teacher })).body.data;
    for (const s of skills.filter((x) => x.masteryPercentage !== null)) {
      assert.equal(typeof s.autonomousPercentage, 'number', s.code);
      assert.equal(typeof s.supportedPercentage, 'number', s.code);
      assert.ok(s.autonomousPercentage + s.supportedPercentage <= 100.001, s.code);
    }
  });

  test('mapa de 3.º A: 45 alumnos, 5 habilidades del grado, fracciones sin evaluar', async () => {
    const res = await api.call('GET', `/api/v1/analytics/groups/${groupId}`, { token: teacher });
    assert.equal(res.status, 200);
    assert.ok(!LEAK.test(JSON.stringify(res.body)));
    const { skills, students } = res.body.data;
    assert.equal(students.length, 45);
    assert.deepEqual(skills.map((s) => s.code).sort(), Object.keys(SKILL_GRADE_RANGE).filter((c) => isSkillInGrade(c, 3)).sort());
    const fr = skills.find((s) => s.code === 'fractions');
    assert.equal(fr.evaluatedCount, 0);
    assert.equal(fr.distribution.not_evaluated, 45);
    for (const s of skills.filter((x) => x.average !== null)) assert.equal(s.level, LEVEL(s.average), s.code);
  });

  test('panel de Dirección: rango de grados por habilidad y evaluados solo en grupos que la trabajan', async () => {
    const res = await api.call('GET', '/api/v1/analytics/school', { token: director });
    assert.equal(res.status, 200);
    assert.ok(!LEAK.test(JSON.stringify(res.body)));
    const { skills, groups, summary } = res.body.data;
    assert.equal(summary.studentCount, groups.reduce((s, g) => s + g.studentCount, 0));
    for (const s of skills) {
      const { from, to } = SKILL_GRADE_RANGE[s.code];
      assert.equal(s.grades, `${from}.º a ${to}.º`, s.code);
      const eligible = groups.filter((g) => isSkillInGrade(s.code, g.grade)).reduce((n, g) => n + g.studentCount, 0);
      assert.ok(s.evaluatedCount <= eligible, `${s.code}: ${s.evaluatedCount} evaluados de ${eligible} posibles`);
      if (s.average !== null) assert.equal(s.level, LEVEL(s.average), s.code);
    }
    for (const g of groups) {
      for (const s of g.skills) assert.ok(isSkillInGrade(s.code, g.grade), `${g.name} reporta ${s.code}`);
      if (g.prioritySkill) assert.ok(isSkillInGrade(g.prioritySkill.code, g.grade), `${g.name} prioriza ${g.prioritySkill.code}`);
    }
  });

  test('las prioridades de habilidad solo señalan grupos del rango de esa habilidad', async () => {
    const { priorities, groups } = (await api.call('GET', '/api/v1/analytics/school', { token: director })).body.data;
    const gradeOf = new Map(groups.map((g) => [g.id, g.grade]));
    for (const p of priorities.filter((x) => x.type === 'skill')) {
      for (const id of p.groupIds) assert.ok(isSkillInGrade(p.skillCode, gradeOf.get(id)), `${p.skillCode} en grupo ${id}`);
    }
  });
});
