import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

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
const asPdf = (s) => Buffer.from(String(s).normalize('NFC').replace(/\s+/g, ''), 'latin1').toString('latin1');

function createFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const school = id("INSERT INTO schools (name) VALUES ('Escuela OMR')");
  const user = (email, role) =>
    id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, 'x', 'Docente Demo', ?)", school, email, role);
  const teacherA = user('a@omr.test', 'teacher');
  const teacherB = user('b@omr.test', 'teacher');
  const director = user('dir@omr.test', 'director');
  const group = id("INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'A', '2026-2027', 'OMR33A')", school, teacherA);
  const sofia = id("INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, 'AXI-OMR12345', 'Sofia', 'Ramirez', 'SR', '#F4B6C2')", school);
  db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'active')").run(group, sofia);

  const skill = id("INSERT INTO skills (code, name) VALUES ('fractions', 'Fracciones')");
  const makeQuestion = (n) => {
    const qid = id(
      'INSERT INTO questions (skill_id, grade, stem, hint_1, hint_2, hint_3) VALUES (?, 3, ?, ?, ?, ?)',
      skill, `Reactivo ${n}`, `Pista uno ${n}`, `Pista dos ${n}`, `Pista tres ${n}`,
    );
    db.prepare("INSERT INTO question_options (question_id, label, text, is_correct) VALUES (?, 'A', ?, 1)").run(qid, `Correcta ${n}`);
    db.prepare("INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, 'B', ?, 0, 'error_conceptual', 'Explicacion secreta')")
      .run(qid, `Distractor B ${n}`);
    db.prepare("INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, 'C', ?, 0, 'error_lectura', 'Explicacion secreta C')")
      .run(qid, `Distractor C ${n}`);
    db.prepare("INSERT INTO question_options (question_id, label, text, is_correct, error_tag, error_explanation) VALUES (?, 'D', ?, 0, 'error_conteo', 'Explicacion secreta D')")
      .run(qid, `Distractor D ${n}`);
    return qid;
  };
  const questions = [makeQuestion(1), makeQuestion(2), makeQuestion(3)];

  const createAssignment = (modality) =>
    id("INSERT INTO assignments (group_id, created_by, title, modality) VALUES (?, ?, 'Fracciones · prueba 1', ?)", group, teacherA, modality);
  const paper = createAssignment('paper');
  const screen = createAssignment('screen');
  for (const a of [paper, screen]) {
    questions.forEach((q, idx) =>
      db.prepare('INSERT INTO assignment_questions (assignment_id, question_id, position) VALUES (?, ?, ?)').run(a, q, idx + 1));
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

describe('OMR en Modo Papel (layout y PDF escaneable)', () => {
  let server;
  let ids;
  let tokens;

  const get = async (path, token) => {
    const res = await fetch(server.base + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    const buffer = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, buffer };
  };

  before(async () => {
    const fx = createFixtures();
    ({ ids, tokens } = fx);
    server = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });
  after(() => server.close());

  test('GET /omr-layout devuelve geometría completa sin PII ni respuestas correctas', async () => {
    for (const token of [tokens.teacherA, tokens.director]) {
      const res = await get(`/api/v1/paper/assignments/${ids.paper}/omr-layout`, token);
      assert.equal(res.status, 200);
      const body = JSON.parse(res.buffer.toString());
      const layout = body.data;

      assert.equal(layout.version, 1);
      assert.equal(layout.assignmentId, ids.paper);
      assert.equal(layout.code, `P-${ids.paper}`);
      assert.equal(layout.groupLabel, '3.º A');
      assert.deepEqual(layout.columns, ['A', 'B', 'C', 'D']);
      assert.equal(layout.questions.length, 3);
      assert.equal(layout.codeStrip.bits.length, 18);
      assert.equal(layout.supportBubble.label, 'Usó tarjetas de pistas');

      const serialized = JSON.stringify(body);
      for (const secret of ['Sofia', 'Ramirez', 'AXI-OMR12345', 'isCorrect', 'is_correct', 'error_conceptual', 'errorTag']) {
        assert.ok(!serialized.includes(secret), `no debe exponer "${secret}"`);
      }
    }
  });

  test('GET /answer-sheet-pdf genera 1 página Carta B/N escaneable sin datos del alumno', async () => {
    for (const token of [tokens.teacherA, tokens.director]) {
      const res = await get(`/api/v1/paper/assignments/${ids.paper}/answer-sheet-pdf`, token);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'application/pdf');
      assert.match(res.headers.get('content-disposition'), new RegExp(`filename="hoja-respuestas-${ids.paper}\\.pdf"`));
      assert.equal(res.buffer.subarray(0, 5).toString(), '%PDF-');
      assert.match(res.buffer.toString('latin1'), /\/MediaBox \[0 0 612 792\]/);

      const pages = (res.buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
      assert.equal(pages, 1);

      const text = pdfText(res.buffer);
      for (const expected of ['Hoja de respuestas', `P-${ids.paper}`, 'Usó tarjetas de pistas', 'Nombre:', 'Fecha:']) {
        assert.ok(text.includes(asPdf(expected)), `falta "${expected}"`);
      }
      for (const forbidden of ['Sofia', 'Ramirez', 'AXI-OMR12345', 'error_conceptual', 'Pista uno 1']) {
        assert.ok(!text.includes(asPdf(forbidden)), `no debe aparecer "${forbidden}"`);
      }
    }
  });

  test('GET /pdf incluye la hoja de respuestas OMR como página final propia', async () => {
    const res = await get(`/api/v1/paper/assignments/${ids.paper}/pdf`, tokens.teacherA);
    assert.equal(res.status, 200);
    const pages = (res.buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    assert.equal(pages, 2);

    const text = pdfText(res.buffer);
    assert.ok(text.includes(asPdf('Reactivo 1')));
    assert.ok(text.includes(asPdf('Hoja de respuestas')));
    assert.ok(text.includes(asPdf(`P-${ids.paper}`)));
    assert.ok(!text.includes(asPdf('Sofia')));
    assert.ok(!text.includes(asPdf('AXI-OMR12345')));
  });

  test('autorización en /omr-layout y /answer-sheet-pdf: ajena 404, pantalla 409, alumno 403, sin sesión 401', async () => {
    for (const suffix of ['omr-layout', 'answer-sheet-pdf']) {
      const other = await get(`/api/v1/paper/assignments/${ids.paper}/${suffix}`, tokens.teacherB);
      assert.equal(other.status, 404);
      assert.equal(JSON.parse(other.buffer.toString()).error.code, 'ASSIGNMENT_NOT_FOUND');

      const screen = await get(`/api/v1/paper/assignments/${ids.screen}/${suffix}`, tokens.teacherA);
      assert.equal(screen.status, 409);
      assert.equal(JSON.parse(screen.buffer.toString()).error.code, 'NOT_PAPER_ASSIGNMENT');

      assert.equal((await get(`/api/v1/paper/assignments/${ids.paper}/${suffix}`, tokens.student)).status, 403);
      assert.equal((await get(`/api/v1/paper/assignments/${ids.paper}/${suffix}`)).status, 401);
    }
  });
});
