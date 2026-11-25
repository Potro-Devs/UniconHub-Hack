/**
 * Única capa con SQL del módulo tutoring. Consultas parametrizadas y acotadas al grupo,
 * a la escuela y a alumnos con matrícula activa.
 */
export function createTutoringRepository(db) {
  const skillByCode = db.prepare('SELECT id, code, name FROM skills WHERE code = ?');
  // Errores de cada alumno en la habilidad, en pruebas terminadas de este grupo.
  const errorCounts = db.prepare(`
    SELECT t.student_id, r.error_tag, COUNT(*) AS count
    FROM student_responses r JOIN assignment_targets t ON t.id = r.assignment_target_id
    JOIN assignments a ON a.id = t.assignment_id JOIN questions q ON q.id = r.question_id
    JOIN students s ON s.id = t.student_id
    WHERE a.group_id = ? AND s.school_id = ? AND q.skill_id = ? AND r.outcome_status = 'incorrect'
      AND t.status IN ('completed_screen', 'completed_paper')
      AND EXISTS (SELECT 1 FROM group_enrollments e
        WHERE e.group_id = a.group_id AND e.student_id = t.student_id AND e.status = 'active')
    GROUP BY t.student_id, r.error_tag`);
  // Errores que cada alumno activo del grupo mostró alguna vez en la habilidad (cualquier grado
  // de la misma escuela): sirve para saber si un tutor "superó ese mismo error".
  const pastErrors = db.prepare(`
    SELECT DISTINCT t.student_id, r.error_tag
    FROM student_responses r JOIN assignment_targets t ON t.id = r.assignment_target_id
    JOIN assignments a ON a.id = t.assignment_id JOIN groups g ON g.id = a.group_id
    JOIN questions q ON q.id = r.question_id
    WHERE g.school_id = ? AND q.skill_id = ? AND r.outcome_status = 'incorrect'
      AND t.status IN ('completed_screen', 'completed_paper')
      AND EXISTS (SELECT 1 FROM group_enrollments e
        WHERE e.group_id = ? AND e.student_id = t.student_id AND e.status = 'active')`);
  const explanations = db.prepare(`
    SELECT o.error_tag, MIN(o.error_explanation) AS explanation
    FROM question_options o JOIN questions q ON q.id = o.question_id
    WHERE q.skill_id = ? AND o.error_tag IS NOT NULL GROUP BY o.error_tag`);
  const insertSession = db.prepare(`INSERT INTO tutoring_sessions (group_id, skill_id, created_by, note)
    VALUES (?, ?, ?, ?)`);
  const insertPair = db.prepare(`INSERT INTO tutoring_pairs
    (session_id, tutor_student_id, tutee_student_id, target_error_tag, tutor_overcame_error) VALUES (?, ?, ?, ?, ?)`);
  const sessions = db.prepare(`SELECT ts.*, sk.code AS skill_code, sk.name AS skill_name
    FROM tutoring_sessions ts JOIN skills sk ON sk.id = ts.skill_id
    WHERE ts.group_id = ? ORDER BY ts.created_at DESC, ts.id DESC`);
  const session = db.prepare(`SELECT ts.*, sk.code AS skill_code, sk.name AS skill_name
    FROM tutoring_sessions ts JOIN skills sk ON sk.id = ts.skill_id WHERE ts.id = ? AND ts.group_id = ?`);
  const pairColumns = `p.*, ts.skill_id, sk.code AS skill_code, ts.created_at AS session_created_at,
      (SELECT MIN(o.error_explanation) FROM question_options o JOIN questions q ON q.id = o.question_id
        WHERE q.skill_id = ts.skill_id AND o.error_tag = p.target_error_tag) AS error_explanation`;
  // Solo parejas cuyos alumnos siguen activos en el grupo.
  const activePairs = `EXISTS (SELECT 1 FROM group_enrollments e WHERE e.group_id = ts.group_id
      AND e.student_id = p.tutee_student_id AND e.status = 'active')`;
  const pairsOfGroup = db.prepare(`SELECT ${pairColumns}
    FROM tutoring_pairs p JOIN tutoring_sessions ts ON ts.id = p.session_id JOIN skills sk ON sk.id = ts.skill_id
    WHERE ts.group_id = ? AND ${activePairs} ORDER BY p.session_id, p.id`);
  const pairInGroup = db.prepare(`SELECT ${pairColumns}
    FROM tutoring_pairs p JOIN tutoring_sessions ts ON ts.id = p.session_id JOIN skills sk ON sk.id = ts.skill_id
    WHERE p.id = ? AND ts.group_id = ? AND ${activePairs}`);
  const updateDemo = db.prepare(`UPDATE tutoring_pairs SET demo_correct = ?, demo_recorded_at = datetime('now')
    WHERE id = ?`);
  const questions = db.prepare(`SELECT q.id, q.stem, q.hint_1, q.hint_2, q.hint_3, q.difficulty
    FROM questions q WHERE q.skill_id = ? AND q.grade = ? ORDER BY q.difficulty, q.id`);
  const options = db.prepare(`SELECT o.question_id, o.label, o.text, o.is_correct, o.error_tag
    FROM question_options o JOIN questions q ON q.id = o.question_id
    WHERE q.skill_id = ? AND q.grade = ? ORDER BY o.question_id, o.label`);

  return {
    findSkillByCode: (code) => skillByCode.get(code) ?? null,
    listErrorCounts: (groupId, schoolId, skillId) => errorCounts.all(groupId, schoolId, skillId),
    listPastErrors: (groupId, schoolId, skillId) => pastErrors.all(schoolId, skillId, groupId),
    listErrorExplanations: (skillId) => explanations.all(skillId),
    createSession: ({ groupId, skillId, userId, note, rows }) => {
      const id = Number(insertSession.run(groupId, skillId, userId, note).lastInsertRowid);
      for (const row of rows) insertPair.run(id, row.tutorId, row.tuteeId, row.errorTag, row.tutorOvercameError ? 1 : 0);
      return id;
    },
    listSessions: (groupId) => sessions.all(groupId),
    findSession: (sessionId, groupId) => session.get(sessionId, groupId) ?? null,
    listPairsOfGroup: (groupId) => pairsOfGroup.all(groupId),
    findPairInGroup: (pairId, groupId) => pairInGroup.get(pairId, groupId) ?? null,
    recordDemonstration: (pairId, correct) => updateDemo.run(correct, pairId),
    listCardQuestions: (skillId, grade) => {
      const optionRows = options.all(skillId, grade);
      return questions.all(skillId, grade).map((question) => {
        const own = optionRows.filter((option) => option.question_id === question.id);
        return { ...question, options: own.map(({ label, text }) => ({ label, text })),
          correctLabel: own.find((option) => option.is_correct === 1)?.label ?? null,
          errorTags: own.map((option) => option.error_tag).filter(Boolean) };
      });
    },
  };
}
