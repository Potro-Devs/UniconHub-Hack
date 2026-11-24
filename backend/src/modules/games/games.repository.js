/** Confirma la escuela del alumno incluso ante una matrícula inconsistente. Solo lectura. */
export function createGamesRepository(db) {
  const studentInSchool = db.prepare('SELECT 1 FROM students WHERE id = ? AND school_id = ?');
  return { isStudentInSchool: (studentId, schoolId) => studentInSchool.get(studentId, schoolId) !== undefined };
}
