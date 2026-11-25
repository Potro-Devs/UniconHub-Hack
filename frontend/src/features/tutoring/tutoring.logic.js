/**
 * Edición local de la propuesta de parejas antes de guardarla. Sin dependencias de React
 * para poder probarla con `node --test`. Las reglas definitivas las valida el servidor.
 */

/** Filas planas `{ tuteeId, tutorId | null }` a partir de la propuesta del servidor. */
export function rowsFromProposal(proposal) {
  if (!proposal) return [];
  return [
    ...proposal.pairs.flatMap((pair) => pair.tutees.map((tutee) => ({ tuteeId: tutee.id, tutorId: pair.tutor.id }))),
    ...proposal.teacherTable.map((tutee) => ({ tuteeId: tutee.id, tutorId: null })),
  ];
}

export function tutorLoad(rows) {
  const load = new Map();
  for (const row of rows) if (row.tutorId !== null) load.set(row.tutorId, (load.get(row.tutorId) ?? 0) + 1);
  return load;
}

/** Agrupa por tutor conservando el orden de aparición; `null` = mesa de la maestra. */
export function groupRows(rows) {
  const pairs = [];
  const index = new Map();
  const teacherTable = [];
  for (const row of rows) {
    if (row.tutorId === null) { teacherTable.push(row.tuteeId); continue; }
    if (!index.has(row.tutorId)) { index.set(row.tutorId, pairs.length); pairs.push({ tutorId: row.tutorId, tuteeIds: [] }); }
    pairs[index.get(row.tutorId)].tuteeIds.push(row.tuteeId);
  }
  return { pairs, teacherTable };
}

/** Cambia el tutor de un tutorado. Si el tutor elegido ya está completo, no cambia nada. */
export function assignTutor(rows, tuteeId, tutorId, maxPerTutor) {
  if (tutorId !== null && tutorId === tuteeId) return rows;
  const current = rows.find((row) => row.tuteeId === tuteeId);
  if (!current || current.tutorId === tutorId) return rows;
  if (tutorId !== null && (tutorLoad(rows).get(tutorId) ?? 0) >= maxPerTutor) return rows;
  return rows.map((row) => row.tuteeId === tuteeId ? { ...row, tutorId } : row);
}

/** Tutores que pueden recibir a este tutorado: con lugar libre o su tutor actual. */
export function tutorOptions(tutors, rows, tuteeId, maxPerTutor) {
  const load = tutorLoad(rows);
  const current = rows.find((row) => row.tuteeId === tuteeId)?.tutorId ?? null;
  return tutors.filter((tutor) => tutor.id !== tuteeId
    && (tutor.id === current || (load.get(tutor.id) ?? 0) < maxPerTutor));
}

/** Cuerpo para `POST /tutoring/groups/:groupId/sessions`. */
export function sessionBody(skillCode, rows) {
  return { skillCode, pairs: rows.map(({ tutorId, tuteeId }) => ({ tutorId, tuteeId })) };
}
