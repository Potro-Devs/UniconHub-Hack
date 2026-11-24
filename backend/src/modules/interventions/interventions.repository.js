/**
 * Única capa con SQL del módulo. Las consultas se acotan al grupo y a alumnos con
 * matrícula activa en él.
 */
export function createInterventionsRepository(db) {
  const activityForGrade = db.prepare(`SELECT ra.*, sk.code AS skill_code, sk.name AS skill_name
    FROM recommended_activities ra JOIN skills sk ON sk.id = ra.skill_id
    WHERE ra.id = ? AND ra.grade_min <= ? AND ra.grade_max >= ?`);
  const insert = db.prepare(`INSERT INTO group_interventions
    (group_id, activity_id, skill_id, target_error_tag, created_by, note, response_cutoff_id)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(id) FROM student_responses), 0))`);
  const list = db.prepare(`SELECT i.*, ra.title, ra.duration_minutes, ra.grouping,
      sk.code AS skill_code, sk.name AS skill_name,
      (SELECT o.error_explanation FROM question_options o
        JOIN questions q ON q.id = o.question_id
        WHERE o.error_tag = i.target_error_tag AND q.skill_id = i.skill_id
          AND o.error_explanation IS NOT NULL
        ORDER BY o.id LIMIT 1) AS error_explanation
    FROM group_interventions i JOIN recommended_activities ra ON ra.id = i.activity_id
    JOIN skills sk ON sk.id = i.skill_id
    WHERE i.group_id = ? ORDER BY i.applied_at DESC, i.id DESC`);
  // Respuestas de una habilidad en pruebas terminadas del grupo, solo de alumnos activos.
  const responses = `FROM student_responses r
    JOIN assignment_targets t ON t.id = r.assignment_target_id
    JOIN assignments a ON a.id = t.assignment_id
    JOIN questions q ON q.id = r.question_id
    WHERE a.group_id = ? AND q.skill_id = ?
      AND t.status IN ('completed_screen', 'completed_paper')
      AND EXISTS (SELECT 1 FROM group_enrollments e
        WHERE e.group_id = a.group_id AND e.student_id = t.student_id AND e.status = 'active')`;
  const questionsForTargetError = `(? IS NULL OR EXISTS (
    SELECT 1 FROM question_options relevant
    WHERE relevant.question_id = r.question_id AND relevant.error_tag = ?))`;
  const selectedTargetError = `(? IS NULL OR EXISTS (
    SELECT 1 FROM question_options selected
    WHERE selected.id = r.selected_option_id AND selected.question_id = r.question_id
      AND selected.error_tag = ?))`;
  const latestPriorAssessment = `AND NOT EXISTS (
    SELECT 1 FROM assignments newer_a
    JOIN assignment_targets newer_t ON newer_t.assignment_id = newer_a.id
    JOIN student_responses newer_r ON newer_r.assignment_target_id = newer_t.id
    JOIN questions newer_q ON newer_q.id = newer_r.question_id
    WHERE newer_a.group_id = a.group_id AND newer_t.student_id = t.student_id
      AND newer_q.skill_id = q.skill_id AND newer_a.id > a.id AND newer_r.id <= ?
      AND newer_r.outcome_status <> 'unanswered'
      AND newer_t.status IN ('completed_screen', 'completed_paper')
      AND EXISTS (SELECT 1 FROM group_enrollments newer_e
        WHERE newer_e.group_id = newer_a.group_id AND newer_e.student_id = newer_t.student_id
          AND newer_e.status = 'active'))`;
  const before = db.prepare(`SELECT DISTINCT t.student_id AS id ${responses}
    AND r.id <= ? AND r.outcome_status = 'incorrect' AND ${selectedTargetError}
    ${latestPriorAssessment}`);
  const after = db.prepare(`SELECT DISTINCT t.student_id AS id ${responses}
    AND r.id > ? AND r.outcome_status <> 'unanswered' AND ${questionsForTargetError}`);
  const afterWithError = db.prepare(`SELECT DISTINCT t.student_id AS id ${responses}
    AND r.id > ? AND r.outcome_status = 'incorrect' AND ${selectedTargetError}`);
  const ids = (rows) => rows.map((row) => row.id);
  return {
    findActivityForGrade: (activityId, grade) => activityForGrade.get(activityId, grade, grade) ?? null,
    create: ({ groupId, activityId, skillId, errorTag, userId, note }) =>
      Number(insert.run(groupId, activityId, skillId, errorTag, userId, note).lastInsertRowid),
    listByGroup: (groupId) => list.all(groupId),
    findOutcomeIds: ({ groupId, skillId, errorTag, responseCutoffId }) => ({
      baselineIds: ids(before.all(groupId, skillId, responseCutoffId, errorTag, errorTag, responseCutoffId)),
      reevaluatedIds: ids(after.all(groupId, skillId, responseCutoffId, errorTag, errorTag)),
      stillWithErrorIds: ids(afterWithError.all(groupId, skillId, responseCutoffId, errorTag, errorTag)),
    }),
  };
}
