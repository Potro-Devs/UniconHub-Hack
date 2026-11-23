import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { openDatabase, withTransaction } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';

const EXPECTED_TABLES = [
  'schools', 'users', 'groups', 'students', 'group_enrollments', 'skills',
  'curriculum_contents', 'group_curriculum_progress', 'questions', 'question_options',
  'assignments', 'assignment_questions', 'assignment_targets', 'student_responses',
  'skill_mastery_history', 'student_achievements', 'recommended_activities',
];

describe('conexión SQLite', () => {
  let tmpDir;
  let db;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-db-'));
    db = openDatabase(path.join(tmpDir, 'nested', 'axi.db'));
  });

  after(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('crea la carpeta del archivo y aplica los PRAGMAs obligatorios', () => {
    assert.ok(fs.existsSync(path.join(tmpDir, 'nested', 'axi.db')));
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    assert.equal(db.prepare('PRAGMA busy_timeout').get().timeout, 5000);
  });

  test('withTransaction hace ROLLBACK si falla', () => {
    db.exec('CREATE TABLE t (v INTEGER)');
    assert.throws(() =>
      withTransaction(db, () => {
        db.exec('INSERT INTO t VALUES (1)');
        throw new Error('falla');
      }),
    );
    assert.equal(db.prepare('SELECT count(*) AS n FROM t').get().n, 0);
  });
});

describe('migraciones', () => {
  let db;

  before(() => {
    db = openDatabase(':memory:');
    runMigrations(db);
  });

  after(() => db.close());

  test('crea las 17 tablas del modelo', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    for (const table of EXPECTED_TABLES) {
      assert.ok(tables.includes(table), `falta la tabla ${table}`);
    }
  });

  test('no vuelve a aplicar migraciones ya registradas', () => {
    assert.deepEqual(runMigrations(db), []);
  });

  test('no existe ninguna columna de CURP', () => {
    for (const table of EXPECTED_TABLES) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all();
      assert.ok(!columns.some((c) => /curp/i.test(c.name)), `${table} tiene columna CURP`);
    }
  });
});

describe('reglas garantizadas por el esquema', () => {
  let db;
  const ids = {};

  before(() => {
    db = openDatabase(':memory:');
    runMigrations(db);

    ids.school = db.prepare("INSERT INTO schools (name) VALUES ('Escuela demo')").run().lastInsertRowid;
    ids.teacher = db
      .prepare("INSERT INTO users (school_id, email, password_hash, full_name) VALUES (?, 'demo@axi.mx', 'x', 'Docente demo')")
      .run(ids.school).lastInsertRowid;
    ids.group = db
      .prepare("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'A', '2026-2027', 'ABC123')")
      .run(ids.school, ids.teacher).lastInsertRowid;
    ids.student = db
      .prepare("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, 'AXI-000001', 'Sofía', 'Ramírez', 'SR', '#F4B6C2')")
      .run(ids.school).lastInsertRowid;
    ids.skill = db.prepare("INSERT INTO skills (code, name) VALUES ('fractions', 'Fracciones')").run().lastInsertRowid;
    ids.question = db
      .prepare("INSERT INTO questions (skill_id, grade, stem, hint_1, hint_2, hint_3) VALUES (?, 3, '¿Qué fracción?', 'h1', 'h2', 'h3')")
      .run(ids.skill).lastInsertRowid;
    ids.correct = db
      .prepare("INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'A', '1/4', 1)")
      .run(ids.question).lastInsertRowid;
    ids.wrong = db
      .prepare("INSERT INTO question_options (question_id, label, text, error_tag, error_explanation) VALUES (?, 'B', '4/1', 'inverts_fraction', 'Invierte numerador y denominador')")
      .run(ids.question).lastInsertRowid;
    ids.assignment = db
      .prepare("INSERT INTO assignments (group_id, created_by, title, modality) VALUES (?, ?, 'Fracciones 1', 'screen')")
      .run(ids.group, ids.teacher).lastInsertRowid;
    ids.target = db
      .prepare('INSERT INTO assignment_targets (assignment_id, student_id) VALUES (?, ?)')
      .run(ids.assignment, ids.student).lastInsertRowid;
  });

  after(() => db.close());

  test('aplica llaves foráneas', () => {
    assert.throws(
      () => db.prepare('INSERT INTO group_enrollments (group_id, student_id) VALUES (999, ?)').run(ids.student),
      /FOREIGN KEY/,
    );
  });

  test('rechaza un distractor sin error_tag', () => {
    assert.throws(
      () => db.prepare("INSERT INTO question_options (question_id, label, text) VALUES (?, 'C', '2/4')").run(ids.question),
      /CHECK/,
    );
  });

  test('permite una sola opción correcta por reactivo', () => {
    assert.throws(
      () => db.prepare("INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'D', '1/4', 1)").run(ids.question),
      /UNIQUE/,
    );
  });

  test('outcome_status debe ser coherente con la pista usada', () => {
    const insert = db.prepare(
      "INSERT INTO student_responses (assignment_target_id, question_id, selected_option_id, outcome_status, max_hint_level_used, source) VALUES (?, ?, ?, ?, ?, 'screen')",
    );
    assert.throws(() => insert.run(ids.target, ids.question, ids.correct, 'correct_autonomous', 2), /CHECK/);
    insert.run(ids.target, ids.question, ids.correct, 'achieved_with_support', 2);
  });

  test('completed_paper exige is_screen_locked = 1', () => {
    assert.throws(
      () => db.prepare("UPDATE assignment_targets SET status = 'completed_paper' WHERE id = ?").run(ids.target),
      /CHECK/,
    );
    db.prepare("UPDATE assignment_targets SET status = 'completed_paper', is_screen_locked = 1 WHERE id = ?").run(ids.target);
  });

  test('mastery_level sigue la escala de 25%', () => {
    const insert = db.prepare(
      'INSERT INTO skill_mastery_history (student_id, skill_id, grade, session_index, session_percentage, autonomous_percentage, supported_percentage, mastery_percentage, mastery_level) VALUES (?, ?, 3, ?, ?, ?, 0, ?, ?)',
    );
    assert.throws(() => insert.run(ids.student, ids.skill, 1, 60, 60, 60, 'mastered'), /CHECK/);
    insert.run(ids.student, ids.skill, 1, 24.99, 24.99, 24.99, 'needs_support');
    insert.run(ids.student, ids.skill, 2, 25, 25, 25, 'in_progress');
    insert.run(ids.student, ids.skill, 3, 75, 75, 75, 'mastered');
  });

  test('skill_mastery_history es inmutable', () => {
    assert.throws(() => db.exec('UPDATE skill_mastery_history SET mastery_percentage = 99'), /inmutable/);
    assert.throws(() => db.exec('DELETE FROM skill_mastery_history'), /inmutable/);
  });

  test('la fase corresponde al grado', () => {
    const insert = db.prepare(
      "INSERT INTO curriculum_contents (phase, grade, formative_field, title, pda) VALUES (?, ?, 'saberes_pensamiento_cientifico', 'Fracciones', 'PDA')",
    );
    insert.run(4, 3);
    insert.run(3, 2);
    insert.run(5, 6);
    assert.throws(() => insert.run(3, 3), /CHECK/);
  });
});
