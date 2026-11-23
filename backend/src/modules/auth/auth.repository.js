/**
 * Módulo auth — Capa 4 (Infraestructura): consultas SQL parametrizadas contra SQLite.
 */

const STAFF_COLUMNS = 'id, school_id, email, password_hash, full_name, role';
const GROUP_COLUMNS = 'id, school_id, teacher_id, grade, section, school_year, join_code';
const STUDENT_COLUMNS = 's.id, s.school_id, s.first_names, s.last_names, s.initials, s.avatar_color, s.avatar_id';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createAuthRepository(db) {
  const statements = {
    staffByEmail: db.prepare(`SELECT ${STAFF_COLUMNS} FROM users WHERE email = ?`),
    staffById: db.prepare(`SELECT ${STAFF_COLUMNS} FROM users WHERE id = ?`),
    groupByJoinCode: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups WHERE join_code = ?`),
    groupById: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups WHERE id = ?`),
    latestGroupOfTeacher: db.prepare(
      `SELECT ${GROUP_COLUMNS} FROM groups WHERE teacher_id = ? ORDER BY school_year DESC, grade, section, id LIMIT 1`,
    ),
    activeStudents: db.prepare(`
      SELECT ${STUDENT_COLUMNS} FROM students s
      JOIN group_enrollments e ON e.student_id = s.id
      WHERE e.group_id = ? AND e.status = 'active'
      ORDER BY s.first_names COLLATE NOCASE, s.last_names COLLATE NOCASE, s.id`),
    activeStudent: db.prepare(`
      SELECT ${STUDENT_COLUMNS} FROM students s
      JOIN group_enrollments e ON e.student_id = s.id
      WHERE e.group_id = ? AND s.id = ? AND e.status = 'active'`),
    firstActiveStudent: db.prepare(`
      SELECT ${STUDENT_COLUMNS} FROM students s
      JOIN group_enrollments e ON e.student_id = s.id
      WHERE e.group_id = ? AND e.status = 'active'
      ORDER BY s.id LIMIT 1`),
  };

  return {
    findStaffByEmail: (email) => statements.staffByEmail.get(email) ?? null,
    findStaffById: (id) => statements.staffById.get(id) ?? null,
    findGroupByJoinCode: (code) => statements.groupByJoinCode.get(code) ?? null,
    findGroupById: (id) => statements.groupById.get(id) ?? null,
    findLatestGroupOfTeacher: (teacherId) => statements.latestGroupOfTeacher.get(teacherId) ?? null,
    listActiveStudents: (groupId) => statements.activeStudents.all(groupId),
    findActiveStudent: (groupId, studentId) => statements.activeStudent.get(groupId, studentId) ?? null,
    findFirstActiveStudent: (groupId) => statements.firstActiveStudent.get(groupId) ?? null,
  };
}
