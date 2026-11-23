import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  MAX_NOTES_LENGTH,
  computeCoverageBySkill,
  mergeCurriculumProgress,
  parseCurriculumPatch,
  toCurriculumContentDto,
} from '../../src/modules/curriculum/curriculum.domain.js';

const isValidation = (err) => err.code === 'VALIDATION_ERROR';

describe('curriculum: parseCurriculumPatch', () => {
  test('acepta status válido, notes y ambos', () => {
    assert.deepEqual(parseCurriculumPatch({ status: 'seen' }), { status: 'seen' });
    assert.deepEqual(parseCurriculumPatch({ notes: '  Repasar con material concreto  ' }), {
      notes: 'Repasar con material concreto',
    });
    assert.deepEqual(parseCurriculumPatch({ status: 'in_progress', notes: 'Ok' }), { status: 'in_progress', notes: 'Ok' });
  });

  test('notes null o vacío borra la nota', () => {
    assert.deepEqual(parseCurriculumPatch({ notes: null }), { notes: null });
    assert.deepEqual(parseCurriculumPatch({ notes: '   ' }), { notes: null });
  });

  test('rechaza status inválido o de otro tipo', () => {
    for (const status of ['visto', 'SEEN', '', 1, null, ['seen'], { s: 'seen' }]) {
      assert.throws(() => parseCurriculumPatch({ status }), isValidation, `status ${JSON.stringify(status)}`);
    }
  });

  test('rechaza notes de tipo inesperado o demasiado largo', () => {
    for (const notes of [[], {}, 42, true]) {
      assert.throws(() => parseCurriculumPatch({ notes }), isValidation, `notes ${JSON.stringify(notes)}`);
    }
    assert.doesNotThrow(() => parseCurriculumPatch({ notes: 'a'.repeat(MAX_NOTES_LENGTH) }));
    assert.throws(() => parseCurriculumPatch({ notes: 'a'.repeat(MAX_NOTES_LENGTH + 1) }), isValidation);
  });

  test('rechaza cuerpo vacío, sin campos conocidos o que no es objeto', () => {
    for (const body of [{}, { otro: 1 }, null, undefined, [], 'seen']) {
      assert.throws(() => parseCurriculumPatch(body), isValidation, `body ${JSON.stringify(body)}`);
    }
  });
});

describe('curriculum: mergeCurriculumProgress', () => {
  test('sin registro: pending y sin notas por defecto', () => {
    assert.deepEqual(mergeCurriculumProgress(null, { notes: 'x' }), { status: 'pending', notes: 'x' });
    assert.deepEqual(mergeCurriculumProgress({ status: null, notes: null }, { status: 'seen' }), { status: 'seen', notes: null });
  });

  test('conserva lo ausente y borra notas con null', () => {
    const current = { status: 'in_progress', notes: 'previa' };
    assert.deepEqual(mergeCurriculumProgress(current, { status: 'seen' }), { status: 'seen', notes: 'previa' });
    assert.deepEqual(mergeCurriculumProgress(current, { notes: null }), { status: 'in_progress', notes: null });
  });
});

describe('curriculum: toCurriculumContentDto', () => {
  const base = {
    id: 7, phase: 4, grade: 3, formative_field: 'lenguajes', title: 'T', pda: 'P', sort_order: 2,
    skill_code: 'reading_comprehension', skill_name: 'Comprensión lectora',
  };

  test('sin avance → pending, notas y fecha null', () => {
    assert.deepEqual(toCurriculumContentDto({ ...base, status: null, notes: null, updated_at: null }), {
      id: 7, title: 'T', pda: 'P', formativeField: 'lenguajes', formativeFieldName: 'Lenguajes', phase: 4, grade: 3,
      sortOrder: 2, skill: { code: 'reading_comprehension', name: 'Comprensión lectora' },
      status: 'pending', notes: null, updatedAt: null,
    });
  });

  test('contenido sin habilidad → skill null', () => {
    const dto = toCurriculumContentDto({ ...base, skill_code: null, skill_name: null, status: 'seen', notes: 'n', updated_at: '2026-11-20 10:00:00' });
    assert.equal(dto.skill, null);
    assert.equal(dto.status, 'seen');
    assert.equal(dto.updatedAt, '2026-11-20 10:00:00');
  });
});

describe('curriculum: computeCoverageBySkill', () => {
  test('agrupa por habilidad e ignora contenidos sin habilidad', () => {
    const fr = { code: 'fractions', name: 'Fracciones' };
    const pv = { code: 'place_value', name: 'Valor posicional' };
    const result = computeCoverageBySkill([
      { skill: fr, status: 'seen' },
      { skill: fr, status: 'pending' },
      { skill: pv, status: 'in_progress' },
      { skill: null, status: 'seen' },
    ]);
    assert.deepEqual(result, [
      { code: 'fractions', name: 'Fracciones', total: 2, pending: 1, in_progress: 0, seen: 1, coveragePercentage: 50 },
      { code: 'place_value', name: 'Valor posicional', total: 1, pending: 0, in_progress: 1, seen: 0, coveragePercentage: 0 },
    ]);
    assert.deepEqual(computeCoverageBySkill([]), []);
  });
});
