import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * Texto visible de un PDF de PDFKit: descomprime cada stream y decodifica las cadenas hex de
 * los operadores de texto. Se quitan los espacios porque PDFKit parte las palabras con ajustes
 * de espaciado; por eso se compara sin espacios.
 */
function pdfText(buffer) {
  const raw = buffer.toString('latin1');
  let text = '';
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content;
    try {
      content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const hex of content.matchAll(/<([0-9a-fA-F]+)>/g)) text += Buffer.from(hex[1], 'hex').toString('latin1');
  }
  return text.replace(/\s+/g, '');
}
const squash = (s) => Buffer.from(s, 'utf8').toString('utf8').normalize('NFC').replace(/\s+/g, '');
/** PDFKit codifica las fuentes estándar en WinAnsi (latin1): "Sofía" se busca así. */
const asPdf = (s) => Buffer.from(squash(s), 'latin1').toString('latin1');

/**
 * 3.º A del docente A: una prueba en papel (2 reactivos de fracciones) y una en pantalla.
 * Sofía es destinataria; su nombre y folio nunca deben aparecer en los PDF.
 */
function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const school = id("INSERT INTO schools (name) VALUES ('Escuela A')");
  const user = (email, role) =>
    id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, 'x', 'Persona Demo', ?)", school, email, role);
  const teacherA = user('a@axi.test', 'teacher');
  const teacherB = user('b@axi.test', 'teacher');
  const director = user('dir@axi.test', 'director');
  const group = id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'A', '2026-2027', 'PDFS3A')", school, teacherA);
  const sofia = id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, 'AXI-ZZZZZZZZ', 'Sofia', 'Ramirez', 'SR', '#F4B6C2')", school);
  db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'active')").run(group, sofia);

  const skill = id("INSERT INTO skills (code, name) VALUES ('fractions', 'Fracciones')");
  const question = (n) => {
    const qid = id(
      'INSERT INTO questions (skill_id, grade, stem, hint_1, hint_2, hint_3) VALUES (?, 3, ?, ?, ?, ?)',
      skill, `Enunciado ${n}`, `Observa la figura ${n}`, `Cuenta las partes ${n}`, `Ejemplo parecido ${n}`,
    );
    db.prepare("INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'A', ?, 1)").run(qid, `Opcion buena ${n}`);
    db.prepare("INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, 'B', ?, 0, 'etiqueta_error', 'Explicacion interna')")
      .run(qid, `Opcion distractor ${n}`);
    return qid;
  };
  const questions = [question(1), question(2)];

  const assignment = (modality) =>
    id("INSERT INTO assignments (group_id, created_by, title, modality) VALUES (?, ?, 'Fracciones de repaso', ?)", group, teacherA, modality);
  const paper = assignment('paper');
  const screen = assignment('screen');
  for (const a of [paper, screen]) {
    questions.forEach((q, i) => db.prepare('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)').run(a, q, i + 1));
  }
  db.prepare("INSERT INTO assignment_targets (assignment_id, student_id, status, is_screen_locked) VALUES (?, ?, 'pending', 1)").run(paper, sofia);

  const staff = (sub, role) => tokenFor({ sub: String(sub), role, schoolId: school });
  return {
    db,
    ids: { paper, screen },
    tokens: {
      teacherA: staff(teacherA, 'teacher'),
      teacherB: staff(teacherB, 'teacher'),
      director: staff(director, 'director'),
      student: tokenFor({ sub: String(sofia), role: 'student', schoolId: school, groupId: group }),
    },
  };
}

describe('PDF de Modo Papel', () => {
  let server;
  let ids;
  let tokens;
  const fetchPdf = async (path, token) => {
    const res = await fetch(server.base + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    const buffer = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, buffer };
  };
  const sheet = (a) => `/api/v1/paper/assignments/${a}/pdf`;
  const hints = (a) => `/api/v1/paper/assignments/${a}/hints-pdf`;

  before(async () => {
    const fx = createFixtures();
    ({ ids, tokens } = fx);
    server = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });
  after(() => server.close());

  test('hoja genérica: PDF Carta con reactivos y opciones, sin datos del alumno ni respuestas', async () => {
    const res = await fetchPdf(sheet(ids.paper), tokens.teacherA);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), new RegExp(`filename="hoja-${ids.paper}\\.pdf"`));
    assert.equal(res.buffer.subarray(0, 5).toString(), '%PDF-');
    assert.match(res.buffer.toString('latin1'), /\/MediaBox \[0 0 612 792\]/); // Carta

    const text = pdfText(res.buffer);
    for (const s of ['Enunciado 1', 'Enunciado 2', 'Opcion buena 1', 'Opcion distractor 2', 'Nombre:', '3.º A']) {
      assert.ok(text.includes(asPdf(s)), `falta "${s}"`);
    }
    for (const s of ['Sofia', 'Ramirez', 'AXI-ZZZZZZZZ', 'etiqueta_error', 'Explicacion interna', 'Observa la figura 1']) {
      assert.ok(!text.includes(asPdf(s)), `no debe aparecer "${s}"`);
    }
  });

  test('tarjetas de pistas: 3 niveles por reactivo, sin opciones ni datos del alumno', async () => {
    const res = await fetchPdf(hints(ids.paper), tokens.teacherA);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), new RegExp(`filename="pistas-${ids.paper}\\.pdf"`));

    const text = pdfText(res.buffer);
    for (const n of [1, 2]) {
      for (const s of [`Observa la figura ${n}`, `Cuenta las partes ${n}`, `Ejemplo parecido ${n}`, `Reactivo ${n}`]) {
        assert.ok(text.includes(asPdf(s)), `falta "${s}"`);
      }
    }
    for (const s of ['Pista 1', 'Pista 2', 'Pista 3']) assert.ok(text.includes(asPdf(s)), `falta "${s}"`);
    // Indica a la docente anotar la tarjeta usada, para capturarla como "Logrado con apoyo".
    assert.ok(text.includes(asPdf('Logrado con apoyo')), 'falta la indicación de anotar la tarjeta usada');
    for (const s of ['Opcion buena 1', 'Opcion distractor 1', 'Sofia', 'AXI-ZZZZZZZZ', 'etiqueta_error']) {
      assert.ok(!text.includes(asPdf(s)), `no debe aparecer "${s}"`);
    }
  });

  test('director de la escuela puede descargar ambos', async () => {
    assert.equal((await fetchPdf(sheet(ids.paper), tokens.director)).status, 200);
    assert.equal((await fetchPdf(hints(ids.paper), tokens.director)).status, 200);
  });

  test('ajena 404, pantalla 409, alumno 403, sin sesión 401', async () => {
    for (const path of [sheet, hints]) {
      const other = await fetchPdf(path(ids.paper), tokens.teacherB);
      assert.equal(other.status, 404);
      assert.equal(JSON.parse(other.buffer.toString()).error.code, 'ASSIGNMENT_NOT_FOUND');

      const screen = await fetchPdf(path(ids.screen), tokens.teacherA);
      assert.equal(screen.status, 409);
      assert.equal(JSON.parse(screen.buffer.toString()).error.code, 'NOT_PAPER_ASSIGNMENT');

      assert.equal((await fetchPdf(path(ids.paper), tokens.student)).status, 403);
      assert.equal((await fetchPdf(path(ids.paper))).status, 401);
    }
  });
});
