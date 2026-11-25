/**
 * Lógica pura del ejercicio del alumno (sin React ni Vite), para poder probarla con node --test.
 */

/** Estado visible de una prueba para el alumno: 'ready' | 'paper' | 'completed' | 'closed'. */
export function assignmentState(assignment) {
  if (assignment.status === 'completed_screen') return 'completed';
  if (assignment.modality === 'paper' || assignment.isScreenLocked || assignment.status === 'completed_paper') return 'paper';
  if (assignment.assignmentStatus && assignment.assignmentStatus !== 'active') return 'closed';
  return 'ready';
}

/** Primera pregunta sin contestar a partir de `from` (da la vuelta); `-1` si todas están contestadas. */
export function nextUnanswered(questions, from = 0) {
  for (let step = 0; step < questions.length; step += 1) {
    const index = (from + step) % questions.length;
    if (!questions[index].answered) return index;
  }
  return -1;
}

/** Separa un reactivo de lectura ("Título\n\nTexto\n\nPregunta") en texto y pregunta. */
export function splitStem(stem = '') {
  const parts = stem.split('\n\n');
  return parts.length >= 3 ? { passage: parts.slice(0, -1), prompt: parts.at(-1) } : { passage: null, prompt: stem };
}
