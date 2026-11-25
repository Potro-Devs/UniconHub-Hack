/**
 * Ciclo con datos reales sobre el seed demo: el alumno abre la práctica abierta en pantalla,
 * pide una pista, contesta, termina; se registra el corte de dominio y el mapa del docente cambia.
 * También cubre que la práctica se agregue a una base ya sembrada sin duplicarse.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { runSeed } from '../src/db/seed.js';
import { PRACTICE } from '../src/db/seed/practice.seed.js';
import { configWith, silentLogger, startServer } from './helpers.js';

describe('práctica abierta: del alumno al mapa del docente', () => {
  let db;
  let api;
  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });
  after(async () => { await api.close(); db.close(); });

  test('el alumno contesta la práctica y el mapa del grupo registra un nuevo corte', async () => {
    const student = (await api.call('POST', '/api/v1/auth/quick-login/student')).body.data;
    const teacher = (await api.call('POST', '/api/v1/auth/quick-login/teacher')).body.data;
    const studentId = student.student.id;
    const groupId = student.group.id;

    const list = await api.call('GET', `/api/v1/diagnostics/students/${studentId}/assignments`, { token: student.token });
    const practice = list.body.data.find((a) => a.title === PRACTICE.title);
    assert.ok(practice, 'la práctica aparece en la mochila del alumno');
    assert.equal(practice.modality, 'screen');
    assert.equal(practice.isScreenLocked, false);
    assert.equal(practice.status, 'pending');

    const mapBefore = (await api.call('GET', `/api/v1/analytics/groups/${groupId}`, { token: teacher.token })).body.data;
    const cutsBefore = db.prepare(`SELECT COUNT(*) AS n FROM skill_mastery_history h JOIN skills s ON s.id = h.skill_id
      WHERE h.student_id = ? AND s.code = 'multiplication'`).get(studentId).n;

    const start = await api.call('GET', `/api/v1/diagnostics/assignments/${practice.id}/start`, { token: student.token });
    assert.equal(start.status, 200);
    const { questions } = start.body.data;
    assert.ok(questions.length >= 3);
    assert.ok(questions.every((q) => q.options.every((o) => !('isCorrect' in o) && !('errorTag' in o))), 'no expone la respuesta correcta');

    // Pista 1 en la primera pregunta, luego contesta todas (siempre la primera opción).
    const hint = await api.call('POST', `/api/v1/diagnostics/assignments/${practice.id}/questions/${questions[0].id}/hints`,
      { token: student.token, body: { level: 1 } });
    assert.equal(hint.status, 200);
    assert.equal(typeof hint.body.data.hint, 'string');
    for (const q of questions) {
      const res = await api.call('POST', `/api/v1/diagnostics/assignments/${practice.id}/answer`,
        { token: student.token, body: { questionId: q.id, selectedOptionId: q.options[0].id } });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.feedback, 'Respuesta guardada.');
    }
    const done = await api.call('POST', `/api/v1/diagnostics/assignments/${practice.id}/complete`, { token: student.token });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.status, 'completed_screen');
    const skill = done.body.data.skills.find((s) => s.code === 'multiplication');
    assert.equal(skill.masteryRecorded, true);

    const cutsAfter = db.prepare(`SELECT COUNT(*) AS n FROM skill_mastery_history h JOIN skills s ON s.id = h.skill_id
      WHERE h.student_id = ? AND s.code = 'multiplication'`).get(studentId).n;
    assert.equal(cutsAfter, cutsBefore + 1, 'nuevo corte inmutable de dominio');

    const mapAfter = (await api.call('GET', `/api/v1/analytics/groups/${groupId}`, { token: teacher.token })).body.data;
    const before = mapBefore.students.find((s) => s.id === studentId).skills.find((s) => s.code === 'multiplication');
    const afterSkill = mapAfter.students.find((s) => s.id === studentId).skills.find((s) => s.code === 'multiplication');
    assert.ok(afterSkill.recordedAt >= before.recordedAt, 'el mapa muestra el corte más reciente');
    assert.equal(afterSkill.masteryPercentage, skill.masteryPercentage);

    // Ya no puede volver a contestarla.
    const again = await api.call('GET', `/api/v1/diagnostics/assignments/${practice.id}/start`, { token: student.token });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'ALREADY_COMPLETED');
  });

  test('una base sembrada antes recibe la práctica una sola vez', () => {
    const old = openDatabase(':memory:');
    runMigrations(old);
    runSeed(old);
    const practiceId = old.prepare('SELECT id FROM assignments WHERE title = ?').get(PRACTICE.title).id;
    old.prepare('DELETE FROM assignment_targets WHERE assignment_id = ?').run(practiceId);
    old.prepare('DELETE FROM assignment_questions WHERE assignment_id = ?').run(practiceId);
    old.prepare('DELETE FROM assignments WHERE id = ?').run(practiceId);
    assert.equal(runSeed(old).practiceAdded, true);
    assert.equal(runSeed(old).practiceAdded, undefined);
    assert.equal(old.prepare('SELECT COUNT(*) AS n FROM assignments WHERE title = ?').get(PRACTICE.title).n, 1);
    old.close();
  });
});
