import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import { createRng } from '../src/db/seed/random.js';
import { QUESTIONS_PER_SKILL_AND_GRADE, generateQuestionBank, hintsMentionAnswer } from '../src/db/seed/questions.generator.js';

const scalar = (db, sql, ...params) => Object.values(db.prepare(sql).get(...params))[0];

describe('seed demo', () => {
  let db;
  let result;

  before(() => {
    db = openDatabase(':memory:');
    runMigrations(db);
    result = runSeed(db);
  });

  after(() => db.close());

  test('carga escuela, docente y grupo actual', () => {
    assert.equal(result.seeded, true);
    assert.equal(scalar(db, 'SELECT count(*) FROM schools'), 1);
    const group = db.prepare('SELECT * FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode);
    assert.equal(group.grade, 3);
    assert.ok(group.teacher_id);
  });

  test('la contraseña de la docente demo está cifrada con bcrypt', () => {
    const user = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(DEMO.teacher.email);
    assert.notEqual(user.password_hash, DEMO.teacher.password);
    assert.ok(bcrypt.compareSync(DEMO.teacher.password, user.password_hash));
  });

  test('incluye un director demo de la misma escuela que la docente', () => {
    const director = db.prepare('SELECT school_id, role, password_hash FROM users WHERE email = ?').get(DEMO.director.email);
    const teacher = db.prepare('SELECT school_id FROM users WHERE email = ?').get(DEMO.teacher.email);
    assert.equal(director.role, 'director');
    assert.equal(director.school_id, teacher.school_id);
    assert.ok(bcrypt.compareSync(DEMO.director.password, director.password_hash));
  });

  test('el grupo actual tiene 45 alumnos activos con iniciales y folio', () => {
    const rows = db.prepare(`
      SELECT s.* FROM students s
      JOIN group_enrollments e ON e.student_id = s.id
      JOIN groups g ON g.id = e.group_id
      WHERE g.join_code = ? AND e.status = 'active'`).all(DEMO.currentGroup.joinCode);
    assert.equal(rows.length, 45);
    for (const s of rows) {
      assert.match(s.initials, /^\p{Lu}{2}$/u);
      assert.match(s.internal_folio, /^AXI-[A-Z2-9]{8}$/);
      assert.equal(s.initials, `${s.first_names[0]}${s.last_names[0]}`.toLocaleUpperCase('es-MX'));
    }
    assert.equal(new Set(rows.map((s) => s.internal_folio)).size, 45);
  });

  test('al menos un alumno tiene historial de 2 grados anteriores', () => {
    const n = scalar(db, `
      SELECT count(*) FROM (
        SELECT e.student_id FROM group_enrollments e JOIN groups g ON g.id = e.group_id
        WHERE g.grade IN (1, 2) GROUP BY e.student_id HAVING count(DISTINCT g.grade) = 2)`);
    assert.ok(n >= 1);
    const grades = db.prepare(`
      SELECT DISTINCT h.grade FROM skill_mastery_history h
      JOIN students s ON s.id = h.student_id WHERE s.first_names = 'Sofía' ORDER BY h.grade`).all();
    assert.deepEqual(grades.map((g) => g.grade), [1, 2, 3]);
  });

  test('Sofía sube de nivel en Resolución de problemas respecto a 2.º', () => {
    const cuts = db.prepare(`
      SELECT h.grade, h.mastery_level FROM skill_mastery_history h
      JOIN students s ON s.id = h.student_id JOIN skills k ON k.id = h.skill_id
      WHERE s.first_names = 'Sofía' AND k.code = 'problem_solving' ORDER BY h.session_index`).all();
    assert.deepEqual(cuts.map((c) => c.mastery_level), ['in_progress', 'in_progress', 'achieved']);
    const levelUp = scalar(db, `
      SELECT count(*) FROM student_achievements a JOIN students s ON s.id = a.student_id
      JOIN skills k ON k.id = a.skill_id
      WHERE s.first_names = 'Sofía' AND k.code = 'problem_solving' AND a.achievement_code = 'level_up'`);
    assert.equal(levelUp, 1);
  });

  test('hay reactivos de 1.º a 6.º en las 5 habilidades, al menos 3 por combinación', () => {
    const rows = db.prepare(`
      SELECT q.grade, s.code, count(*) AS n FROM questions q JOIN skills s ON s.id = q.skill_id
      GROUP BY q.grade, s.code`).all();
    assert.equal(rows.length, 6 * 5);
    for (const r of rows) assert.ok(r.n >= 3, `${r.code} ${r.grade}.º tiene ${r.n} reactivos`);
  });

  test('cada reactivo tiene 4 opciones, una correcta y distractores etiquetados', () => {
    const rows = db.prepare(`
      SELECT question_id, count(*) AS n, sum(is_correct) AS correct, sum(error_tag IS NULL AND is_correct = 0) AS untagged
      FROM question_options GROUP BY question_id`).all();
    for (const r of rows) {
      assert.equal(r.n, 4);
      assert.equal(r.correct, 1);
      assert.equal(r.untagged, 0);
    }
  });

  test('ninguna pista menciona la respuesta correcta', () => {
    const rows = db.prepare(`
      SELECT q.hint_1, q.hint_2, q.hint_3, o.text FROM questions q
      JOIN question_options o ON o.question_id = q.id AND o.is_correct = 1`).all();
    for (const r of rows) {
      assert.ok(!hintsMentionAnswer([r.hint_1, r.hint_2, r.hint_3], r.text), `pista revela "${r.text}"`);
    }
  });

  test('la distribución de niveles es realista (≥ 3 niveles por habilidad)', () => {
    const rows = db.prepare(`
      SELECT s.code, count(DISTINCT h.mastery_level) AS levels FROM skill_mastery_history h
      JOIN skills s ON s.id = h.skill_id WHERE h.grade = 3 GROUP BY s.code`).all();
    assert.equal(rows.length, 4); // fracciones aún no se captura
    for (const r of rows) assert.ok(r.levels >= 3, `${r.code} solo tiene ${r.levels} niveles`);
  });

  test('registra "Logrado con apoyo" aparte del acierto autónomo', () => {
    const counts = Object.fromEntries(
      db.prepare('SELECT outcome_status, count(*) AS n FROM student_responses GROUP BY outcome_status').all()
        .map((r) => [r.outcome_status, r.n]),
    );
    assert.ok(counts.correct_autonomous > 0);
    assert.ok(counts.achieved_with_support > 0);
    assert.ok(counts.incorrect > 0);
  });

  test('la prueba de fracciones en papel deja la pantalla bloqueada', () => {
    const rows = db.prepare(`
      SELECT t.status, t.is_screen_locked FROM assignment_targets t
      JOIN assignments a ON a.id = t.assignment_id WHERE a.modality = 'paper'`).all();
    assert.equal(rows.length, 45);
    assert.ok(rows.every((t) => t.status === 'pending' && t.is_screen_locked === 1));
  });

  test('cada prueba asignada respeta el mínimo de 3 reactivos por habilidad', () => {
    const rows = db.prepare(`
      SELECT aq.assignment_id, q.skill_id, count(*) AS n FROM assignment_questions aq
      JOIN questions q ON q.id = aq.question_id GROUP BY aq.assignment_id, q.skill_id`).all();
    assert.ok(rows.length > 0);
    for (const r of rows) assert.ok(r.n >= 3);
  });

  test('no vuelve a cargar los datos si ya existen', () => {
    assert.deepEqual(runSeed(db), { seeded: false, reason: 'already_seeded' });
    assert.equal(scalar(db, 'SELECT count(*) FROM students'), 45);
  });
});

describe('generador de reactivos', () => {
  test('es determinista con la misma semilla', () => {
    const a = generateQuestionBank(createRng(7)).map((q) => q.stem);
    const b = generateQuestionBank(createRng(7)).map((q) => q.stem);
    assert.deepEqual(a, b);
  });

  test(`genera ${QUESTIONS_PER_SKILL_AND_GRADE} reactivos por habilidad y grado con varias semillas`, () => {
    for (const seed of [1, 2, 3, 42, 2026]) {
      const bank = generateQuestionBank(createRng(seed));
      assert.equal(bank.length, 6 * 5 * QUESTIONS_PER_SKILL_AND_GRADE);
    }
  });
});
