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
  /*
   * Antes y después se comparan por PRUEBA COMPLETA (assignment_target), no por respuesta suelta:
   * - Una prueba es "antes" si empezó (primera respuesta) antes de registrar la actividad y
   *   "después" si empezó después. Una prueba en curso al registrar nunca se parte en dos.
   * - Solo cuentan pruebas terminadas, de alumnos activos, con reactivos de la habilidad que
   *   permitían mostrar el error objetivo (si la actividad tiene uno). Antes y después usan la misma regla.
   * - Por alumno se toma su prueba más reciente de cada lado: si en la última reevaluación ya no
   *   muestra el error, cuenta como superado aunque lo haya mostrado en una anterior.
   */
  const latestTargets = db.prepare(`
    WITH per_target AS (
      SELECT t.id AS target_id, t.student_id, MIN(r.id) AS first_response_id,
        MAX(CASE WHEN r.outcome_status = 'incorrect'
          AND (? IS NULL OR EXISTS (SELECT 1 FROM question_options sel
            WHERE sel.id = r.selected_option_id AND sel.question_id = r.question_id AND sel.error_tag = ?))
          THEN 1 ELSE 0 END) AS showed_error,
        MAX(CASE WHEN r.outcome_status <> 'unanswered'
          AND (? IS NULL OR EXISTS (SELECT 1 FROM question_options relevant
            WHERE relevant.question_id = r.question_id AND relevant.error_tag = ?))
          THEN 1 ELSE 0 END) AS could_show
      FROM student_responses r
      JOIN assignment_targets t ON t.id = r.assignment_target_id
      JOIN assignments a ON a.id = t.assignment_id
      JOIN questions q ON q.id = r.question_id
      WHERE a.group_id = ? AND q.skill_id = ?
        AND t.status IN ('completed_screen', 'completed_paper')
        AND EXISTS (SELECT 1 FROM group_enrollments e
          WHERE e.group_id = a.group_id AND e.student_id = t.student_id AND e.status = 'active')
      GROUP BY t.id, t.student_id
    ),
    sided AS (
      SELECT *, CASE WHEN first_response_id > ? THEN 'after' ELSE 'before' END AS side
      FROM per_target WHERE could_show = 1
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY student_id, side ORDER BY first_response_id DESC, target_id DESC) AS rn
      FROM sided
    )
    SELECT student_id AS id, side, showed_error FROM ranked WHERE rn = 1`);
  const ids = (rows) => rows.map((row) => row.id);
  return {
    findActivityForGrade: (activityId, grade) => activityForGrade.get(activityId, grade, grade) ?? null,
    create: ({ groupId, activityId, skillId, errorTag, userId, note }) =>
      Number(insert.run(groupId, activityId, skillId, errorTag, userId, note).lastInsertRowid),
    listByGroup: (groupId) => list.all(groupId),
    findOutcomeIds: ({ groupId, skillId, errorTag, responseCutoffId }) => {
      const rows = latestTargets.all(errorTag, errorTag, errorTag, errorTag, groupId, skillId, responseCutoffId);
      const before = rows.filter((row) => row.side === 'before');
      const after = rows.filter((row) => row.side === 'after');
      return {
        baselineIds: ids(before.filter((row) => row.showed_error === 1)),
        reevaluatedIds: ids(after),
        stillWithErrorIds: ids(after.filter((row) => row.showed_error === 1)),
      };
    },
  };
}
