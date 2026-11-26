/**
 * Módulo paper-mode — Capa 4 (Infraestructura): consultas SQL parametrizadas contra SQLite.
 * Nunca selecciona `internal_folio` ni nombres de alumnos.
 */

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createPaperModeRepository(db) {
  const statements = {
    target: db.prepare('SELECT id, status, completed_at FROM assignment_targets WHERE assignment_id = ? AND student_id = ?'),
    optionsOfAssignment: db.prepare(`
      SELECT o.id, o.question_id, o.is_correct, o.error_tag
      FROM question_options o
      JOIN assignment_questions aq ON aq.question_id = o.question_id
      WHERE aq.assignment_id = ?
      ORDER BY o.question_id, o.label`),
    // Solo cambia un destinatario aún no capturado: protege contra dos capturas simultáneas.
    markCaptured: db.prepare(`
      UPDATE assignment_targets
      SET status = ?, is_screen_locked = ?,
          started_at = COALESCE(started_at, datetime('now')),
          completed_at = datetime('now')
      WHERE id = ? AND status <> 'completed_paper'`),
  };

  return {
    findTarget: (assignmentId, studentId) => statements.target.get(assignmentId, studentId) ?? null,
    listOptionsOfAssignment: (assignmentId) => statements.optionsOfAssignment.all(assignmentId),
    markTargetCaptured: (targetId, { status, is_screen_locked }) =>
      statements.markCaptured.run(status, is_screen_locked, targetId),
  };
}
