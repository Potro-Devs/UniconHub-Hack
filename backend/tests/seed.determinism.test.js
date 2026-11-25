/**
 * Seed reproducible y aislamiento de 3.º A respecto de los 6 grupos extra del panel de Dirección.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { DEMO, runSeed } from '../src/db/seed.js';
import { SCHOOL_GROUPS } from '../src/db/seed/schoolGroups.js';

// Columnas que dependen del reloj o de la sal de bcrypt (no del generador del seed).
const VOLATILE = new Set(['password_hash', 'created_at', 'updated_at']);

function dumpAll(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%migrations%' ORDER BY name")
    .all().map((t) => t.name);
  return Object.fromEntries(tables.map((t) => [t, db.prepare(`SELECT * FROM "${t}" ORDER BY rowid`).all()
    .map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !VOLATILE.has(k))))]));
}

/** Contenido de 3.º A sin ids autoincrementales: alumnos, historial completo, respuestas y avance. */
function snapshotThirdA(db) {
  const g = db.prepare('SELECT id FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode);
  const students = db.prepare(`SELECT s.id, s.internal_folio, s.first_names, s.last_names, s.initials, s.avatar_color
    FROM students s JOIN group_enrollments e ON e.student_id = s.id WHERE e.group_id = ? ORDER BY s.internal_folio`).all(g.id);
  const folioOf = new Map(students.map((s) => [s.id, s.internal_folio]));
  const history = db.prepare(`SELECT h.student_id, sk.code, h.grade, h.session_index, h.session_percentage,
      h.autonomous_percentage, h.supported_percentage, h.mastery_percentage, h.mastery_level, h.recorded_at
    FROM skill_mastery_history h JOIN skills sk ON sk.id = h.skill_id
    WHERE h.student_id IN (SELECT student_id FROM group_enrollments WHERE group_id = ?)
    ORDER BY h.student_id, sk.code, h.grade, h.session_index`).all(g.id)
    .map(({ student_id: sid, ...h }) => ({ folio: folioOf.get(sid), ...h }));
  const responses = db.prepare(`SELECT t.student_id, a.title, a.modality, t.status, t.is_screen_locked, q.stem,
      o.label AS option_label, r.outcome_status, r.max_hint_level_used, r.error_tag, r.source
    FROM assignment_targets t JOIN assignments a ON a.id = t.assignment_id
    LEFT JOIN student_responses r ON r.assignment_target_id = t.id
    LEFT JOIN questions q ON q.id = r.question_id LEFT JOIN question_options o ON o.id = r.selected_option_id
    WHERE a.group_id = ? ORDER BY a.title, t.student_id, q.stem`).all(g.id)
    .map(({ student_id: sid, ...r }) => ({ folio: folioOf.get(sid), ...r }));
  const progress = db.prepare(`SELECT c.title, p.status FROM group_curriculum_progress p
    JOIN curriculum_contents c ON c.id = p.content_id WHERE p.group_id = ? ORDER BY c.title`).all(g.id);
  return { students: students.map(({ id, ...s }) => s), history, responses, progress };
}

const thirdAGroupId = (db) => db.prepare('SELECT id FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode).id;

describe('seed reproducible', () => {
  let a;
  let b;

  before(() => {
    a = openDatabase(':memory:');
    b = openDatabase(':memory:');
    runMigrations(a);
    runMigrations(b);
    runSeed(a);
    runSeed(b);
  });

  after(() => {
    a.close();
    b.close();
  });

  test('dos bases nuevas quedan idénticas tabla por tabla (incluye los 6 grupos extra)', () => {
    const da = dumpAll(a);
    const dbb = dumpAll(b);
    assert.deepEqual(Object.keys(da), Object.keys(dbb));
    for (const table of Object.keys(da)) assert.deepEqual(da[table], dbb[table], `tabla ${table}`);
  });

  test('los grupos extra usan los códigos declarados y ningún alumno se inscribe en dos grupos del ciclo', () => {
    const codes = a.prepare('SELECT join_code FROM groups WHERE school_year = ? AND join_code <> ? ORDER BY grade, section')
      .all(DEMO.currentGroup.schoolYear, DEMO.currentGroup.joinCode).map((g) => g.join_code);
    assert.deepEqual(codes, SCHOOL_GROUPS.map((g) => g.joinCode));
    const dup = a.prepare(`SELECT e.student_id FROM group_enrollments e JOIN groups g ON g.id = e.group_id
      WHERE g.school_year = ? AND e.status = 'active' GROUP BY e.student_id HAVING count(*) > 1`).all(DEMO.currentGroup.schoolYear);
    assert.deepEqual(dup, []);
    for (const g of SCHOOL_GROUPS) {
      const n = a.prepare(`SELECT count(*) AS n FROM group_enrollments e JOIN groups gr ON gr.id = e.group_id
        WHERE gr.join_code = ? AND e.status = 'active'`).get(g.joinCode).n;
      assert.equal(n, g.students, g.joinCode);
    }
  });

  test('folios únicos y sin CURP en toda la escuela', () => {
    assert.equal(a.prepare('SELECT count(*) - count(DISTINCT internal_folio) AS d FROM students').get().d, 0);
    const cols = a.prepare("SELECT name FROM pragma_table_info('students')").all().map((c) => c.name);
    assert.ok(!cols.some((c) => /curp/i.test(c)));
  });

  test('los grupos extra no agregan filas que apunten a 3.º A', () => {
    const groupId = thirdAGroupId(a);
    const extraIds = a.prepare('SELECT id FROM groups WHERE join_code IN (' + SCHOOL_GROUPS.map(() => '?').join(',') + ')')
      .all(...SCHOOL_GROUPS.map((g) => g.joinCode)).map((g) => g.id);
    const minExtraAssignment = a.prepare(`SELECT min(id) AS m FROM assignments WHERE group_id IN (${extraIds.join(',')})`).get().m;
    const maxThirdAAssignment = a.prepare('SELECT max(id) AS m FROM assignments WHERE group_id = ?').get(groupId).m;
    assert.ok(maxThirdAAssignment < minExtraAssignment, 'los datos de 3.º A se generan antes que los grupos extra');
    assert.equal(a.prepare(`SELECT count(*) AS n FROM group_enrollments e WHERE e.group_id = ?`).get(groupId).n, 45);
  });
});

describe('3.º A no cambia al agregar los grupos extra a una base ya sembrada', () => {
  let db;
  let before3A;

  before(() => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    before3A = snapshotThirdA(db);
    // Simula una base anterior a los grupos extra cambiando sus códigos y vuelve a correr el seed.
    const extra = db.prepare('SELECT id FROM groups WHERE school_year = ? AND join_code <> ?')
      .all(DEMO.currentGroup.schoolYear, DEMO.currentGroup.joinCode);
    extra.forEach(({ id }, i) => db.prepare("UPDATE groups SET join_code = ?, section = 'Z' WHERE id = ?").run(`OLDGR${i}`, id));
    assert.equal(runSeed(db).schoolGroupsAdded, 6);
  });

  after(() => db.close());

  test('alumnos, historial multigrado, respuestas y temario de 3.º A quedan idénticos', () => {
    const after3A = snapshotThirdA(db);
    assert.equal(after3A.students.length, 45);
    assert.ok(after3A.history.some((h) => h.grade === 1) && after3A.history.some((h) => h.grade === 2), 'historial de 2 grados');
    assert.deepEqual(after3A, before3A);
  });

  test('la segunda corrida no duplica docentes extra (reusa por correo)', () => {
    const dup = db.prepare("SELECT email FROM users GROUP BY email HAVING count(*) > 1").all();
    assert.deepEqual(dup, []);
  });
});
