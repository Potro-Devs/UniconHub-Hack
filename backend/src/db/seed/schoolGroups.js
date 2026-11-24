/**
 * Grupos adicionales del ciclo actual (otros docentes) para que el panel de Dirección tenga
 * promedios que comparar. Todos los nombres son ficticios. No se usa CURP.
 *
 * Usa su propia semilla: no altera los datos de 3.º A ni de la docente demo. Lee habilidades y
 * reactivos de la base, así que también sirve para completar una base sembrada antes.
 */
import bcrypt from 'bcryptjs';
import { computeWeightedMastery, getMasteryLevel } from '../../modules/analytics/analytics.domain.js';
import { AVATAR_PALETTE, buildInitials, generateInternalFolio } from '../../modules/groups/groups.domain.js';
import { DEMO, FIRST_NAMES, LAST_NAMES, SKILL_BASE } from './demo.data.js';
import { clamp, createRng, round2 } from './random.js';

export const SCHOOL_GROUPS_SEED = 20261124;

/**
 * `offset` mueve el promedio del grupo; `evidence` es la fracción de alumnos ya diagnosticados;
 * `coverage` la fracción del temario marcada como vista. Escenarios variados a propósito.
 */
export const SCHOOL_GROUPS = Object.freeze([
  { grade: 1, section: 'A', joinCode: 'UNXA2K', students: 28, offset: 8, evidence: 1, coverage: 0.6,
    teacher: { email: 'docente.1a@axi.demo', fullName: 'Mtra. Lucía Pérez' } },
  { grade: 2, section: 'A', joinCode: 'DSXA3M', students: 30, offset: 4, evidence: 1, coverage: 0.4,
    teacher: { email: 'docente.2a@axi.demo', fullName: 'Mtro. Jorge Ramos' } },
  { grade: 3, section: 'B', joinCode: 'TRSB4N', students: 33, offset: -5, evidence: 0.94, coverage: 0.4,
    teacher: { email: 'docente.3b@axi.demo', fullName: 'Mtra. Patricia Vega' } },
  { grade: 4, section: 'A', joinCode: 'CTRA5P', students: 35, offset: -2, evidence: 0.9, coverage: 0.4,
    teacher: { email: 'docente.4a@axi.demo', fullName: 'Mtro. Andrés Molina' } },
  { grade: 5, section: 'A', joinCode: 'CNCA6Q', students: 32, offset: -10, evidence: 1, coverage: 0.2,
    teacher: { email: 'docente.5a@axi.demo', fullName: 'Mtra. Rosa Delgado' } },
  { grade: 6, section: 'A', joinCode: 'SXTA7R', students: 29, offset: 2, evidence: 0.4, coverage: 0.6,
    teacher: { email: 'docente.6a@axi.demo', fullName: 'Mtro. Héctor Navarro' } },
]);

const DIAGNOSTIC_DAY = '2026-09-29';
/** Sin el nombre de la alumna destacada de 3.º A (su perfil cuenta una historia fija). */
const NAMES = FIRST_NAMES.slice(1);

/**
 * Inserta los grupos que falten (por código de grupo). Devuelve cuántos agregó.
 * Debe llamarse dentro de una transacción.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function insertSchoolGroups(db, { seed = SCHOOL_GROUPS_SEED } = {}) {
  const school = db.prepare('SELECT id FROM schools WHERE name = ?').get(DEMO.schoolName);
  if (!school) return 0;
  const exists = db.prepare('SELECT 1 FROM groups WHERE join_code = ?');
  const pending = SCHOOL_GROUPS.filter((g) => !exists.get(g.joinCode));
  if (!pending.length) return 0;

  const rng = createRng(seed);
  const statements = new Map();
  const run = (sql, ...params) => {
    if (!statements.has(sql)) statements.set(sql, db.prepare(sql));
    return Number(statements.get(sql).run(...params).lastInsertRowid);
  };
  const skills = db.prepare('SELECT id, code, name FROM skills ORDER BY id').all();
  const questionsOf = db.prepare('SELECT id FROM questions WHERE grade = ? AND skill_id = ? ORDER BY id');
  const optionsOf = db.prepare('SELECT id, is_correct, error_tag FROM question_options WHERE question_id = ? ORDER BY id');
  const contentsOf = db.prepare('SELECT id FROM curriculum_contents WHERE grade = ? ORDER BY sort_order, id');
  const folioExists = db.prepare('SELECT 1 FROM students WHERE internal_folio = ?');
  const passwordHash = bcrypt.hashSync(DEMO.teacher.password, 10);

  for (const g of pending) {
    const teacher = db.prepare('SELECT id FROM users WHERE email = ?').get(g.teacher.email);
    const teacherId = teacher?.id ?? run(
      "INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'teacher')",
      school.id, g.teacher.email, passwordHash, g.teacher.fullName,
    );
    const groupId = run(
      'INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, ?, ?, ?, ?)',
      school.id, teacherId, g.grade, g.section, DEMO.currentGroup.schoolYear, g.joinCode,
    );

    // Avance del temario del grado
    const contents = contentsOf.all(g.grade);
    contents.forEach((c, idx) => {
      const ratio = idx / contents.length;
      const status = ratio < g.coverage ? 'seen' : ratio < g.coverage + 0.2 ? 'in_progress' : 'pending';
      run('INSERT INTO group_curriculum_progress (group_id, content_id, status) VALUES (?, ?, ?)', groupId, c.id, status);
    });

    // Alumnos ficticios
    const students = Array.from({ length: g.students }, (_, i) => {
      const first = NAMES[(i * 7 + g.grade * 5) % NAMES.length];
      const l1 = LAST_NAMES[(i * 5 + g.grade * 3) % LAST_NAMES.length];
      let l2 = LAST_NAMES[(i * 11 + g.grade * 7 + 4) % LAST_NAMES.length];
      if (l2 === l1) l2 = LAST_NAMES[(i * 11 + g.grade * 7 + 5) % LAST_NAMES.length];
      const lastNames = `${l1} ${l2}`;
      let folio;
      do folio = generateInternalFolio(rng.next); while (folioExists.get(folio));
      const id = run(
        'INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, ?)',
        school.id, folio, first, lastNames, buildInitials(first, lastNames), rng.pick(AVATAR_PALETTE),
      );
      run("INSERT INTO group_enrollments (group_id, student_id, status, enrolled_at) VALUES (?, ?, 'active', '2026-08-31 08:00:00')", groupId, id);
      return { id, general: rng.normal(), evaluated: i < Math.round(g.students * g.evidence) };
    });

    // Diagnóstico inicial en pantalla, una prueba por habilidad
    for (const skill of skills) {
      const questions = questionsOf.all(g.grade, skill.id).slice(0, 4)
        .map((q) => ({ id: q.id, options: optionsOf.all(q.id) }));
      if (questions.length < 3) continue;
      const assignmentId = run(
        "INSERT INTO assignments (group_id, created_by, title, modality, status, created_at) VALUES (?, ?, ?, 'screen', 'closed', ?)",
        groupId, teacherId, `Diagnóstico inicial · ${skill.name}`, `${DIAGNOSTIC_DAY} 08:30:00`,
      );
      questions.forEach((q, idx) =>
        run('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)', assignmentId, q.id, idx + 1));

      for (const s of students) {
        if (!s.evaluated) continue; // Aún sin diagnóstico (p. ej. faltó ese día)
        const targetId = run(
          "INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked, started_at, completed_at) VALUES (?, ?, 'completed_screen', 0, ?, ?)",
          assignmentId, s.id, `${DIAGNOSTIC_DAY} 09:00:00`, `${DIAGNOSTIC_DAY} 09:30:00`,
        );
        const p = clamp(SKILL_BASE[skill.code] + g.offset + 16 * s.general + 10 * rng.normal(), 5, 98) / 100;
        const tally = { autonomous: 0, supported: 0 };
        for (const q of questions) {
          const r = rng.next();
          const correct = q.options.find((o) => o.is_correct);
          let outcome = 'incorrect';
          let option;
          let hint = 0;
          if (r < p) {
            outcome = 'correct_autonomous';
            option = correct;
            tally.autonomous += 1;
          } else if (r < p + (1 - p) * 0.35) {
            outcome = 'achieved_with_support';
            option = correct;
            hint = rng.int(1, 3);
            tally.supported += 1;
          } else {
            option = rng.pick(q.options.filter((o) => !o.is_correct));
            hint = rng.chance(0.4) ? rng.int(1, 3) : 0;
          }
          run(
            "INSERT INTO student_responses (assignment_target_id, question_id, selected_option_id, outcome_status, max_hint_level_used, error_tag, source, answered_at) VALUES (?, ?, ?, ?, ?, ?, 'screen', ?)",
            targetId, q.id, option.id, outcome, hint, outcome === 'incorrect' ? option.error_tag : null, `${DIAGNOSTIC_DAY} 09:20:00`,
          );
        }
        const autonomous = round2((tally.autonomous / questions.length) * 100);
        const supported = round2((tally.supported / questions.length) * 100);
        const mastery = computeWeightedMastery([autonomous]);
        run(
          'INSERT INTO skill_mastery_history (student_id, skill_id, assignment_id, grade, session_index, session_percentage, autonomous_percentage, supported_percentage, mastery_percentage, mastery_level, recorded_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)',
          s.id, skill.id, assignmentId, g.grade, autonomous, autonomous, supported, mastery, getMasteryLevel(mastery).code,
          `${DIAGNOSTIC_DAY} 12:00:00`,
        );
      }
    }
  }
  return pending.length;
}
