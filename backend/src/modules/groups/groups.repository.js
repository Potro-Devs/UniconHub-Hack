/**
 * Módulo groups — Capa 4 (Infraestructura): consultas SQL parametrizadas contra SQLite.
 * Nunca selecciona `internal_folio` para devolverlo; solo lo usa para comprobar unicidad.
 */

const ACTIVE_COUNT = `(SELECT COUNT(*) FROM group_enrollments e WHERE e.group_id = g.id AND e.status = 'active')`;
const GROUP_COLUMNS = `g.id, g.school_id, g.teacher_id, g.grade, g.section, g.school_year, g.join_code, ${ACTIVE_COUNT} AS student_count`;
const GROUP_ORDER = 'ORDER BY g.school_year DESC, g.grade, g.section, g.id';
const STUDENT_COLUMNS = 's.id, s.first_names, s.last_names, s.initials, s.avatar_color, s.avatar_id';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createGroupsRepository(db) {
  const statements = {
    staffById: db.prepare('SELECT id, school_id, role FROM users WHERE id = ?'),
    groupsOfTeacher: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups g WHERE g.teacher_id = ? AND g.school_id = ? ${GROUP_ORDER}`),
    groupsOfSchool: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups g WHERE g.school_id = ? ${GROUP_ORDER}`),
    groupOfTeacher: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups g WHERE g.id = ? AND g.teacher_id = ? AND g.school_id = ?`),
    groupOfSchool: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups g WHERE g.id = ? AND g.school_id = ?`),
    duplicateGroup: db.prepare(
      'SELECT id FROM groups WHERE school_id = ? AND grade = ? AND section = ? AND school_year = ? AND id <> ?',
    ),
    joinCodeExists: db.prepare('SELECT 1 FROM groups WHERE join_code = ?'),
    insertGroup: db.prepare(
      'INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    updateGroup: db.prepare(
      "UPDATE groups SET grade = ?, section = ?, school_year = ?, updated_at = datetime('now') WHERE id = ?",
    ),
    activeStudents: db.prepare(`
      SELECT ${STUDENT_COLUMNS} FROM students s
      JOIN group_enrollments e ON e.student_id = s.id
      WHERE e.group_id = ? AND e.status = 'active'
      ORDER BY s.last_names COLLATE NOCASE, s.first_names COLLATE NOCASE, s.id`),
    studentById: db.prepare(`SELECT ${STUDENT_COLUMNS} FROM students s WHERE s.id = ?`),
    activeStudentOfTeacher: db.prepare(`
      SELECT ${STUDENT_COLUMNS} FROM students s
      JOIN group_enrollments e ON e.student_id = s.id AND e.status = 'active'
      JOIN groups g ON g.id = e.group_id
      WHERE s.id = ? AND g.teacher_id = ? AND g.school_id = ?
      LIMIT 1`),
    activeStudentInGroup: db.prepare(`
      SELECT ${STUDENT_COLUMNS} FROM students s
      JOIN group_enrollments e ON e.student_id = s.id
      WHERE s.id = ? AND e.group_id = ? AND e.status = 'active'`),
    folioExists: db.prepare('SELECT 1 FROM students WHERE internal_folio = ?'),
    insertStudent: db.prepare(
      'INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    enroll: db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'active')"),
    updateAvatar: db.prepare('UPDATE students SET avatar_id = ?, avatar_color = ? WHERE id = ?'),
    groupHasHistory: db.prepare(`
      SELECT EXISTS (SELECT 1 FROM group_enrollments WHERE group_id = ?)
          OR EXISTS (SELECT 1 FROM assignments WHERE group_id = ?) AS has_history`),
  };

  return {
    findStaffById: (id) => statements.staffById.get(id) ?? null,
    listGroupsOfTeacher: (teacherId, schoolId) => statements.groupsOfTeacher.all(teacherId, schoolId),
    listGroupsOfSchool: (schoolId) => statements.groupsOfSchool.all(schoolId),
    findGroupOfTeacher: (groupId, teacherId, schoolId) =>
      statements.groupOfTeacher.get(groupId, teacherId, schoolId) ?? null,
    findGroupOfSchool: (groupId, schoolId) => statements.groupOfSchool.get(groupId, schoolId) ?? null,
    /** `excludeId` permite ignorar el propio grupo al editarlo (0 al crear). */
    groupExists: ({ schoolId, grade, section, schoolYear }, excludeId = 0) =>
      statements.duplicateGroup.get(schoolId, grade, section, schoolYear, excludeId) !== undefined,
    joinCodeExists: (code) => statements.joinCodeExists.get(code) !== undefined,
    insertGroup: ({ schoolId, teacherId, grade, section, schoolYear, joinCode }) =>
      Number(statements.insertGroup.run(schoolId, teacherId, grade, section, schoolYear, joinCode).lastInsertRowid),
    updateGroup: (groupId, { grade, section, schoolYear }) => statements.updateGroup.run(grade, section, schoolYear, groupId),

    listActiveStudents: (groupId) => statements.activeStudents.all(groupId),
    findStudentById: (id) => statements.studentById.get(id) ?? null,
    findActiveStudentOfTeacher: (studentId, teacherId, schoolId) =>
      statements.activeStudentOfTeacher.get(studentId, teacherId, schoolId) ?? null,
    findActiveStudentInGroup: (studentId, groupId) => statements.activeStudentInGroup.get(studentId, groupId) ?? null,
    folioExists: (folio) => statements.folioExists.get(folio) !== undefined,
    insertStudent: (schoolId, s) =>
      Number(
        statements.insertStudent.run(schoolId, s.internal_folio, s.first_names, s.last_names, s.initials, s.avatar_color)
          .lastInsertRowid,
      ),
    enrollActive: (groupId, studentId) => statements.enroll.run(groupId, studentId),
    /** Escribe los valores finales; el servicio decide qué se conserva y qué se quita. */
    updateAvatar: (studentId, { avatarId, avatarColor }) => statements.updateAvatar.run(avatarId, avatarColor, studentId),
    /** Inscripciones de cualquier estado o asignaciones. */
    groupHasHistory: (groupId) => statements.groupHasHistory.get(groupId, groupId).has_history === 1,
  };
}
