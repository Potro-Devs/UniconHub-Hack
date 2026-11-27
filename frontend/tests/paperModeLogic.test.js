import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  currentPaperTarget, isPaperAssignmentForGroup, paperCaptureBody,
  paperCaptureError, pendingPaperTargets, studentName, unansweredPaperCount,
} from '../src/features/paper-mode/paper-mode.logic.js';

const targets = [
  { studentId: 10, status: 'completed_paper' },
  { studentId: 11, status: 'pending' },
  { studentId: 12, status: 'pending' },
];
const questions = [{ id: 71, options: [{ id: 901, label: 'A' }, { id: 904, label: 'B' }] }, { id: 85, options: [{ id: 1201, label: 'A' }] }];

test('papel exige modalidad y pertenencia al grupo activo, incluidos IDs de ruta', () => {
  assert.equal(isPaperAssignmentForGroup({ modality: 'paper', groupId: 3 }, '3'), true);
  assert.equal(isPaperAssignmentForGroup({ modality: 'paper', groupId: 4 }, 3), false);
  assert.equal(isPaperAssignmentForGroup({ modality: 'screen', groupId: 3 }, 3), false);
  assert.equal(isPaperAssignmentForGroup(null, 3), false);
});

test('captura salta hojas ya capturadas y ausentes omitidos durante esta ronda', () => {
  assert.deepEqual(pendingPaperTargets(targets).map((t) => t.studentId), [11, 12]);
  assert.deepEqual(pendingPaperTargets(targets, [11]).map((t) => t.studentId), [12]);
  assert.equal(currentPaperTarget(targets, [], 12).studentId, 12);
  assert.equal(currentPaperTarget(targets, [], 10).studentId, 11);
  assert.equal(currentPaperTarget(targets, [11], 11).studentId, 12);
  assert.equal(currentPaperTarget(targets, [11, 12], 12), null);
  assert.equal(currentPaperTarget([], [], null), null);
  assert.deepEqual(targets.map((t) => t.status), ['completed_paper', 'pending', 'pending']);
});

test('una segunda ronda vuelve a incluir Faltó mientras el servidor lo conserve pendiente', () => {
  assert.equal(currentPaperTarget(targets, [11], null).studentId, 12);
  assert.equal(currentPaperTarget(targets, [], null).studentId, 11);
});

test('payload usa IDs reales, una respuesta por reactivo, null sin responder y apoyo general', () => {
  const draft = { answers: { 71: 904, 999: 777 }, supportUsed: true };
  const body = paperCaptureBody(questions, draft);
  assert.deepEqual(body, { answers: { 71: 904, 85: null }, supportUsed: true });
  assert.equal(unansweredPaperCount(questions, draft), 1);
  assert.equal(unansweredPaperCount(questions, { answers: { 71: null } }), 2);
  assert.equal(unansweredPaperCount(questions, { answers: { 71: 901, 85: 1201 } }), 0);
  assert.deepEqual(paperCaptureBody(questions), { answers: { 71: null, 85: null }, supportUsed: false });
  assert.deepEqual(draft, { answers: { 71: 904, 999: 777 }, supportUsed: true });
});

test('Faltó envía únicamente absent, sin filtrar respuestas previas de otro alumno', () => {
  assert.deepEqual(paperCaptureBody(questions, { answers: { 71: 904 }, supportUsed: true }, true), { absent: true });
  const first = paperCaptureBody(questions, { answers: { 71: 904 }, supportUsed: true });
  const second = paperCaptureBody(questions, { answers: { 85: 1201 } });
  second.answers[71] = 901;
  assert.deepEqual(first, { answers: { 71: 904, 85: null }, supportUsed: true });
  assert.equal(second.supportUsed, false);
});

test('recaptura y errores se presentan sin códigos técnicos', () => {
  assert.match(paperCaptureError({ code: 'ALREADY_CAPTURED', status: 409 }), /ya estaba capturada.*siguiente/);
  assert.match(paperCaptureError({ status: 400, message: 'SQL detalle interno' }), /Revisa las opciones/);
  assert.match(paperCaptureError({ code: 'ASSIGNMENT_CLOSED' }), /cerrada/);
  assert.match(paperCaptureError(null), /conexión/);
});

test('nombres se cruzan por alumno real y existe fallback para una tarjeta ausente', () => {
  assert.equal(studentName({ fullName: 'Ana Pérez' }, 11), 'Ana Pérez');
  assert.equal(studentName({ firstNames: 'José Luis', lastNames: 'López' }, 12), 'José Luis López');
  assert.equal(studentName(undefined, 13), 'Alumno 13');
});
