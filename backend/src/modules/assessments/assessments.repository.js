/**
 * Módulo assessments — Capa 4 (Infraestructura): consultas SQL parametrizadas contra SQLite.
 * Las listas de ids se pasan como JSON y se expanden con `json_each(?)` (sin concatenar SQL).
 * Nunca selecciona `internal_folio`.
 */

const QUESTION_COLUMNS = `q.id, q.grade, q.content_id, q.stem, q.hint_1, q.hint_2, q.hint_3, q.difficulty,
  s.code AS skill_code, s.name AS skill_name`;
const OPTION_COLUMNS = 'o.id, o.question_id, o.label, o.text, o.is_correct, o.error_tag, o.error_explanation';
// `(? IS NULL OR ...)` permite que cada filtro sea opcional con la misma sentencia preparada.
const BANK_FILTER = '(?1 IS NULL OR q.grade = ?1) AND (?2 IS NULL OR s.code = ?2)';
const ASSIGNMENT_COLUMNS = 'a.id, a.group_id, a.created_by, a.title, a.modality, a.status, a.created_at';
const STUDENT_ORDER = 's.last_names COLLATE NOCASE, s.first_names COLLATE NOCASE, s.id';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createAssessmentsRepository(db) {
  const statements = {
    bankQuestions: db.prepare(`
      SELECT ${QUESTION_COLUMNS} FROM questions q JOIN skills s ON s.id = q.skill_id
      WHERE ${BANK_FILTER}
      ORDER BY q.grade, s.id, q.id`),
    bankOptions: db.prepare(`
      SELECT ${OPTION_COLUMNS} FROM question_options o
      JOIN questions q ON q.id = o.question_id JOIN skills s ON s.id = q.skill_id
      WHERE ${BANK_FILTER}
      ORDER BY o.question_id, o.label`),
    questionsByIds: db.prepare(`
      SELECT q.id, q.grade, s.code AS skill FROM questions q JOIN skills s ON s.id = q.skill_id
      WHERE q.id IN (SELECT value FROM json_each(?))`),
    questionsOfGradeBySkills: db.prepare(`
      SELECT q.id, q.grade, s.code AS skill FROM questions q JOIN skills s ON s.id = q.skill_id
      WHERE q.grade = ? AND s.code IN (SELECT value FROM json_each(?))
      ORDER BY q.id`),
    activeStudentIdsInGroup: db.prepare(`
      SELECT e.student_id AS id FROM group_enrollments e
      WHERE e.group_id = ? AND e.status = 'active' AND e.student_id IN (SELECT value FROM json_each(?))`),
    allActiveStudentIds: db.prepare(`
      SELECT e.student_id AS id FROM group_enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE e.group_id = ? AND e.status = 'active'
      ORDER BY ${STUDENT_ORDER}`),

    assignmentsOfGroup: db.prepare(`
      SELECT ${ASSIGNMENT_COLUMNS} FROM assignments a WHERE a.group_id = ?
      ORDER BY a.created_at DESC, a.id DESC`),
    assignmentById: db.prepare(`SELECT ${ASSIGNMENT_COLUMNS} FROM assignments a WHERE a.id = ?`),
    skillCountsOfGroup: db.prepare(`
      SELECT aq.assignment_id, s.code, s.name, COUNT(*) AS question_count, MIN(aq.position) AS first_position
      FROM assignment_questions aq
      JOIN assignments a ON a.id = aq.assignment_id
      JOIN questions q ON q.id = aq.question_id JOIN skills s ON s.id = q.skill_id
      WHERE a.group_id = ?
      GROUP BY aq.assignment_id, s.id
      ORDER BY aq.assignment_id, first_position`),
    targetCountsOfGroup: db.prepare(`
      SELECT t.assignment_id, t.status, COUNT(*) AS count
      FROM assignment_targets t JOIN assignments a ON a.id = t.assignment_id
      WHERE a.group_id = ?
      GROUP BY t.assignment_id, t.status`),
    skillCountsOfAssignment: db.prepare(`
      SELECT s.code, s.name, COUNT(*) AS question_count, MIN(aq.position) AS first_position
      FROM assignment_questions aq
      JOIN questions q ON q.id = aq.question_id JOIN skills s ON s.id = q.skill_id
      WHERE aq.assignment_id = ?
      GROUP BY s.id ORDER BY first_position`),
    targetCountsOfAssignment: db.prepare(`
      SELECT t.status, COUNT(*) AS count FROM assignment_targets t
      WHERE t.assignment_id = ? GROUP BY t.status`),
    questionsOfAssignment: db.prepare(`
      SELECT aq.position, ${QUESTION_COLUMNS}
      FROM assignment_questions aq
      JOIN questions q ON q.id = aq.question_id JOIN skills s ON s.id = q.skill_id
      WHERE aq.assignment_id = ?
      ORDER BY aq.position`),
    optionsOfAssignment: db.prepare(`
      SELECT ${OPTION_COLUMNS} FROM question_options o
      JOIN assignment_questions aq ON aq.question_id = o.question_id
      WHERE aq.assignment_id = ?
      ORDER BY o.question_id, o.label`),
    targetsOfAssignment: db.prepare(`
      SELECT t.student_id, t.status, t.is_screen_locked
      FROM assignment_targets t JOIN students s ON s.id = t.student_id
      WHERE t.assignment_id = ?
      ORDER BY ${STUDENT_ORDER}`),

    insertAssignment: db.prepare('INSERT INTO assignments (group_id, created_by, title, modality) VALUES (?, ?, ?, ?)'),
    insertAssignmentQuestion: db.prepare(
      'INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)',
    ),
    insertTarget: db.prepare(
      'INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked) VALUES (?, ?, ?, ?)',
    ),

    // ───────── Cuestionarios y constructor ─────────
    listVisibleQuizzes: db.prepare(`
      SELECT
        qz.id, qz.school_id, qz.created_by, qz.origin_type, qz.title, qz.description,
        qz.grade, qz.created_at, qz.updated_at,
        s.code AS skill_code, s.name AS skill_name,
        u.full_name AS author_name,
        COUNT(qq.id) AS question_count,
        SUM(CASE WHEN qq.question_type = 'multiple_choice' THEN 1 ELSE 0 END) AS mc_count,
        SUM(CASE WHEN qq.question_type = 'true_false' THEN 1 ELSE 0 END) AS tf_count,
        SUM(CASE WHEN qq.question_type = 'fill_blank' THEN 1 ELSE 0 END) AS fb_count
      FROM quizzes qz
      JOIN skills s ON s.id = qz.skill_id
      LEFT JOIN users u ON u.id = qz.created_by
      LEFT JOIN quiz_questions qq ON qq.quiz_id = qz.id
      WHERE qz.origin_type = 'system' OR qz.school_id = ?
      GROUP BY qz.id
      ORDER BY qz.updated_at DESC, qz.id DESC`),
    findQuizById: db.prepare(`
      SELECT
        qz.id, qz.school_id, qz.created_by, qz.origin_type, qz.title, qz.description,
        qz.grade, qz.created_at, qz.updated_at,
        s.code AS skill_code, s.name AS skill_name,
        u.full_name AS author_name
      FROM quizzes qz
      JOIN skills s ON s.id = qz.skill_id
      LEFT JOIN users u ON u.id = qz.created_by
      WHERE qz.id = ?`),
    listQuizQuestions: db.prepare(`
      SELECT id, quiz_id, position, question_type, prompt, options_json, correct_answer, hint
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY position ASC`),
    findSkillIdByCode: db.prepare('SELECT id, code, name FROM skills WHERE code = ?'),
    listAllSkills: db.prepare('SELECT id, code, name FROM skills ORDER BY id'),
    listGroupLatestMastery: db.prepare(`
      SELECT s.code AS skill_code, h.mastery_percentage
      FROM group_enrollments e
      JOIN skill_mastery_history h ON h.student_id = e.student_id
      JOIN skills s ON s.id = h.skill_id
      JOIN groups g ON g.id = e.group_id
      WHERE e.group_id = ?
        AND e.status = 'active'
        AND g.school_id = ?
        AND h.session_index = (
          SELECT MAX(h2.session_index)
          FROM skill_mastery_history h2
          WHERE h2.student_id = h.student_id AND h2.skill_id = h.skill_id
        )`),
    insertQuiz: db.prepare(`
      INSERT INTO quizzes (school_id, created_by, origin_type, title, description, skill_id, grade)
      VALUES (?, ?, 'teacher', ?, ?, ?, ?)`),
    updateQuiz: db.prepare(`
      UPDATE quizzes
      SET title = ?, description = ?, skill_id = ?, grade = ?, updated_at = datetime('now')
      WHERE id = ?`),
    deleteQuizQuestions: db.prepare('DELETE FROM quiz_questions WHERE quiz_id = ?'),
    insertQuizQuestion: db.prepare(`
      INSERT INTO quiz_questions (quiz_id, position, question_type, prompt, options_json, correct_answer, hint)
      VALUES (?, ?, ?, ?, ?, ?, ?)`),
  };

  const json = (values) => JSON.stringify(values);

  return {
    listBankQuestions: ({ grade, skill }) => statements.bankQuestions.all(grade, skill),
    listBankOptions: ({ grade, skill }) => statements.bankOptions.all(grade, skill),
    findQuestionsByIds: (ids) => statements.questionsByIds.all(json(ids)),
    listQuestionsOfGradeBySkills: (grade, skills) => statements.questionsOfGradeBySkills.all(grade, json(skills)),
    findActiveStudentIdsInGroup: (groupId, ids) =>
      statements.activeStudentIdsInGroup.all(groupId, json(ids)).map((r) => r.id),
    listActiveStudentIds: (groupId) => statements.allActiveStudentIds.all(groupId).map((r) => r.id),

    listAssignmentsOfGroup: (groupId) => statements.assignmentsOfGroup.all(groupId),
    findAssignmentById: (id) => statements.assignmentById.get(id) ?? null,
    listSkillCountsOfGroup: (groupId) => statements.skillCountsOfGroup.all(groupId),
    listTargetCountsOfGroup: (groupId) => statements.targetCountsOfGroup.all(groupId),
    listSkillCountsOfAssignment: (id) => statements.skillCountsOfAssignment.all(id),
    listTargetCountsOfAssignment: (id) => statements.targetCountsOfAssignment.all(id),
    listQuestionsOfAssignment: (id) => statements.questionsOfAssignment.all(id),
    listOptionsOfAssignment: (id) => statements.optionsOfAssignment.all(id),
    listTargetsOfAssignment: (id) => statements.targetsOfAssignment.all(id),

    insertAssignment: ({ groupId, createdBy, title, modality }) =>
      Number(statements.insertAssignment.run(groupId, createdBy, title, modality).lastInsertRowid),
    insertAssignmentQuestions: (assignmentId, questionIds) =>
      questionIds.forEach((qid, idx) => statements.insertAssignmentQuestion.run(assignmentId, qid, idx + 1)),
    insertTargets: (assignmentId, studentIds, { status, is_screen_locked: locked }) =>
      studentIds.forEach((sid) => statements.insertTarget.run(assignmentId, sid, status, locked)),

    listVisibleQuizzes: (schoolId) => statements.listVisibleQuizzes.all(schoolId),
    findQuizById: (quizId) => statements.findQuizById.get(quizId) ?? null,
    listQuizQuestions: (quizId) => statements.listQuizQuestions.all(quizId),
    findSkillIdByCode: (code) => statements.findSkillIdByCode.get(code)?.id ?? null,
    listAllSkills: () => statements.listAllSkills.all(),
    listGroupLatestMastery: (groupId, schoolId) => statements.listGroupLatestMastery.all(groupId, schoolId),
    insertQuiz: ({ schoolId, createdBy, title, description, skillId, grade }) =>
      Number(statements.insertQuiz.run(schoolId, createdBy, title, description, skillId, grade).lastInsertRowid),
    updateQuiz: ({ id, title, description, skillId, grade }) => {
      statements.updateQuiz.run(title, description, skillId, grade, id);
    },
    replaceQuizQuestions: (quizId, questions) => {
      statements.deleteQuizQuestions.run(quizId);
      questions.forEach((q, idx) => {
        statements.insertQuizQuestion.run(
          quizId,
          idx + 1,
          q.questionType,
          q.prompt,
          JSON.stringify(q.options ?? []),
          q.correctAnswer,
          q.hint ?? '',
        );
      });
    },
  };
}
