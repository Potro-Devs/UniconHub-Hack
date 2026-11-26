/**
 * Aviso de banco anterior: una base sembrada antes de alinear el banco por grado
 * (p. ej. fracciones en 1.º) se reporta con `outdatedBank: true` sin borrar datos.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { hasOutdatedQuestionBank, runSeed } from '../src/db/seed.js';

describe('hasOutdatedQuestionBank / runSeed en base ya sembrada', () => {
  let db;

  before(() => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
  });

  after(() => db.close());

  test('el banco recién sembrado no se marca como anterior', () => {
    assert.equal(hasOutdatedQuestionBank(db), false);
    assert.equal('outdatedBank' in runSeed(db), false);
  });

  test('un reactivo de fracciones en 1.º marca la base como anterior y no se borra nada', () => {
    const q = db.prepare(`SELECT q.id FROM questions q JOIN skills s ON s.id = q.skill_id
      WHERE s.code = 'fractions' AND q.grade = 3 LIMIT 1`).get();
    db.prepare('UPDATE questions SET grade = 1 WHERE id = ?').run(q.id);
    const questions = db.prepare('SELECT count(*) AS n FROM questions').get().n;
    assert.equal(hasOutdatedQuestionBank(db), true);
    const result = runSeed(db);
    assert.equal(result.outdatedBank, true);
    assert.equal(result.seeded, false);
    assert.equal(db.prepare('SELECT count(*) AS n FROM questions').get().n, questions);
  });

  test('multiplicación en 1.º también cuenta como banco anterior', () => {
    db.prepare("UPDATE questions SET grade = 3 WHERE grade = 1 AND skill_id = (SELECT id FROM skills WHERE code = 'fractions')").run();
    assert.equal(hasOutdatedQuestionBank(db), false);
    db.prepare(`UPDATE questions SET grade = 1 WHERE id = (SELECT q.id FROM questions q JOIN skills s ON s.id = q.skill_id
      WHERE s.code = 'multiplication' AND q.grade = 2 LIMIT 1)`).run();
    assert.equal(hasOutdatedQuestionBank(db), true);
  });
});
