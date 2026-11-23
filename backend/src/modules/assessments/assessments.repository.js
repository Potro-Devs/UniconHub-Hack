/**
 * Módulo assessments — Capa 4 (Infraestructura): consultas SQL parametrizadas contra SQLite.
 * Las listas de ids se pasan como JSON y se expanden con `json_each(?)` (sin concatenar SQL).
 * Nunca selecciona `internal_folio`.
 */

const QUESTION_COLUMNS = `q.id, q.grade, q.content_id, q.stem, q.hint_1, q.hint_2, q.hint_3, q.difficulty,
  s.code AS skill_code, s.name AS skill_name`;
const OPTION_COLUMNS = 'o.question_id, o.label, o.text, o.is_correct, o.error_tag, o.error_explanation';
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
  };
}
