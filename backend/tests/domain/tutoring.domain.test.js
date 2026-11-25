import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildCardScript, buildPairingProposal, chooseCardQuestions, classifyDemonstration, latestDemonstrations,
  parseDemonstrationInput, parseSessionInput, pickTuteeErrorTag, summarizeNetwork, validatePairs } from '../../src/modules/tutoring/tutoring.domain.js';

const s = (id, masteryPercentage, level) => ({ id, masteryPercentage, level });

describe('tutoring domain', () => {
  test('solo Dominado puede enseñar; Logrado no es tutor ni tutorado', () => {
    const proposal = buildPairingProposal({ students: [s(1, 80, 'mastered'), s(2, 60, 'achieved'), s(3, 30, 'in_progress')] });
    assert.deepEqual(proposal.tutorIds, [1]);
    assert.deepEqual(proposal.pairs, [{ tutorId: 1, tutees: [{ id: 3, errorTag: null, tutorOvercameError: false, sharedLanguage: null }] }]);
    assert.deepEqual(proposal.teacherTable, []);
  });

  test('reparte primero uno por tutor, luego hasta 2, y el resto va a la mesa de la maestra', () => {
    const students = [s(1, 90, 'mastered'), s(2, 80, 'mastered'),
      s(10, 45, 'in_progress'), s(11, 40, 'in_progress'), s(12, 30, 'in_progress'), s(13, 20, 'needs_support'), s(14, 5, 'needs_support')];
    const { pairs, teacherTable } = buildPairingProposal({ students });
    assert.deepEqual(pairs.map((p) => [p.tutorId, p.tutees.map((t) => t.id)]), [[1, [10, 12]], [2, [11, 13]]]);
    // Quien más apoyo necesita queda con la maestra.
    assert.deepEqual(teacherTable.map((t) => t.id), [14]);
  });

  test('prefiere al tutor que tuvo el mismo error y lo superó', () => {
    const { pairs } = buildPairingProposal({
      students: [s(1, 95, 'mastered'), s(2, 80, 'mastered'), s(10, 40, 'in_progress')],
      errorsByStudent: new Map([[10, [{ errorTag: 'add_across', count: 2 }, { errorTag: 'other', count: 1 }]]]),
      overcomeByStudent: new Map([[2, new Set(['add_across'])]]),
    });
    assert.deepEqual(pairs, [{ tutorId: 2, tutees: [{ id: 10, errorTag: 'add_across', tutorOvercameError: true, sharedLanguage: null }] }]);
  });

  test('quien demostró 3/3 ya puede enseñar aunque su dominio oficial no cambie', () => {
    const proposal = buildPairingProposal({ students: [s(5, 40, 'in_progress'), s(6, 20, 'needs_support')], readyToTeachIds: new Set([5]) });
    assert.deepEqual(proposal.pairs.map((p) => [p.tutorId, p.tutees.map((t) => t.id)]), [[5, [6]]]);
  });

  test('sin tutores todos quedan con la maestra; sin evidencia no se clasifica', () => {
    const proposal = buildPairingProposal({ students: [s(1, null, null), s(2, 10, 'needs_support')] });
    assert.deepEqual(proposal.pairs, []);
    assert.deepEqual(proposal.teacherTable.map((t) => t.id), [2]);
  });

  test('pickTuteeErrorTag usa el más frecuente con desempate estable', () => {
    assert.equal(pickTuteeErrorTag([{ errorTag: 'b', count: 2 }, { errorTag: 'a', count: 2 }, { errorTag: 'c', count: 1 }]), 'a');
    assert.equal(pickTuteeErrorTag([]), null);
    assert.equal(pickTuteeErrorTag(undefined), null);
  });

  test('validatePairs rechaza autopareja, duplicados, tutor-tutorado y más de 2 por tutor', () => {
    assert.throws(() => validatePairs([{ tutorId: 1, tuteeId: 1 }]), /propio tutor/);
    assert.throws(() => validatePairs([{ tutorId: 1, tuteeId: 2 }, { tutorId: null, tuteeId: 2 }]), /una sola vez/);
    assert.throws(() => validatePairs([{ tutorId: 1, tuteeId: 2 }, { tutorId: 3, tuteeId: 1 }]), /tutor y tutorado/);
    assert.throws(() => validatePairs([{ tutorId: 1, tuteeId: 2 }, { tutorId: 1, tuteeId: 3 }, { tutorId: 1, tuteeId: 4 }]), /máximo a 2/);
    assert.equal(validatePairs([{ tutorId: 1, tuteeId: 2 }, { tutorId: 1, tuteeId: 3 }, { tutorId: null, tuteeId: 4 }]), true);
  });

  test('parseSessionInput valida cuerpo exacto', () => {
    const ok = parseSessionInput({ skillCode: 'fractions', note: '  ', pairs: [{ tutorId: null, tuteeId: 3 }] }, ['fractions']);
    assert.deepEqual(ok, { skillCode: 'fractions', note: null, pairs: [{ tutorId: null, tuteeId: 3 }] });
    for (const bad of [null, [], { skillCode: 'x', pairs: [{ tutorId: 1, tuteeId: 2 }] },
      { skillCode: 'fractions', pairs: [] }, { skillCode: 'fractions', pairs: [{ tutorId: '1', tuteeId: 2 }] },
      { skillCode: 'fractions', pairs: [{ tutorId: 1, tuteeId: 2, extra: 1 }] }, { skillCode: 'fractions', pairs: [{ tutorId: 1, tuteeId: 2 }], other: 1 },
      { skillCode: 'fractions', note: 'x'.repeat(301), pairs: [{ tutorId: 1, tuteeId: 2 }] }]) {
      assert.throws(() => parseSessionInput(bad, ['fractions']), { code: 'VALIDATION_ERROR' });
    }
  });

  test('demostración: entero de 0 a 3 y clasificación no punitiva', () => {
    assert.deepEqual(parseDemonstrationInput({ correct: 0 }), { correct: 0 });
    for (const bad of [{}, { correct: 4 }, { correct: -1 }, { correct: 1.5 }, { correct: '3' }, { correct: 3, x: 1 }, null]) {
      assert.throws(() => parseDemonstrationInput(bad), { code: 'VALIDATION_ERROR' });
    }
    assert.equal(classifyDemonstration(3).code, 'ready_to_teach');
    assert.equal(classifyDemonstration(2).code, 'progressing');
    assert.equal(classifyDemonstration(0).label, 'Seguimos practicando juntos');
    assert.equal(classifyDemonstration(null), null);
  });

  test('tarjeta: práctica con el error del tutorado, demostración distinta, guion sin respuesta', () => {
    const qs = [{ id: 1, errorTags: ['x'] }, { id: 2, errorTags: ['y'] }, { id: 3, errorTags: [] }, { id: 4, errorTags: [] }, { id: 5, errorTags: [] }];
    const { practice, demonstration } = chooseCardQuestions(qs, 'y');
    assert.equal(practice.id, 2);
    assert.deepEqual(demonstration.map((q) => q.id), [1, 3, 4]);
    const script = buildCardScript({ stem: 'S', hint_1: 'a', hint_2: 'b', hint_3: 'c', correctLabel: 'A', options: [] });
    assert.deepEqual(script.steps.map((step) => step.text), ['a', 'b', 'c']);
    assert.equal(JSON.stringify(script).includes('correct'), false);
    assert.equal(buildCardScript(null), null);
  });

  test('con 3 reactivos la demostración sigue siendo de 3 reutilizando la práctica', () => {
    const qs = [{ id: 1, errorTags: [] }, { id: 2, errorTags: ['y'] }, { id: 3, errorTags: [] }];
    const { practice, demonstration } = chooseCardQuestions(qs, 'y');
    assert.equal(practice.id, 2);
    assert.deepEqual(demonstration.map((q) => q.id), [1, 3, 2]);
    assert.deepEqual(chooseCardQuestions([], 'y'), { practice: null, demonstration: [] });
  });

  test('latestDemonstrations y summarizeNetwork cuentan la última demostración por alumno', () => {
    const rows = [
      { id: 1, skill_code: 'm', target_error_tag: 'e', tutor_student_id: 9, tutee_student_id: 1, demo_correct: 1, demo_recorded_at: '2026-01-01' },
      { id: 2, skill_code: 'm', target_error_tag: 'e', tutor_student_id: 9, tutee_student_id: 1, demo_correct: 3, demo_recorded_at: '2026-01-02' },
      { id: 3, skill_code: 'm', target_error_tag: 'e', tutor_student_id: null, tutee_student_id: 2, demo_correct: 2, demo_recorded_at: '2026-01-02' },
      { id: 4, skill_code: 'm', target_error_tag: 'e', tutor_student_id: 1, tutee_student_id: 3, demo_correct: null, demo_recorded_at: null },
    ];
    assert.equal(latestDemonstrations(rows).get(1).demo_correct, 3);
    const network = summarizeNetwork({
      skills: [{ code: 'm', name: 'M' }],
      students: [1, 2, 3, 9].map((id) => ({ id, skills: [{ code: 'm', level: id === 9 ? 'mastered' : 'in_progress' }] })),
      readyBySkill: new Map([['m', new Set([1])]]), pairRows: rows });
    assert.equal(network.teachSomethingCount, 2);
    assert.deepEqual(network.skills, [{ code: 'm', name: 'M', canTeachCount: 2 }]);
    assert.deepEqual(network.errors[0], { skillCode: 'm', errorTag: 'e', explanation: null, tutoredCount: 3,
      demonstratedCount: 2, readyToTeachCount: 1, progressingCount: 1, peerTutoredCount: 2 });
    assert.equal(network.tutorsWhoWereTuteesCount, 1);
  });
});
