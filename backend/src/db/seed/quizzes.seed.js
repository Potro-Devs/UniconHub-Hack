/**
 * Carga idempotente de docentes colegas y cuestionarios iniciales para "Cuestionarios y constructor".
 * Puede ejecutarse desde `seed.js` o de forma independiente sobre una BD ya migrada:
 *   node src/db/seed/quizzes.seed.js
 */
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { closeDatabase, getDatabase, withTransaction } from '../../config/database.js';
import { runMigrations } from '../migrate.js';
import { COLLEAGUE_TEACHERS, DEMO, SEED_QUIZZES } from './demo.data.js';

/**
 * Inserta docentes colegas (si faltan) y los cuestionarios iniciales si la tabla `quizzes` está vacía.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ schoolId?: number, teacherId?: number, passwordHash?: string }} [ctx]
 */
export function seedDemoQuizzes(db, ctx = {}) {
  const existingCount = Number(db.prepare('SELECT COUNT(*) AS n FROM quizzes').get()?.n ?? 0);
  if (existingCount > 0) return { seeded: false, reason: 'already_has_quizzes', count: existingCount };

  const schoolId =
    ctx.schoolId ??
    db.prepare('SELECT id FROM schools WHERE name = ?').get(DEMO.schoolName)?.id ??
    db.prepare('SELECT id FROM schools ORDER BY id LIMIT 1').get()?.id;
  if (!schoolId) return { seeded: false, reason: 'missing_school', count: 0 };

  const teacherId =
    ctx.teacherId ??
    db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO.teacher.email)?.id ??
    db.prepare("SELECT id FROM users WHERE school_id = ? AND role = 'teacher' ORDER BY id LIMIT 1").get(schoolId)?.id;
  if (!teacherId) return { seeded: false, reason: 'missing_teacher', count: 0 };

  const passwordHash = ctx.passwordHash ?? bcrypt.hashSync(DEMO.teacher.password, 10);

  const findUserByEmail = db.prepare('SELECT id FROM users WHERE email = ?');
  const insertTeacher = db.prepare(
    "INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'teacher')",
  );

  const colleagueIds = {};
  for (const colleague of COLLEAGUE_TEACHERS) {
    const existing = findUserByEmail.get(colleague.email);
    colleagueIds[colleague.email] = existing
      ? Number(existing.id)
      : Number(insertTeacher.run(schoolId, colleague.email, passwordHash, colleague.fullName).lastInsertRowid);
  }

  const skillRows = db.prepare('SELECT id, code FROM skills').all();
  const skillIds = Object.fromEntries(skillRows.map((s) => [s.code, Number(s.id)]));

  const insertQuiz = db.prepare(
    'INSERT INTO quizzes (school_id, created_by, origin_type, title, description, skill_id, grade) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const insertQuestion = db.prepare(
    'INSERT INTO quiz_questions (quiz_id, position, question_type, prompt, options_json, correct_answer, hint) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  let inserted = 0;
  for (const quiz of SEED_QUIZZES) {
    const skillId = skillIds[quiz.skillCode];
    if (!skillId) continue;
    const ownerId =
      quiz.originType === 'system'
        ? null
        : quiz.ownerKey === 'demo'
          ? teacherId
          : colleagueIds[quiz.ownerKey];
    const quizSchoolId = quiz.originType === 'system' ? null : schoolId;
    const quizId = Number(
      insertQuiz.run(quizSchoolId, ownerId, quiz.originType, quiz.title, quiz.description, skillId, quiz.grade)
        .lastInsertRowid,
    );
    quiz.questions.forEach((question, idx) => {
      insertQuestion.run(
        quizId,
        idx + 1,
        question.questionType,
        question.prompt,
        JSON.stringify(question.options ?? []),
        question.correctAnswer,
        question.hint ?? '',
      );
    });
    inserted += 1;
  }

  return { seeded: true, count: inserted };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const db = getDatabase();
    runMigrations(db);
    const res = withTransaction(db, () => seedDemoQuizzes(db));
    console.log(res.seeded ? `Cuestionarios demo cargados: ${res.count}` : `Cuestionarios omitidos (${res.reason}: ${res.count}).`);
  } finally {
    closeDatabase();
  }
}
