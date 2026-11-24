/** Consultas de solo lectura, parametrizadas y acotadas a la escuela. */
export function createAnalyticsRepository(db) {
  const skills = db.prepare('SELECT id, code, name FROM skills ORDER BY id');
  const history = db.prepare(`
    SELECT h.*, sk.code AS skill_code, sk.name AS skill_name, g.school_year
    FROM skill_mastery_history h JOIN skills sk ON sk.id = h.skill_id
    JOIN students s ON s.id = h.student_id
    LEFT JOIN assignments a ON a.id = h.assignment_id LEFT JOIN groups g ON g.id = a.group_id
    WHERE s.school_id = ? AND (h.assignment_id IS NULL OR g.school_id = ?)
      AND EXISTS (SELECT 1 FROM group_enrollments e
        WHERE e.student_id = h.student_id AND e.group_id = ? AND e.status = 'active')
    ORDER BY h.student_id, h.skill_id, h.session_index, h.id`);
  const errors = db.prepare(`
    SELECT sk.code AS skill_code, r.error_tag, o.error_explanation AS explanation, COUNT(*) AS count
    FROM student_responses r JOIN assignment_targets t ON t.id = r.assignment_target_id
    JOIN assignments a ON a.id = t.assignment_id JOIN questions q ON q.id = r.question_id
    JOIN skills sk ON sk.id = q.skill_id JOIN question_options o ON o.id = r.selected_option_id
    JOIN students s ON s.id = t.student_id
    WHERE a.group_id = ? AND s.school_id = ?
      AND t.status IN ('completed_screen', 'completed_paper') AND r.outcome_status = 'incorrect'
      AND (? IS NULL OR t.student_id = ?)
      AND EXISTS (SELECT 1 FROM group_enrollments e
        WHERE e.group_id = a.group_id AND e.student_id = t.student_id AND e.status = 'active')
    GROUP BY sk.code, r.error_tag, o.error_explanation
    ORDER BY count DESC, sk.code, r.error_tag, o.error_explanation`);
  const activities = db.prepare(`SELECT ra.*, sk.code AS skill_code
    FROM recommended_activities ra JOIN skills sk ON sk.id = ra.skill_id
    WHERE ra.grade_min <= ? AND ra.grade_max >= ? ORDER BY ra.id`);
  return {
    listSkills: () => skills.all(),
    listGroupHistory: (groupId, schoolId) => history.all(schoolId, schoolId, groupId),
    listTypicalErrors: (groupId, schoolId, studentId = null) => errors.all(groupId, schoolId, studentId, studentId),
    listActivities: (grade) => activities.all(grade, grade),
  };
}
