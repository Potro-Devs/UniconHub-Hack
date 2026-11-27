import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickFirstName } from '../src/features/student-portal/studentPortalStats.js';

test('saludo usa solo el primer nombre de la sesión, conservando acentos', () => {
  assert.equal(pickFirstName('  María Fernanda R. '), 'María');
  assert.equal(pickFirstName('José\tÁngel G.'), 'José');
  assert.equal(pickFirstName('Luz'), 'Luz');
});

test('saludo sin nombre usa el texto alternativo solicitado', () => {
  for (const value of [null, undefined, '', '   ']) {
    assert.equal(pickFirstName(value, 'Estudiante'), 'Estudiante');
  }
});
