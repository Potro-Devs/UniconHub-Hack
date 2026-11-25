import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';

const migration = (name) => fs.readFileSync(new URL(`../src/db/migrations/${name}`, import.meta.url), 'utf8');
const mainMigrations = ['001_initial_schema.sql', '002_hint_requests.sql', '003_group_interventions.sql', '004_quizzes_builder.sql'];

function existingMainDatabase() {
  const db = openDatabase(':memory:');
  db.exec('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime(\'now\')))');
  for (const name of mainMigrations) {
    db.exec(migration(name));
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);
  }
  db.exec(`
    INSERT INTO schools (id, name) VALUES (1, 'Escuela ficticia');
    INSERT INTO users (id, school_id, email, password_hash, full_name, role)
      VALUES (1, 1, 'demo@migration.test', 'fake', 'Docente ficticio', 'teacher');
    INSERT INTO groups (id, school_id, teacher_id, grade, section, school_year, join_code)
      VALUES (1, 1, 1, 3, 'A', '2026-2027', 'MIGR3A');
    INSERT INTO skills (id, code, name) VALUES (1, 'fractions', 'Fracciones');
    INSERT INTO quizzes (id, school_id, created_by, origin_type, title, skill_id, grade)
      VALUES (1, 1, 1, 'teacher', 'Cuestionario existente', 1, 3);
    INSERT INTO quiz_questions (quiz_id, position, question_type, prompt, options_json, correct_answer)
      VALUES (1, 1, 'true_false', 'Ejemplo por validar con docente', '["Sí","No"]', 'Sí');
  `);
  return db;
}

test('migración de tutorías conserva cuestionarios de main y es repetible', () => {
  const db = existingMainDatabase();
  try {
    const quiz = db.prepare('SELECT * FROM quizzes').get();
    const question = db.prepare('SELECT * FROM quiz_questions').get();
    assert.deepEqual(runMigrations(db), ['005_peer_tutoring.sql', '006_tutoring_tutor_set_null.sql']);
    assert.deepEqual(db.prepare('SELECT * FROM quizzes').get(), quiz);
    assert.deepEqual(db.prepare('SELECT * FROM quiz_questions').get(), question);
    db.exec("INSERT INTO tutoring_sessions (group_id, skill_id, created_by, note) VALUES (1, 1, 1, 'Sesión ficticia')");
    assert.deepEqual(runMigrations(db), []);
    assert.equal(db.prepare('SELECT note FROM tutoring_sessions').get().note, 'Sesión ficticia');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

test('migración renumerada conserva tutorías de una base con la antigua 004', () => {
  const db = existingMainDatabase();
  try {
    db.exec(migration('005_peer_tutoring.sql'));
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run('004_peer_tutoring.sql');
    db.exec("INSERT INTO tutoring_sessions (group_id, skill_id, created_by, note) VALUES (1, 1, 1, 'Respaldo previo')");
    assert.deepEqual(runMigrations(db), ['005_peer_tutoring.sql', '006_tutoring_tutor_set_null.sql']);
    assert.equal(db.prepare('SELECT note FROM tutoring_sessions').get().note, 'Respaldo previo');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM quizzes').get().count, 1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

test('la migración conserva parejas y deja la mesa docente si se elimina al tutor', () => {
  const db = existingMainDatabase();
  try {
    db.exec(migration('005_peer_tutoring.sql'));
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run('005_peer_tutoring.sql');
    db.exec(`
      INSERT INTO students (id, school_id, internal_folio, first_names, last_names, initials, avatar_color)
        VALUES (1, 1, 'MIG-TUTOR', 'Ana', 'Ejemplo', 'AE', '#123456'),
               (2, 1, 'MIG-TUTEE', 'Beto', 'Ejemplo', 'BE', '#654321');
      INSERT INTO tutoring_sessions (id, group_id, skill_id, created_by)
        VALUES (1, 1, 1, 1);
      INSERT INTO tutoring_pairs (id, session_id, tutor_student_id, tutee_student_id, demo_correct, demo_recorded_at)
        VALUES (1, 1, 1, 2, 3, '2026-01-02 10:00:00');
    `);

    assert.deepEqual(runMigrations(db), ['006_tutoring_tutor_set_null.sql']);
    const tutorForeignKey = db.prepare('PRAGMA foreign_key_list(tutoring_pairs)').all()
      .find((key) => key.from === 'tutor_student_id');
    assert.equal(tutorForeignKey.on_delete, 'SET NULL');

    db.prepare('DELETE FROM students WHERE id = 1').run();
    assert.deepEqual({ ...db.prepare('SELECT tutor_student_id, tutee_student_id, demo_correct FROM tutoring_pairs').get() },
      { tutor_student_id: null, tutee_student_id: 2, demo_correct: 3 });
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});
