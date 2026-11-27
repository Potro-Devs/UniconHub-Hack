/** Contratos del panel Temario → asignación → alumno/papel → analítica, con datos ficticios en memoria. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { runSeed } from '../src/db/seed.js';
import { configWith, silentLogger, startServer } from './helpers.js';

describe('Temario y asignaciones reales: contrato de orquestación HTTP', () => {
  let db, api, teacher, student, groupId;
  const staff = () => ({ token: teacher.token });
  const curriculum = () => `/api/v1/curriculum/groups/${groupId}`;
  const assignments = () => `/api/v1/assessments/groups/${groupId}/assignments`;
  const profile = (studentId) => `/api/v1/analytics/groups/${groupId}/students/${studentId}`;
  const create = async (body) => {
    const res = await api.call('POST', assignments(), { ...staff(), body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  };
  const skill = (data, code = 'fractions') => data.skills.find((s) => s.code === code);
  const answersOf = (assignment) => Object.fromEntries(assignment.questions.map((q) => [q.id, q.options.find((o) => o.isCorrect).id]));

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
    teacher = (await api.call('POST', '/api/v1/auth/quick-login/teacher')).body.data;
    student = (await api.call('POST', '/api/v1/auth/quick-login/student')).body.data;
    groupId = student.group.id;
  });
  after(async () => { await api?.close(); db?.close(); });

  test('estado y notas persisten al volver a cargar; cobertura refleja el contenido visto', async () => {
    const list = await api.call('GET', curriculum(), staff());
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length);
    const content = list.body.data.find((c) => c.status !== 'seen');
    assert.ok(content);
    const beforeCoverage = (await api.call('GET', `${curriculum()}/coverage`, staff())).body.data;
    const patch = await api.call('PATCH', `${curriculum()}/contents/${content.id}`, {
      ...staff(), body: { status: 'seen', notes: 'Practicar con material concreto, sin datos personales.' },
    });
    assert.equal(patch.status, 200);
    const saved = (await api.call('GET', curriculum(), staff())).body.data.find((c) => c.id === content.id);
    assert.equal(saved.status, 'seen');
    assert.equal(saved.notes, 'Practicar con material concreto, sin datos personales.');
    const coverage = (await api.call('GET', `${curriculum()}/coverage`, staff())).body.data;
    assert.equal(coverage.seen, beforeCoverage.seen + 1);
    assert.ok(coverage.coveragePercentage > beforeCoverage.coveragePercentage);
    assert.ok(Array.isArray(coverage.bySkill));
  });

  test('pantalla: todo el grupo y selección, pistas y cierre actualizan mapa, perfil y progreso propio', async () => {
    const assignment = await create({ title: 'Contrato de pantalla', modality: 'screen', skills: ['fractions'] });
    assert.equal(assignment.targets.length, 45);
    const subset = await create({ title: 'Contrato destinatario específico', modality: 'screen', skills: ['fractions'], studentIds: [student.student.id] });
    assert.deepEqual(subset.targets.map((t) => t.studentId), [student.student.id]);
    const visible = await api.call('GET', `/api/v1/diagnostics/students/${student.student.id}/assignments`, { token: student.token });
    assert.ok(visible.body.data.some((a) => a.id === assignment.id && a.modality === 'screen'));
    const start = await api.call('GET', `/api/v1/diagnostics/assignments/${assignment.id}/start`, { token: student.token });
    assert.equal(start.status, 200);
    assert.ok(start.body.data.questions.every((q) => q.options.every((o) => !('isCorrect' in o))));
    const answers = answersOf(assignment);
    const first = assignment.questions[0];
    assert.equal((await api.call('POST', `/api/v1/diagnostics/assignments/${assignment.id}/questions/${first.id}/hints`, { token: student.token, body: { level: 1 } })).status, 200);
    for (const q of assignment.questions) {
      assert.equal((await api.call('POST', `/api/v1/diagnostics/assignments/${assignment.id}/answer`, { token: student.token, body: { questionId: q.id, selectedOptionId: answers[q.id] } })).status, 200);
    }
    const completed = await api.call('POST', `/api/v1/diagnostics/assignments/${assignment.id}/complete`, { token: student.token });
    assert.equal(completed.status, 200);
    assert.equal(skill(completed.body.data).achievedWithSupport, 1);
    assert.equal(skill(completed.body.data).correctAutonomous, assignment.questions.length - 1);
    const map = (await api.call('GET', `/api/v1/analytics/groups/${groupId}`, staff())).body.data;
    const mapped = skill(map.students.find((s) => s.id === student.student.id));
    assert.ok(mapped.supportedPercentage > 0);
    const individual = (await api.call('GET', profile(student.student.id), staff())).body.data;
    assert.equal(skill(individual).masteryPercentage, skill(completed.body.data).masteryPercentage);
    const progress = await api.call('GET', `/api/v1/diagnostics/students/${student.student.id}/progress`, { token: student.token });
    assert.equal(progress.status, 200);
    assert.equal(skill(progress.body.data).masteryPercentage, skill(individual).masteryPercentage);
    assert.ok(progress.body.data.achievements.some((a) => a.code === 'block_completed'));
    assert.doesNotMatch(JSON.stringify(progress.body), /internal_?folio|password_hash|CURP/);
  });

  test('papel: PDF y pistas, tres capturas, apoyo y bloqueo de pantalla', async () => {
    const students = (await api.call('GET', `/api/v1/groups/${groupId}/students`, staff())).body.data;
    const recipients = [student.student.id, ...students.filter((s) => s.id !== student.student.id).slice(0, 2).map((s) => s.id)];
    const assignment = await create({ title: 'Contrato papel genérico', modality: 'paper', skills: ['fractions'], studentIds: recipients });
    assert.ok(assignment.targets.every((t) => t.isScreenLocked));
    for (const suffix of ['pdf', 'hints-pdf']) {
      const res = await fetch(`${api.base}/api/v1/paper/assignments/${assignment.id}/${suffix}`, { headers: { authorization: `Bearer ${teacher.token}` } });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /application\/pdf/);
      const bytes = Buffer.from(await res.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      assert.ok(bytes.length > 1000);
    }
    const answers = answersOf(assignment);
    for (const [index, studentId] of recipients.entries()) {
      const res = await api.call('POST', `/api/v1/paper/assignments/${assignment.id}/capture/${studentId}`, { ...staff(), body: { answers, supportUsed: index === 0 } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.status, 'completed_paper');
      assert.equal(res.body.data.summary.achievedWithSupport, index === 0 ? assignment.questions.length : 0);
      const individual = (await api.call('GET', profile(studentId), staff())).body.data;
      assert.equal(skill(individual).masteryPercentage, skill(res.body.data).masteryPercentage);
      if (index === 0) {
        assert.equal(skill(individual).autonomousPercentage, 0);
        assert.equal(skill(individual).supportedPercentage, 100);
      }
    }
    const status = await api.call('GET', `/api/v1/paper/assignments/${assignment.id}/capture-status`, staff());
    assert.deepEqual([status.body.data.total, status.body.data.captured, status.body.data.pending], [3, 3, 0]);
    const blocked = await api.call('GET', `/api/v1/diagnostics/assignments/${assignment.id}/start`, { token: student.token });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, 'SCREEN_LOCKED');
    const map = (await api.call('GET', `/api/v1/analytics/groups/${groupId}`, staff())).body.data;
    assert.equal(skill(map.students.find((s) => s.id === student.student.id)).supportedPercentage, 100);
  });

  test('menos de tres reactivos de una habilidad impide crear y no deja asignaciones parciales', async () => {
    // Aislamos temporalmente el banco de esta DB ficticia y restauramos los grados en finally.
    const count = () => db.prepare('SELECT COUNT(*) AS n FROM assignments').get().n;
    const beforeCount = count();
    const moved = db.prepare("SELECT q.id FROM questions q JOIN skills s ON s.id=q.skill_id WHERE q.grade=3 AND s.code='fractions' ORDER BY q.id LIMIT -1 OFFSET 2").all();
    try {
      const keep = db.prepare("SELECT q.id FROM questions q JOIN skills s ON s.id=q.skill_id WHERE q.grade=3 AND s.code='fractions' ORDER BY q.id LIMIT 2").all().map((q) => q.id);
      assert.equal(keep.length, 2);
      db.prepare("UPDATE questions SET grade=6 WHERE grade=3 AND skill_id=(SELECT id FROM skills WHERE code='fractions') AND id NOT IN (?, ?)").run(...keep);
      const res = await api.call('POST', assignments(), { ...staff(), body: { title: 'No debe crearse', modality: 'screen', skills: ['fractions'] } });
      assert.equal(res.status, 422, JSON.stringify(res.body));
      assert.equal(res.body.error.code, 'INSUFFICIENT_QUESTIONS_PER_SKILL');
      assert.deepEqual(res.body.error.details.insufficient, [{ skill: 'fractions', count: 2, missing: 1 }]);
      assert.equal(count(), beforeCount);
    } finally {
      const restore = db.prepare('UPDATE questions SET grade=3 WHERE id=?');
      for (const question of moved) restore.run(question.id);
    }
  });
});
