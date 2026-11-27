/** Presentación y navegación de hojas; la clasificación y el dominio pertenecen al servidor. */
export function isPaperAssignmentForGroup(assignment, groupId) {
  return assignment?.modality === 'paper' && Number(assignment.groupId) === Number(groupId);
}

export function pendingPaperTargets(targets, skippedIds = []) {
  const skipped = new Set(skippedIds);
  return targets.filter((target) => target.status !== 'completed_paper' && !skipped.has(target.studentId));
}

export function currentPaperTarget(targets, skippedIds, preferredId) {
  const pending = pendingPaperTargets(targets, skippedIds);
  return pending.find((target) => target.studentId === preferredId) ?? pending[0] ?? null;
}

export function paperCaptureBody(questions, draft = {}, absent = false) {
  if (absent) return { absent: true };
  return {
    answers: Object.fromEntries(questions.map((question) => [question.id, draft.answers?.[question.id] ?? null])),
    supportUsed: draft.supportUsed === true,
  };
}

export function unansweredPaperCount(questions, draft = {}) {
  return questions.filter((question) => draft.answers?.[question.id] == null).length;
}

export function studentName(student, studentId) {
  return student?.fullName || [student?.firstNames, student?.lastNames].filter(Boolean).join(' ') || `Alumno ${studentId}`;
}

export function paperCaptureError(error) {
  if (error?.code === 'ALREADY_CAPTURED') return 'Esta hoja ya estaba capturada. Continuamos con la siguiente.';
  if (error?.status === 400) return 'Revisa las opciones de la hoja y vuelve a guardar.';
  if (error?.code === 'ASSIGNMENT_CLOSED') return 'Esta prueba está cerrada y ya no permite capturar hojas.';
  return error?.message || 'No pudimos guardar esta hoja. Revisa tu conexión y vuelve a intentar.';
}
