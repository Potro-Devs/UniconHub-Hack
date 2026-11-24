/**
 * Módulo curriculum — Capa 4 (Infraestructura): consultas SQL parametrizadas contra SQLite.
 */

const CONTENT_COLUMNS = `
  c.id, c.phase, c.grade, c.formative_field, c.title, c.pda, c.sort_order,
  sk.code AS skill_code, sk.name AS skill_name,
  p.status, p.notes, p.updated_at`;

const CONTENT_FROM = `
  FROM curriculum_contents c
  LEFT JOIN skills sk ON sk.id = c.skill_id
  LEFT JOIN group_curriculum_progress p ON p.content_id = c.id AND p.group_id = ?`;

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createCurriculumRepository(db) {
  const statements = {
    contentsOfGrade: db.prepare(
      `SELECT ${CONTENT_COLUMNS} ${CONTENT_FROM} WHERE c.grade = ? ORDER BY c.sort_order, c.id`,
    ),
    contentOfGrade: db.prepare(`SELECT ${CONTENT_COLUMNS} ${CONTENT_FROM} WHERE c.id = ? AND c.grade = ?`),
    upsertProgress: db.prepare(`
      INSERT INTO group_curriculum_progress (group_id, content_id, status, notes, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT (group_id, content_id) DO UPDATE SET
        status = excluded.status, notes = excluded.notes, updated_at = excluded.updated_at`),
  };

  return {
    /** Contenidos del grado con el avance del grupo (columnas de avance `NULL` si no hay registro). */
    listContentsWithProgress: (groupId, grade) => statements.contentsOfGrade.all(groupId, grade),
    findContentWithProgress: (groupId, contentId, grade) =>
      statements.contentOfGrade.get(groupId, contentId, grade) ?? null,
    upsertProgress: (groupId, contentId, { status, notes }) =>
      statements.upsertProgress.run(groupId, contentId, status, notes),
  };
}
