import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignTutor, groupRows, proposalRefreshAction, rowsFromProposal, sessionBody, tutorLoad, tutorOptions } from '../src/features/tutoring/tutoring.logic.js';

const proposal = {
  pairs: [{ tutor: { id: 1 }, tutees: [{ id: 10 }, { id: 11 }] }, { tutor: { id: 2 }, tutees: [{ id: 12 }] }],
  teacherTable: [{ id: 13 }],
};

test('rowsFromProposal y groupRows conservan parejas y mesa de la maestra', () => {
  const rows = rowsFromProposal(proposal);
  assert.deepEqual(rows, [{ tuteeId: 10, tutorId: 1 }, { tuteeId: 11, tutorId: 1 }, { tuteeId: 12, tutorId: 2 }, { tuteeId: 13, tutorId: null }]);
  assert.deepEqual(groupRows(rows), { pairs: [{ tutorId: 1, tuteeIds: [10, 11] }, { tutorId: 2, tuteeIds: [12] }], teacherTable: [13] });
  assert.deepEqual(rowsFromProposal(null), []);
});

test('assignTutor respeta el tope por tutor y permite mandar a la mesa de la maestra', () => {
  const rows = rowsFromProposal(proposal);
  assert.equal(assignTutor(rows, 13, 1, 2), rows, 'tutor completo: sin cambios');
  const moved = assignTutor(rows, 13, 2, 2);
  assert.deepEqual(tutorLoad(moved).get(2), 2);
  const toTeacher = assignTutor(moved, 10, null, 2);
  assert.deepEqual(groupRows(toTeacher).teacherTable, [10]);
  assert.equal(assignTutor(rows, 10, 10, 2), rows, 'sin autopareja');
  assert.equal(assignTutor(rows, 99, 1, 2), rows, 'tutorado inexistente');
});

test('tutorOptions incluye al tutor actual y excluye completos', () => {
  const rows = rowsFromProposal(proposal);
  const tutors = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(tutorOptions(tutors, rows, 13, 2).map((t) => t.id), [2, 3]);
  assert.deepEqual(tutorOptions(tutors, rows, 10, 2).map((t) => t.id), [1, 2, 3]);
});

test('sessionBody arma el cuerpo exacto para la API', () => {
  assert.deepEqual(sessionBody('fractions', [{ tuteeId: 5, tutorId: null, extra: 1 }]), { skillCode: 'fractions', pairs: [{ tutorId: null, tuteeId: 5 }] });
});

test('aplaza actualizar la propuesta mientras haya ajustes manuales sin guardar', () => {
  assert.equal(proposalRefreshAction('progressing', 'ready_to_teach', true), 'defer');
  assert.equal(proposalRefreshAction('ready_to_teach', 'progressing', false), 'refresh');
  assert.equal(proposalRefreshAction('progressing', 'keep_practicing', false), 'none');
  assert.equal(proposalRefreshAction('ready_to_teach', 'ready_to_teach', true), 'none');
});

test('agrupa automáticamente filas intercaladas sin perder alumnos ni modificar la propuesta', () => {
  const rows = Object.freeze([
    Object.freeze({ tuteeId: 10, tutorId: 1 }),
    Object.freeze({ tuteeId: 11, tutorId: 2 }),
    Object.freeze({ tuteeId: 12, tutorId: null }),
    Object.freeze({ tuteeId: 13, tutorId: 1 }),
    Object.freeze({ tuteeId: 14, tutorId: null }),
  ]);
  const grouped = groupRows(rows);
  assert.deepEqual(grouped, {
    pairs: [{ tutorId: 1, tuteeIds: [10, 13] }, { tutorId: 2, tuteeIds: [11] }],
    teacherTable: [12, 14],
  });
  const ids = [...grouped.pairs.flatMap((pair) => pair.tuteeIds), ...grouped.teacherTable];
  assert.deepEqual(ids.sort((a, b) => a - b), rows.map((row) => row.tuteeId));
  assert.equal(new Set(ids).size, rows.length);
  assert.deepEqual(sessionBody('fractions', rows).pairs, rows);
});

test('casos borde: mover a la mesa de la maestra libera lugar y tutorOptions nunca ofrece al propio tutorado', () => {
  const rows = rowsFromProposal(proposal);
  // Tutor 1 está completo (10, 11); al mandar 11 a la mesa, 13 ya cabe con el tutor 1.
  assert.equal(assignTutor(rows, 13, 1, 2), rows);
  const freed = assignTutor(rows, 11, null, 2);
  assert.equal(tutorLoad(freed).get(1), 1);
  assert.deepEqual(groupRows(assignTutor(freed, 13, 1, 2)).pairs[0], { tutorId: 1, tuteeIds: [10, 13] });
  // Mismo tutor actual o mesa → mesa: sin cambios.
  assert.equal(assignTutor(rows, 10, 1, 2), rows);
  assert.equal(assignTutor(rows, 13, null, 2), rows);
  const tutors = [{ id: 13 }, { id: 3 }];
  assert.deepEqual(tutorOptions(tutors, rows, 13, 2).map((t) => t.id), [3]);
  assert.equal(sessionBody('fractions', freed).pairs.filter((p) => p.tutorId === 1).length, 1);
});
