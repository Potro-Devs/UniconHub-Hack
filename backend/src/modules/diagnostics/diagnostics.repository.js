/**
 * Módulo diagnostics — Capa 4 (Infraestructura): consultas SQL parametrizadas contra SQLite.
 * Nunca selecciona `internal_folio` ni expone `is_correct`/`error_tag` en listados públicos de opciones.
 */

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createDiagnosticsRepository(db) {
  const statements = {
    assignmentsForStudent: db.prepare(`
      SELECT a.id, a.title, a.modality, a.status AS assignment_status, a.created_at,
             t.status AS target_status, t.is_screen_locked, t.started_at, t.completed_at,
             (SELECT COUNT(*) FROM assignment_questions aq WHERE aq.assignment_id = a.id) AS question_count,
             (SELECT COUNT(*) FROM student_responses sr
              WHERE sr.assignment_target_id = t.id AND sr.outcome_status <> 'unanswered') AS answered_count
      FROM assignment_targets t
      JOIN assignments a ON a.id = t.assignment_id
      WHERE t.student_id = ? AND a.group_id = ?
      ORDER BY a.created_at DESC, a.id DESC`),
    skillCountsForStudentGroup: db.prepare(`
      SELECT aq.assignment_id, s.code, s.name, COUNT(*) AS question_count, MIN(aq.position) AS first_position
      FROM assignment_questions aq
      JOIN assignments a ON a.id = aq.assignment_id
      JOIN assignment_targets t ON t.assignment_id = a.id
      JOIN questions q ON q.id = aq.question_id
      JOIN skills s ON s.id = q.skill_id
      WHERE t.student_id = ? AND a.group_id = ?
      GROUP BY aq.assignment_id, s.id
      ORDER BY aq.assignment_id, first_position`),
    targetAssignment: db.prepare(`
      SELECT t.id AS target_id, t.status, t.is_screen_locked, t.started_at, t.completed_at,
             a.id AS assignment_id, a.group_id, a.title, a.modality, a.status AS assignment_status,
             g.grade
      FROM assignment_targets t
      JOIN assignments a ON a.id = t.assignment_id
      JOIN groups g ON g.id = a.group_id
      WHERE a.id = ? AND t.student_id = ? AND a.group_id = ?`),
    markInProgress: db.prepare(`
      UPDATE assignment_targets
      SET status = 'in_progress', started_at = COALESCE(started_at, datetime('now'))
      WHERE id = ? AND status = 'pending'`),
    markCompletedScreen: db.prepare(`
      UPDATE assignment_targets
      SET status = 'completed_screen',
          started_at = COALESCE(started_at, datetime('now')),
          completed_at = datetime('now')
      WHERE id = ? AND status IN ('pending', 'in_progress') AND is_screen_locked = 0`),
    targetById: db.prepare('SELECT id, status, started_at, completed_at FROM assignment_targets WHERE id = ?'),
    questionsOfAssignment: db.prepare(`
      SELECT aq.position, q.id, q.skill_id, q.stem, q.hint_1, q.hint_2, q.hint_3,
             s.code AS skill_code, s.name AS skill_name
      FROM assignment_questions aq
      JOIN questions q ON q.id = aq.question_id
      JOIN skills s ON s.id = q.skill_id
      WHERE aq.assignment_id = ?
      ORDER BY aq.position`),
    questionHintsInAssignment: db.prepare(`
      SELECT q.id, q.hint_1, q.hint_2, q.hint_3
      FROM assignment_questions aq
      JOIN questions q ON q.id = aq.question_id
      WHERE aq.assignment_id = ? AND aq.question_id = ?`),
    hintLevel: db.prepare(
      'SELECT max_hint_level FROM hint_requests WHERE assignment_target_id = ? AND question_id = ?',
    ),
    hintRequestsOfTarget: db.prepare(
      'SELECT question_id, max_hint_level FROM hint_requests WHERE assignment_target_id = ?',
    ),
    upsertHintLevel: db.prepare(`
      INSERT INTO hint_requests (assignment_target_id, question_id, max_hint_level)
      VALUES (?, ?, ?)
      ON CONFLICT(assignment_target_id, question_id) DO UPDATE
      SET max_hint_level = excluded.max_hint_level, updated_at = datetime('now')`),
    publicOptionsOfAssignment: db.prepare(`
      SELECT o.id, o.question_id, o.label, o.text
      FROM question_options o
      JOIN assignment_questions aq ON aq.question_id = o.question_id
      WHERE aq.assignment_id = ?
      ORDER BY o.question_id, o.label`),
    responsesOfTarget: db.prepare(`
      SELECT question_id, selected_option_id, outcome_status, max_hint_level_used, error_tag
      FROM student_responses
      WHERE assignment_target_id = ?`),
    questionInAssignment: db.prepare(`
      SELECT q.id, q.skill_id
      FROM assignment_questions aq
      JOIN questions q ON q.id = aq.question_id
      WHERE aq.assignment_id = ? AND aq.question_id = ?`),
    optionOfQuestion: db.prepare(
      'SELECT id, is_correct, error_tag FROM question_options WHERE question_id = ? AND id = ?',
    ),
    findResponse: db.prepare(
      'SELECT id FROM student_responses WHERE assignment_target_id = ? AND question_id = ?',
    ),
    insertResponse: db.prepare(`
      INSERT INTO student_responses
        (assignment_target_id, question_id, selected_option_id, outcome_status, max_hint_level_used, error_tag, source)
      VALUES (?, ?, ?, ?, ?, ?, 'screen')`),
    masteryCuts: db.prepare(`
      SELECT session_index, session_percentage, mastery_percentage
      FROM skill_mastery_history
      WHERE student_id = ? AND skill_id = ?
      ORDER BY session_index ASC`),
    insertMasteryCut: db.prepare(`
      INSERT INTO skill_mastery_history
        (student_id, skill_id, assignment_id, grade, session_index, session_percentage,
         autonomous_percentage, supported_percentage, mastery_percentage, mastery_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    insertAchievement: db.prepare(`
      INSERT INTO student_achievements (student_id, achievement_code, size, skill_id, assignment_id)
      VALUES (?, ?, ?, ?, ?)`),
  };

  return {
    listAssignmentsForStudent: (studentId, groupId) => statements.assignmentsForStudent.all(studentId, groupId),
    listSkillCountsForStudentGroup: (studentId, groupId) =>
      statements.skillCountsForStudentGroup.all(studentId, groupId),
    findTargetAssignment: (assignmentId, studentId, groupId) =>
      statements.targetAssignment.get(assignmentId, studentId, groupId) ?? null,
    markTargetInProgress: (targetId) => statements.markInProgress.run(targetId),
    markTargetCompletedScreen: (targetId) => statements.markCompletedScreen.run(targetId),
    findTargetById: (targetId) => statements.targetById.get(targetId) ?? null,
    listQuestionsOfAssignment: (assignmentId) => statements.questionsOfAssignment.all(assignmentId),
    findQuestionHintsInAssignment: (assignmentId, questionId) =>
      statements.questionHintsInAssignment.get(assignmentId, questionId) ?? null,
    findHintLevel: (targetId, questionId) => statements.hintLevel.get(targetId, questionId)?.max_hint_level ?? 0,
    listHintRequestsOfTarget: (targetId) => statements.hintRequestsOfTarget.all(targetId),
    upsertHintLevel: (targetId, questionId, level) => statements.upsertHintLevel.run(targetId, questionId, level),
    listPublicOptionsOfAssignment: (assignmentId) => statements.publicOptionsOfAssignment.all(assignmentId),
    listResponsesOfTarget: (targetId) => statements.responsesOfTarget.all(targetId),
    findQuestionInAssignment: (assignmentId, questionId) =>
      statements.questionInAssignment.get(assignmentId, questionId) ?? null,
    findOptionOfQuestion: (questionId, optionId) => statements.optionOfQuestion.get(questionId, optionId) ?? null,
    findResponse: (targetId, questionId) => statements.findResponse.get(targetId, questionId) ?? null,
    insertResponse: ({ targetId, questionId, selectedOptionId, outcomeStatus, maxHintLevelUsed, errorTag }) =>
      statements.insertResponse.run(
        targetId,
        questionId,
        selectedOptionId,
        outcomeStatus,
        maxHintLevelUsed,
        errorTag,
      ),
    listMasteryCuts: (studentId, skillId) => statements.masteryCuts.all(studentId, skillId),
    insertMasteryCut: ({ studentId, skillId, assignmentId, grade, cut }) =>
      statements.insertMasteryCut.run(
        studentId,
        skillId,
        assignmentId,
        grade,
        cut.session_index,
        cut.session_percentage,
        cut.autonomous_percentage,
        cut.supported_percentage,
        cut.mastery_percentage,
        cut.mastery_level,
      ),
    insertAchievement: ({ studentId, code, size, skillId, assignmentId }) =>
      statements.insertAchievement.run(studentId, code, size, skillId, assignmentId),
  };
}
