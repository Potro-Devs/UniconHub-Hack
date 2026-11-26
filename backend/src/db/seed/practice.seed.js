/**
 * Práctica abierta en pantalla para 3.º A: permite recorrer de punta a punta el ciclo con datos
 * reales (el alumno contesta → se registra el corte de dominio → el mapa del docente cambia).
 * Idempotente: si la práctica ya existe, no hace nada. No usa números aleatorios, así que no altera
 * el resto del seed.
 */
import { DEMO } from './demo.data.js';

export const PRACTICE = Object.freeze({ title: 'Práctica · Multiplicación', skillCode: 'multiplication', grade: 3 });

/** Crea la práctica si falta. Devuelve `true` si la creó. Llamar dentro de una transacción. */
export function insertOpenPractice(db) {
  const group = db.prepare('SELECT id, teacher_id FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode);
  if (!group) return false;
  if (db.prepare('SELECT 1 FROM assignments WHERE group_id = ? AND title = ?').get(group.id, PRACTICE.title)) return false;
  const questions = db.prepare(`SELECT q.id FROM questions q JOIN skills s ON s.id = q.skill_id
    WHERE s.code = ? AND q.grade = ? ORDER BY q.id`).all(PRACTICE.skillCode, PRACTICE.grade);
  if (questions.length < 3) return false;

  const assignmentId = Number(db.prepare(
    "INSERT INTO assignments (group_id, created_by, title, modality, status, created_at) VALUES (?, ?, ?, 'screen', 'active', ?)",
  ).run(group.id, group.teacher_id, PRACTICE.title, '2026-11-23 08:00:00').lastInsertRowid);
  const addQuestion = db.prepare('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)');
  questions.forEach((q, idx) => addQuestion.run(assignmentId, q.id, idx + 1));

  const students = db.prepare("SELECT student_id FROM group_enrollments WHERE group_id = ? AND status = 'active' ORDER BY student_id")
    .all(group.id);
  const addTarget = db.prepare("INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked) VALUES (?, ?, 'pending', 0)");
  for (const s of students) addTarget.run(assignmentId, s.student_id);
  return true;
}
