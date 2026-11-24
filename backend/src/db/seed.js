/**
 * Seed demo de Axi: escuela, docente, grupo de 3.º A con 45 alumnos ficticios, historial de
 * 1.º y 2.º, temario 1.º–6.º, banco de reactivos de las 5 habilidades y actividades sugeridas.
 *
 * Uso:
 *   npm run seed         → carga los datos si la base aún no los tiene
 *   npm run seed:reset   → borra la base y la vuelve a crear (detén antes el backend)
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { closeDatabase, getDatabase, withTransaction } from '../config/database.js';
import { env } from '../config/env.js';
import { computeWeightedMastery, getMasteryLevel } from '../modules/analytics/analytics.domain.js';
import { phaseForGrade } from '../modules/curriculum/curriculum.domain.js';
import { evaluateAchievements } from '../modules/diagnostics/diagnostics.domain.js';
import { AVATAR_PALETTE, buildInitials, generateInternalFolio } from '../modules/groups/groups.domain.js';
import { runMigrations } from './migrate.js';
import {
  ACTIVITIES,
  CURRICULUM_BY_SKILL,
  DEMO,
  EXTRA_THIRD_GRADE_CONTENTS,
  FEATURED_STUDENT,
  FIRST_NAMES,
  HISTORY,
  LAST_NAMES,
  SKILLS,
  SKILL_BASE,
  THIRD_GRADE_PROGRESS,
  formativeFieldFor,
} from './seed/demo.data.js';
import { generateQuestionBank } from './seed/questions.generator.js';
import { clamp, createRng, round2 } from './seed/random.js';

export { DEMO };

/** Semilla fija: el seed siempre produce los mismos datos. */
export const DEFAULT_SEED = 20261123;

const SCREEN_SKILLS = ['place_value', 'problem_solving', 'multiplication', 'reading_comprehension'];
const PAPER_SKILL = 'fractions';
const DATES = {
  firstGradeCut: '2025-06-20 12:00:00',
  secondGradeCut: '2026-06-19 12:00:00',
  diagnostic: '2026-09-25',
  paperAssigned: '2026-11-18 09:00:00',
};

export function isSeeded(db) {
  return Boolean(db.prepare('SELECT 1 FROM schools WHERE name = ?').get(DEMO.schoolName));
}

/**
 * Carga los datos demo en una sola transacción. No hace nada si ya existen.
 *
 * @param {import('node:sqlite').DatabaseSync} db Base con las migraciones aplicadas.
 */
export function runSeed(db, { seed = DEFAULT_SEED } = {}) {
  if (isSeeded(db)) return { seeded: false, reason: 'already_seeded' };

  const rng = createRng(seed);
  const bank = generateQuestionBank(rng);
  const passwordHash = bcrypt.hashSync(DEMO.teacher.password, 10);
  return withTransaction(db, () => insertDemo(db, rng, bank, passwordHash));
}

function insertDemo(db, rng, bank, passwordHash) {
  const statements = new Map();
  const run = (sql, ...params) => {
    if (!statements.has(sql)) statements.set(sql, db.prepare(sql));
    return Number(statements.get(sql).run(...params).lastInsertRowid);
  };

  // Escuela y docente
  const schoolId = run('INSERT INTO schools (name) VALUES (?)', DEMO.schoolName);
  const teacherId = run(
    "INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'teacher')",
    schoolId, DEMO.teacher.email, passwordHash, DEMO.teacher.fullName,
  );
  run(
    "INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'director')",
    schoolId, DEMO.director.email, passwordHash, DEMO.director.fullName,
  );

  // Habilidades
  const skillIds = Object.fromEntries(
    SKILLS.map((s) => [s.code, run('INSERT INTO skills (code, name) VALUES (?, ?)', s.code, s.name)]),
  );
  const skillName = Object.fromEntries(SKILLS.map((s) => [s.code, s.name]));

  // Temario 1.º–6.º
  const contentIds = {};
  const insertContent = (grade, field, title, pda, skillId, order) =>
    run(
      'INSERT INTO curriculum_contents (phase, grade, formative_field, title, pda, skill_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      phaseForGrade(grade), grade, field, title, pda, skillId, order,
    );
  for (let grade = 1; grade <= 6; grade += 1) {
    let order = 1;
    for (const { code } of SKILLS) {
      const [title, pda] = CURRICULUM_BY_SKILL[code][grade - 1];
      contentIds[`${grade}:${code}`] = insertContent(grade, formativeFieldFor(code), title, pda, skillIds[code], order++);
    }
    if (grade === 3) {
      for (const [title, pda] of EXTRA_THIRD_GRADE_CONTENTS) {
        contentIds[`3:${title}`] = insertContent(3, 'saberes_pensamiento_cientifico', title, pda, null, order++);
      }
    }
  }

  // Actividades sugeridas
  for (const a of ACTIVITIES) {
    run(
      'INSERT INTO recommended_activities (skill_id, grade_min, grade_max, title, description, duration_minutes, grouping, materials, target_error_tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      skillIds[a.skill], a.gradeMin, a.gradeMax, a.title, a.description, a.minutes, a.grouping, a.materials, a.errorTag,
    );
  }

  // Banco de reactivos
  const questionsBy = {};
  for (const q of bank) {
    const questionId = run(
      'INSERT INTO questions (skill_id, content_id, grade, stem, hint_1, hint_2, hint_3, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      skillIds[q.skill], contentIds[`${q.grade}:${q.skill}`], q.grade, q.stem, ...q.hints, q.difficulty,
    );
    const options = rng
      .shuffle([{ text: q.correct, isCorrect: true }, ...q.distractors.map((x) => ({ ...x, isCorrect: false }))])
      .map((o, idx) => ({
        ...o,
        id: run(
          'INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, ?, ?, ?, ?, ?)',
          questionId, 'ABCD'[idx], o.text, o.isCorrect ? 1 : 0, o.isCorrect ? null : o.tag, o.isCorrect ? null : o.explanation,
        ),
      }));
    (questionsBy[`${q.grade}:${q.skill}`] ??= []).push({ id: questionId, options });
  }

  // Grupos: 1.º A y 2.º A (ciclos anteriores) y 3.º A (actual, de la docente demo)
  const insertGroup = (g, teacher) =>
    run(
      'INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, ?, ?, ?, ?)',
      schoolId, teacher, g.grade, g.section, g.schoolYear, g.joinCode,
    );
  const [firstGradeGroup, secondGradeGroup] = DEMO.previousGroups.map((g) => insertGroup(g, null));
  const currentGroupId = insertGroup(DEMO.currentGroup, teacherId);

  // Alumnos
  const folios = new Set();
  const students = FIRST_NAMES.map((first, i) => {
    let lastNames = `${LAST_NAMES[(i * 7) % LAST_NAMES.length]} ${LAST_NAMES[(i * 11 + 5) % LAST_NAMES.length]}`;
    const [l1, l2] = lastNames.split(' ');
    if (l1 === l2) lastNames = `${l1} ${LAST_NAMES[(i * 11 + 6) % LAST_NAMES.length]}`;

    let folio;
    do folio = generateInternalFolio(rng.next); while (folios.has(folio));
    folios.add(folio);

    const id = run(
      'INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, ?)',
      schoolId, folio, first, lastNames, buildInitials(first, lastNames), rng.pick(AVATAR_PALETTE),
    );

    const general = rng.normal();
    const scores = { current: {}, secondGrade: {}, firstGrade: {} };
    for (const { code } of SKILLS) {
      const current = clamp(Math.round(SKILL_BASE[code] + 16 * general + 10 * rng.normal()), 5, 98);
      const second = clamp(round2(current - 4 - rng.next() * 12), 3, 98);
      scores.current[code] = current;
      scores.secondGrade[code] = second;
      scores.firstGrade[code] = clamp(round2(second - 3 - rng.next() * 10), 3, 98);
    }
    return { id, index: i, scores: i === 0 ? structuredClone(FEATURED_STUDENT) : scores };
  });

  // Inscripciones
  for (const s of students) {
    run("INSERT INTO group_enrollments (group_id, student_id, status, enrolled_at) VALUES (?, ?, 'active', '2026-08-31 08:00:00')", currentGroupId, s.id);
    if (s.index < HISTORY.secondGradeCount) {
      run(
        "INSERT INTO group_enrollments (group_id, student_id, status, enrolled_at, ended_at) VALUES (?, ?, 'completed', '2025-09-01 08:00:00', ?)",
        secondGradeGroup, s.id, DEMO.previousGroups[1].endedAt,
      );
    }
    if (s.index < HISTORY.firstGradeCount) {
      run(
        "INSERT INTO group_enrollments (group_id, student_id, status, enrolled_at, ended_at) VALUES (?, ?, 'completed', '2024-08-26 08:00:00', ?)",
        firstGradeGroup, s.id, DEMO.previousGroups[0].endedAt,
      );
    }
  }

  // Avance del temario de 3.º A
  for (const [key, contentId] of Object.entries(contentIds).filter(([k]) => k.startsWith('3:'))) {
    const status = THIRD_GRADE_PROGRESS[key.slice(2)] ?? 'pending';
    run('INSERT INTO group_curriculum_progress (group_id, content_id, status) VALUES (?, ?, ?)', currentGroupId, contentId, status);
  }

  // Historial de dominio (cortes inmutables)
  const cutsBy = new Map();
  const addCut = (student, skill, grade, assignmentId, autonomous, supported, recordedAt) => {
    const key = `${student.id}:${skill}`;
    const previous = cutsBy.get(key) ?? [];
    const sessions = [...previous, autonomous];
    const mastery = computeWeightedMastery(sessions);
    run(
      'INSERT INTO skill_mastery_history (student_id, skill_id, assignment_id, grade, session_index, session_percentage, autonomous_percentage, supported_percentage, mastery_percentage, mastery_level, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      student.id, skillIds[skill], assignmentId, grade, sessions.length, autonomous, autonomous, supported, mastery,
      getMasteryLevel(mastery).code, recordedAt,
    );
    cutsBy.set(key, sessions);
    return { previousMastery: computeWeightedMastery(previous), mastery };
  };

  for (const s of students) {
    for (const { code } of SKILLS) {
      if (s.index < HISTORY.firstGradeCount) {
        const pct = s.scores.firstGrade[code];
        addCut(s, code, 1, null, pct, round2(Math.min(100 - pct, rng.next() * 15)), DATES.firstGradeCut);
      }
      if (s.index < HISTORY.secondGradeCount) {
        const pct = s.scores.secondGrade[code];
        addCut(s, code, 2, null, pct, round2(Math.min(100 - pct, rng.next() * 15)), DATES.secondGradeCut);
      }
    }
  }

  // Diagnósticos en pantalla de 3.º (ya contestados)
  let responseCount = 0;
  let achievementCount = 0;
  for (const skill of SCREEN_SKILLS) {
    const assignmentId = run(
      "INSERT INTO assignments (group_id, created_by, title, modality, status, created_at) VALUES (?, ?, ?, 'screen', 'closed', ?)",
      currentGroupId, teacherId, `Diagnóstico inicial · ${skillName[skill]}`, `${DATES.diagnostic} 08:30:00`,
    );
    const questions = questionsBy[`3:${skill}`];
    questions.forEach((q, idx) =>
      run('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)', assignmentId, q.id, idx + 1),
    );

    for (const s of students) {
      const targetId = run(
        "INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked, started_at, completed_at) VALUES (?, ?, 'completed_screen', 0, ?, ?)",
        assignmentId, s.id, `${DATES.diagnostic} 09:00:00`, `${DATES.diagnostic} 09:30:00`,
      );

      const p = s.scores.current[skill] / 100;
      const tally = { autonomous: 0, supported: 0 };
      // La alumna destacada tiene resultados fijos para que su perfil cuente siempre la misma historia.
      const featuredAutonomous = Math.round(p * questions.length);
      questions.forEach((q, qIdx) => {
        const r = s.index === 0
          ? (qIdx < featuredAutonomous ? 0 : qIdx === featuredAutonomous ? p + 1e-9 : 1)
          : rng.next();
        const correct = q.options.find((o) => o.isCorrect);
        let outcome;
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
          outcome = 'incorrect';
          option = rng.pick(q.options.filter((o) => !o.isCorrect));
          hint = rng.chance(0.4) ? rng.int(1, 3) : 0;
        }
        run(
          "INSERT INTO student_responses (assignment_target_id, question_id, selected_option_id, outcome_status, max_hint_level_used, error_tag, source, answered_at) VALUES (?, ?, ?, ?, ?, ?, 'screen', ?)",
          targetId, q.id, option.id, outcome, hint, outcome === 'incorrect' ? option.tag : null, `${DATES.diagnostic} 09:20:00`,
        );
        responseCount += 1;
      });

      const total = questions.length;
      const { previousMastery, mastery } = addCut(
        s, skill, 3, assignmentId,
        round2((tally.autonomous / total) * 100), round2((tally.supported / total) * 100), `${DATES.diagnostic} 12:00:00`,
      );

      const { celebrations } = evaluateAchievements({
        blockCompleted: true,
        previousPercentage: previousMastery,
        currentPercentage: mastery,
      });
      for (const c of celebrations) {
        run(
          'INSERT INTO student_achievements (student_id, achievement_code, size, skill_id, assignment_id, awarded_at) VALUES (?, ?, ?, ?, ?, ?)',
          s.id, c.code, c.size, skillIds[skill], assignmentId, `${DATES.diagnostic} 09:30:00`,
        );
        achievementCount += 1;
      }
    }
  }

  // Prueba de fracciones asignada en papel, pendiente de captura (pantalla bloqueada)
  const paperId = run(
    "INSERT INTO assignments (group_id, created_by, title, modality, status, created_at) VALUES (?, ?, 'Fracciones · prueba 1', 'paper', 'active', ?)",
    currentGroupId, teacherId, DATES.paperAssigned,
  );
  questionsBy[`3:${PAPER_SKILL}`].forEach((q, idx) =>
    run('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)', paperId, q.id, idx + 1),
  );
  for (const s of students) {
    run("INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked) VALUES (?, ?, 'pending', 1)", paperId, s.id);
  }

  return {
    seeded: true,
    teacherEmail: DEMO.teacher.email,
    directorEmail: DEMO.director.email,
    joinCode: DEMO.currentGroup.joinCode,
    counts: {
      students: students.length,
      questions: bank.length,
      contents: Object.keys(contentIds).length,
      activities: ACTIVITIES.length,
      responses: responseCount,
      masteryCuts: [...cutsBy.values()].reduce((n, sessions) => n + sessions.length, 0),
      achievements: achievementCount,
    },
  };
}

function removeDatabaseFiles(filename) {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(filename + suffix, { force: true });
    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'EPERM') {
        throw new Error('No se pudo borrar la base de datos porque está en uso. Detén el backend y vuelve a intentarlo.');
      }
      throw error;
    }
  }
}

// Uso directo: `npm run seed` / `npm run seed:reset`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes('--reset') && env.sqliteDbPath !== ':memory:') {
      removeDatabaseFiles(env.sqliteDbPath);
    }
    const db = getDatabase();
    runMigrations(db);
    const result = runSeed(db);
    if (!result.seeded) {
      console.log('La base ya tiene los datos demo. Usa `npm run seed:reset` para recrearla.');
    } else {
      const c = result.counts;
      console.log(
        [
          'Datos demo cargados:',
          `  · ${c.students} alumnos en 3.º A (código de grupo ${result.joinCode})`,
          `  · ${c.questions} reactivos · ${c.contents} contenidos · ${c.activities} actividades`,
          `  · ${c.responses} respuestas · ${c.masteryCuts} cortes de dominio · ${c.achievements} logros`,
          `  · Docente: ${result.teacherEmail} / ${DEMO.teacher.password}`,
          `  · Dirección: ${result.directorEmail} / ${DEMO.director.password}`,
        ].join('\n'),
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    closeDatabase();
  }
}
