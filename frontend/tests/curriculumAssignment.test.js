import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assignmentErrorMessage, assignmentFieldError, assignmentFormErrors,
  assignmentLink, assignmentPayload, skillsOfContents, toggleSelection,
} from '../src/features/curriculum/curriculum.logic.js';

const form = { title: '  Repaso del grupo  ', modality: 'screen', skills: ['fractions'], recipients: 'all', studentIds: [10] };

test('temario: habilidades únicas de contenidos reales y selección reversible sin mutar', () => {
  const fractions = { code: 'fractions', name: 'Fracciones' };
  const reading = { code: 'reading_comprehension', name: 'Comprensión lectora' };
  assert.deepEqual(skillsOfContents([{ skill: fractions }, { skill: null }, { skill: reading }, { skill: fractions }]), [fractions, reading]);
  const selected = ['fractions'];
  assert.deepEqual(toggleSelection(selected, 'reading_comprehension'), ['fractions', 'reading_comprehension']);
  assert.deepEqual(toggleSelection(selected, 'fractions'), []);
  assert.deepEqual(selected, ['fractions']);
});

test('asignación: payload de todo el grupo omite studentIds y selección específica deduplica', () => {
  assert.deepEqual(assignmentPayload({ ...form, skills: ['fractions', 'fractions'] }), {
    title: 'Repaso del grupo', modality: 'screen', skills: ['fractions'],
  });
  assert.deepEqual(assignmentPayload({ ...form, modality: 'paper', recipients: 'selected', studentIds: [10, 12, 10] }), {
    title: 'Repaso del grupo', modality: 'paper', skills: ['fractions'], studentIds: [10, 12],
  });
  assert.equal(form.title, '  Repaso del grupo  ');
});

test('asignación: formulario exige título, habilidad, modalidad y destinatarios específicos', () => {
  assert.deepEqual(assignmentFormErrors(form), {});
  assert.deepEqual(Object.keys(assignmentFormErrors({ ...form, title: ' ', skills: [], modality: 'digital', recipients: 'selected', studentIds: [] })).sort(),
    ['modality', 'skills', 'studentIds', 'title']);
  assert.ok(assignmentFormErrors({ ...form, title: 'a'.repeat(121) }).title);
  assert.deepEqual(assignmentFormErrors({ ...form, title: 'a'.repeat(120), studentIds: [] }), {});
});

test('asignación: insuficiencia del servidor se explica por habilidad y conserva errores de campo', () => {
  const error = { code: 'INSUFFICIENT_QUESTIONS_PER_SKILL', details: { insufficient: [{ skill: 'fractions', count: 1, missing: 2 }] } };
  assert.equal(assignmentErrorMessage(error), 'Fracciones necesita al menos 3 reactivos y hay 1.');
  assert.equal(assignmentErrorMessage(error, [{ code: 'fractions', name: 'Fracciones del grado' }]), 'Fracciones del grado necesita al menos 3 reactivos y hay 1.');
  assert.match(assignmentErrorMessage({ code: 'NO_ACTIVE_STUDENTS' }), /Agrega alumnos/);
  assert.equal(assignmentErrorMessage({ message: 'Revisa el título.' }), 'Revisa el título.');
  assert.match(assignmentErrorMessage(null), /conexión/);
  for (const field of ['title', 'skills', 'studentIds', 'modality']) assert.equal(assignmentFieldError({ details: { field } }), field);
  assert.equal(assignmentFieldError({ details: { field: 'sql' } }), null);
  assert.equal(assignmentFieldError(null), null);
});

test('contenido e intervención abren el mismo panel con habilidad preseleccionada', () => {
  const url = new URL(assignmentLink('reading_comprehension'), 'http://localhost');
  assert.equal(url.pathname, '/docente/temario');
  assert.equal(url.searchParams.get('assign'), '1');
  assert.equal(url.searchParams.get('skill'), 'reading_comprehension');
});
