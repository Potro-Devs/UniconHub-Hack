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

function recountReview(uncertainQuestions, supportUncertain) {
  return Object.keys(uncertainQuestions).length + (supportUncertain ? 1 : 0);
}

/**
 * Convierte el resultado del escáner OMR en un borrador seguro de Captura rápida y su resumen de revisión.
 * Solo conserva reactivos y opciones reales de la asignación; nunca guarda en el servidor.
 */
export function applyOmrScanToDraft(questions, scanResult, studentLabel = '') {
  const answers = {};
  const uncertainQuestions = {};
  let answeredCount = 0;

  for (const question of questions) {
    const validOptionIds = new Set((question.options ?? []).map((option) => option.id));
    const rawOptionId = scanResult?.answers?.[question.id] ?? null;
    const optionId = rawOptionId != null && validOptionIds.has(rawOptionId) ? rawOptionId : null;
    answers[question.id] = optionId;
    if (optionId != null) answeredCount += 1;
    const doubt = scanResult?.uncertainQuestions?.[question.id];
    if (doubt) uncertainQuestions[question.id] = doubt;
  }

  const supportUsed = Boolean(scanResult?.supportUsed);
  const supportUncertain = Boolean(scanResult?.supportUncertain);
  const uncertainCount = recountReview(uncertainQuestions, supportUncertain);
  const totalCount = questions.length;
  const label = typeof studentLabel === 'string' ? studentLabel.trim() : '';
  const summary = uncertainCount > 0
    ? label
      ? `Hoja leída: ${answeredCount} de ${totalCount} respuestas. Revisa ${uncertainCount} marca(s) dudosa(s) y verifica que la hoja sea de ${label} antes de guardar.`
      : `Hoja leída: ${answeredCount} de ${totalCount} respuestas. Revisa ${uncertainCount} marca(s) dudosa(s) y confirma antes de guardar.`
    : label
      ? `Hoja leída: ${answeredCount} de ${totalCount} respuestas. Verifica que la hoja sea de ${label} y guarda la hoja.`
      : `Hoja leída: ${answeredCount} de ${totalCount} respuestas. Verifica los datos y guarda la hoja.`;

  return {
    draft: { answers, supportUsed },
    review: {
      uncertainQuestions,
      supportUncertain,
      answeredCount,
      totalCount,
      uncertainCount,
      summary,
    },
  };
}

export function clearReviewQuestion(review, questionId) {
  if (!review?.uncertainQuestions?.[questionId]) return review;
  const nextUncertain = { ...review.uncertainQuestions };
  delete nextUncertain[questionId];
  return {
    ...review,
    uncertainQuestions: nextUncertain,
    uncertainCount: recountReview(nextUncertain, review.supportUncertain),
  };
}

export function clearReviewSupport(review) {
  if (!review?.supportUncertain) return review;
  return {
    ...review,
    supportUncertain: false,
    uncertainCount: recountReview(review.uncertainQuestions ?? {}, false),
  };
}
