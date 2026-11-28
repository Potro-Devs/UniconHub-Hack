import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { runSeed } from '../src/db/seed.js';
import { generateQuestionBank } from '../src/db/seed/questions.generator.js';
import { createRng } from '../src/db/seed/random.js';
import { renderQuizPdf } from '../src/modules/assessments/assessments.pdf.js';
import {
  describeQuestionVisual,
  parseQuestionVisual,
  serializeQuestionVisual,
} from '../src/modules/assessments/question-visual.domain.js';
import { drawQuestionVisual, questionVisualHeight } from '../src/shared/pdf/question-visual.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

describe('dominio del gráfico del reactivo', () => {
  test('acepta una barra válida (texto u objeto) y descarta lo inválido', () => {
    const bar = { type: 'fraction_bar', parts: 4, shaded: 1 };
    assert.deepEqual(parseQuestionVisual(bar), bar);
    assert.deepEqual(parseQuestionVisual(JSON.stringify(bar)), bar);
    for (const bad of [null, '', 'no-json', '{}', { type: 'pie', parts: 4, shaded: 1 }, { type: 'fraction_bar', parts: 1, shaded: 0 },
      { type: 'fraction_bar', parts: 13, shaded: 1 }, { type: 'fraction_bar', parts: 4, shaded: 5 }, { type: 'fraction_bar', parts: 4.5, shaded: 1 }]) {
      assert.equal(parseQuestionVisual(bad), null, JSON.stringify(bad));
    }
    assert.equal(serializeQuestionVisual(bar), '{"type":"fraction_bar","parts":4,"shaded":1}');
    assert.equal(serializeQuestionVisual(undefined), null);
  });

  test('descripción para lectores de pantalla (singular y plural)', () => {
    assert.equal(describeQuestionVisual({ type: 'fraction_bar', parts: 4, shaded: 1 }), 'Dibujo: un entero dividido en 4 partes iguales, con 1 parte pintada.');
    assert.equal(describeQuestionVisual({ type: 'fraction_bar', parts: 8, shaded: 3 }), 'Dibujo: un entero dividido en 8 partes iguales, con 3 partes pintadas.');
    assert.equal(describeQuestionVisual(null), null);
  });
});

describe('generador: dónde va el dibujo', () => {
  const bank = generateQuestionBank(createRng(20261123));

  test('los reactivos de 3.º "¿qué fracción está pintada?" llevan la barra que describe el enunciado', () => {
    const withVisual = bank.filter((q) => q.visual);
    assert.ok(withVisual.length > 0);
    for (const q of withVisual) {
      assert.equal(q.grade, 3);
      assert.equal(q.skill, 'fractions');
      const [, parts, shaded] = q.stem.match(/se divide en (\d+) partes iguales y se pintan? (\d+)/);
      assert.deepEqual(parseQuestionVisual(q.visual), { type: 'fraction_bar', parts: Number(parts), shaded: Number(shaded) }, q.stem);
      // La respuesta correcta coincide con lo pintado (el dibujo no contradice la clave).
      assert.equal(q.correct, `${shaded}/${parts}`);
    }
  });

  test('ningún otro tipo de reactivo lleva dibujo (podría delatar la respuesta)', () => {
    const others = bank.filter((q) => !(q.grade === 3 && q.skill === 'fractions'));
    assert.ok(others.every((q) => !q.visual));
  });
});

describe('PDF: dibuja la tira en blanco y negro', () => {
  test('una celda por parte y el contorno del entero', () => {
    const calls = [];
    const doc = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return doc; } });
    const h = drawQuestionVisual(doc, { type: 'fraction_bar', parts: 4, shaded: 1 }, 0, 0, 200);
    assert.equal(h, questionVisualHeight({ type: 'fraction_bar', parts: 4, shaded: 1 }));
    // 4 celdas + 1 recorte de la celda pintada + 1 contorno = 6 rectángulos.
    assert.equal(calls.filter(([n]) => n === 'rect').length, 6);
    assert.equal(drawQuestionVisual(doc, null, 0, 0, 200), 0);
  });

  test('la hoja con gráfico se genera (y ocupa más que sin gráfico)', async () => {
    const base = { title: 'Fracciones', grade: 3, skill: { name: 'Fracciones' } };
    const question = { position: 1, prompt: 'Una cuerda se divide en 4 partes iguales y se pinta 1. ¿Qué fracción está pintada?', questionType: 'multiple_choice', options: [{ label: 'A', text: '1/4' }] };
    const plain = await renderQuizPdf({ ...base, questions: [question] });
    const drawn = await renderQuizPdf({ ...base, questions: [{ ...question, visual: { type: 'fraction_bar', parts: 4, shaded: 1 } }] });
    assert.equal(drawn.subarray(0, 5).toString(), '%PDF-');
    assert.ok(drawn.length > plain.length, 'el PDF con gráfico tiene trazos extra');
  });
});

describe('el gráfico llega al alumno y al personal (seed demo)', () => {
  let server;
  let db;
  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    server = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });
  after(() => server.close());

  test('GET /assessments/questions incluye `visual` en las de 3.º de fracciones', async () => {
    const teacher = db.prepare("SELECT id, school_id FROM users WHERE role = 'teacher' ORDER BY id LIMIT 1").get();
    const token = tokenFor({ sub: String(teacher.id), role: 'teacher', schoolId: teacher.school_id });
    const res = await server.call('GET', '/api/v1/assessments/questions?grade=3&skill=fractions', { token });
    assert.equal(res.status, 200);
    const visuals = res.body.data.filter((q) => q.visual);
    assert.ok(visuals.length > 0);
    assert.equal(visuals[0].visual.type, 'fraction_bar');
    const other = await server.call('GET', '/api/v1/assessments/questions?grade=3&skill=multiplication', { token });
    assert.ok(other.body.data.every((q) => q.visual === null));
  });

  test('al iniciar una prueba, el alumno recibe el gráfico del reactivo', async () => {
    // Una prueba de pantalla de 3.º fracciones con reactivos que llevan barra.
    const group = db.prepare("SELECT g.id, g.teacher_id, g.school_id FROM groups g WHERE g.join_code = 'MAPA3A'").get();
    const qs = db.prepare("SELECT q.id FROM questions q JOIN skills s ON s.id = q.skill_id WHERE s.code = 'fractions' AND q.grade = 3 AND q.visual IS NOT NULL ORDER BY q.id LIMIT 3").all();
    const teacherToken = tokenFor({ sub: String(group.teacher_id), role: 'teacher', schoolId: group.school_id });
    const student = db.prepare("SELECT s.id FROM students s JOIN group_enrollments e ON e.student_id = s.id WHERE e.group_id = ? AND e.status = 'active' ORDER BY s.id LIMIT 1").get(group.id);
    const created = await server.call('POST', `/api/v1/assessments/groups/${group.id}/assignments`, {
      token: teacherToken, body: { title: 'Barras', modality: 'screen', questionIds: qs.map((q) => q.id), studentIds: [student.id] },
    });
    assert.equal(created.status, 201);
    const studentToken = tokenFor({ sub: String(student.id), role: 'student', schoolId: group.school_id, groupId: group.id });
    const start = await server.call('GET', `/api/v1/diagnostics/assignments/${created.body.data.id}/start`, { token: studentToken });
    assert.equal(start.status, 200);
    for (const q of start.body.data.questions) {
      assert.equal(q.visual.type, 'fraction_bar');
      assert.ok(q.visual.parts >= 2);
    }
    // El gráfico no incluye nada que delate la clave más allá del propio dibujo.
    assert.ok(!JSON.stringify(start.body.data).includes('isCorrect'));
  });
});
