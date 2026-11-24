/**
 * Única capa con SQL del módulo. Las consultas se acotan al grupo y a alumnos con
 * matrícula activa en él.
 */
export function createInterventionsRepository(db) {
  const activityForGrade = db.prepare(`SELECT ra.*, sk.code AS skill_code, sk.name AS skill_name
    FROM recommended_activities ra JOIN skills sk ON sk.id = ra.skill_id
    WHERE ra.id = ? AND ra.grade_min <= ? AND ra.grade_max >= ?`);
  const insert = db.prepare(`INSERT INTO group_interventions
    (group_id, activity_id, skill_id, target_error_tag, created_by, note) VALUES (?, ?, ?, ?, ?, ?)`);
  const list = db.prepare(`SELECT i.*, ra.title, ra.duration_minutes, ra.grouping,
      sk.code AS skill_code, sk.name AS skill_name,
      (SELECT o.error_explanation FROM question_options o
        WHERE o.error_tag = i.target_error_tag AND o.error_explanation IS NOT NULL
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
  // Sin error etiquetado en la actividad, cuenta cualquier respuesta incorrecta de la habilidad.
  const withError = `AND r.outcome_status = 'incorrect' AND (? IS NULL OR r.error_tag = ?)`;
  const before = db.prepare(`SELECT DISTINCT t.student_id AS id ${responses} ${withError} AND r.answered_at <= ?`);
  const after = db.prepare(`SELECT DISTINCT t.student_id AS id ${responses}
    AND r.outcome_status <> 'unanswered' AND r.answered_at > ?`);
  const afterWithError = db.prepare(`SELECT DISTINCT t.student_id AS id ${responses} ${withError} AND r.answered_at > ?`);
  const ids = (rows) => rows.map((row) => row.id);
  return {
    findActivityForGrade: (activityId, grade) => activityForGrade.get(activityId, grade, grade) ?? null,
    create: ({ groupId, activityId, skillId, errorTag, userId, note }) =>
      Number(insert.run(groupId, activityId, skillId, errorTag, userId, note).lastInsertRowid),
    listByGroup: (groupId) => list.all(groupId),
    findOutcomeIds: ({ groupId, skillId, errorTag, appliedAt }) => ({
      baselineIds: ids(before.all(groupId, skillId, errorTag, errorTag, appliedAt)),
      reevaluatedIds: ids(after.all(groupId, skillId, appliedAt)),
      stillWithErrorIds: ids(afterWithError.all(groupId, skillId, errorTag, errorTag, appliedAt)),
    }),
  };
}
