import assert from 'node:assert/strict';
import { once } from 'node:events';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { runSeed } from '../src/db/seed.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

function createQuizFixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);

  const schoolA = id("INSERT INTO schools (name) VALUES ('Escuela Primaria A')");
  const schoolB = id("INSERT INTO schools (name) VALUES ('Escuela Primaria B')");

  const user = (school, email, name, role = 'teacher') =>
    id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, 'hash', ?, ?)", school, email, name, role);

  const teacherA = user(schoolA, 'elena@escuela-a.test', 'Mtra. Elena');
  const teacherB = user(schoolA, 'jorge@escuela-a.test', 'Mtro. Jorge');
  const directorA = user(schoolA, 'dir@escuela-a.test', 'Dir. Laura', 'director');
  const teacherZ = user(schoolB, 'z@escuela-b.test', 'Mtra. Zoe');

  const groupA = id(
    "INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'A', '2026-2027', 'QUIZ3A')",
    schoolA,
    teacherA,
  );
  const studentA = id(
    "INSERT INTO students (school_id, internal_folio, first_names, last_names, initials, avatar_color) VALUES (?, 'AXI-QUIZ0001', 'Ana', 'López', 'AL', '#F4B6C2')",
    schoolA,
  );
  db.prepare("INSERT INTO group_enrollments (group_id, student_id, status) VALUES (?, ?, 'active')").run(groupA, studentA);

  const skills = Object.fromEntries(
    [
      ['fractions', 'Fracciones'],
      ['multiplication', 'Multiplicación'],
      ['place_value', 'Valor posicional'],
      ['problem_solving', 'Resolución de problemas'],
      ['reading_comprehension', 'Comprensión lectora'],
    ].map(([code, name]) => [code, id('INSERT INTO skills (code, name) VALUES (?, ?)', code, name)]),
  );

  // Historial del grupo A: Fracciones bajo (20% Necesita apoyo), Valor posicional alto (85% Dominado)
  const addCut = (skillCode, pct, idx) => {
    const level = pct < 25 ? 'needs_support' : pct < 50 ? 'in_progress' : pct < 75 ? 'achieved' : 'mastered';
    db.prepare(
      'INSERT INTO skill_mastery_history (student_id, skill_id, grade, session_index, session_percentage, autonomous_percentage, supported_percentage, mastery_percentage, mastery_level) VALUES (?, ?, 3, ?, ?, ?, 0, ?, ?)',
    ).run(studentA, skills[skillCode], idx, pct, pct, pct, level);
  };
  addCut('fractions', 20, 1);
  addCut('place_value', 85, 1);

  const insertQuiz = (schoolId, createdBy, originType, title, skillCode, grade = 3) => {
    const qid = id(
      'INSERT INTO quizzes (school_id, created_by, origin_type, title, description, skill_id, grade) VALUES (?, ?, ?, ?, ?, ?, ?)',
      schoolId,
      createdBy,
      originType,
      title,
      `Descripción de ${title}`,
      skills[skillCode],
      grade,
    );
    id(
      'INSERT INTO quiz_questions (quiz_id, position, question_type, prompt, options_json, correct_answer, hint) VALUES (?, 1, ?, ?, ?, ?, ?)',
      qid,
      'multiple_choice',
      `Pregunta de ${title}`,
      JSON.stringify([
        { label: 'A', text: '1/4', isCorrect: true },
        { label: 'B', text: '4/1', isCorrect: false },
      ]),
      '1/4',
      'Observa cuántas partes iguales hay.',
    );
    return qid;
  };

  const ownQuizId = insertQuiz(schoolA, teacherA, 'teacher', 'Mi cuestionario de fracciones', 'fractions', 3);
  const colleagueQuizId = insertQuiz(schoolA, teacherB, 'teacher', 'Cuestionario de colega en valor posicional', 'place_value', 3);
  const preloadedQuizId = insertQuiz(null, null, 'system', 'Cuestionario precargado de fracciones', 'fractions', 3);
  const foreignQuizId = insertQuiz(schoolB, teacherZ, 'teacher', 'Cuestionario privado de escuela B', 'fractions', 3);

  const staffToken = (sub, role, schoolId) => tokenFor({ sub: String(sub), role, schoolId });
  return {
    db,
    skills,
    ids: { schoolA, teacherA, teacherB, directorA, groupA, studentA, ownQuizId, colleagueQuizId, preloadedQuizId, foreignQuizId },
    tokens: {
      teacherA: staffToken(teacherA, 'teacher', schoolA),
      teacherB: staffToken(teacherB, 'teacher', schoolA),
      directorA: staffToken(directorA, 'director', schoolA),
      teacherZ: staffToken(teacherZ, 'teacher', schoolB),
      student: tokenFor({ sub: String(studentA), role: 'student', schoolId: schoolA, groupId: groupA }),
    },
  };
}

async function fetchBinary(db, path, token) {
  const server = createApp({ db, config: configWith(), logger: silentLogger }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('quizzes and builder API', () => {
  let fx;
  let api;

  beforeEach(async () => {
    fx = createQuizFixtures();
    api = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });

  afterEach(async () => {
    await api.close();
    fx.db.close();
  });

  test('autorización: 401 sin sesión, 403 alumno, director solo lectura', async () => {
    assert.equal((await api.call('GET', '/api/v1/assessments/quizzes')).status, 401);
    assert.equal((await api.call('POST', '/api/v1/assessments/quizzes', { body: {} })).status, 401);
    assert.equal((await api.call('GET', '/api/v1/assessments/quizzes', { token: fx.tokens.student })).status, 403);
    assert.equal((await api.call('GET', `/api/v1/assessments/quizzes/${fx.ids.ownQuizId}`, { token: fx.tokens.student })).status, 403);

    const dirList = await api.call('GET', '/api/v1/assessments/quizzes', { token: fx.tokens.directorA });
    assert.equal(dirList.status, 200);

    const dirCreate = await api.call('POST', '/api/v1/assessments/quizzes', {
      token: fx.tokens.directorA,
      body: { title: 'Intento director', skillCode: 'fractions', grade: 3, questions: [] },
    });
    assert.equal(dirCreate.status, 403);

    // No expone cuestionarios de otra escuela
    assert.equal((await api.call('GET', `/api/v1/assessments/quizzes/${fx.ids.foreignQuizId}`, { token: fx.tokens.teacherA })).status, 404);
  });

  test('filtra entre propios, de otros docentes y precargados', async () => {
    const allRes = await api.call('GET', `/api/v1/assessments/quizzes?groupId=${fx.ids.groupA}`, { token: fx.tokens.teacherA });
    assert.equal(allRes.status, 200);
    assert.equal(allRes.body.data.counts.all, 3);
    assert.equal(allRes.body.data.counts.own, 1);
    assert.equal(allRes.body.data.counts.other_teachers, 1);
    assert.equal(allRes.body.data.counts.preloaded, 1);

    const ownRes = await api.call('GET', `/api/v1/assessments/quizzes?groupId=${fx.ids.groupA}&origin=own`, { token: fx.tokens.teacherA });
    assert.equal(ownRes.body.data.quizzes.length, 1);
    assert.equal(ownRes.body.data.quizzes[0].id, fx.ids.ownQuizId);
    assert.equal(ownRes.body.data.quizzes[0].canEdit, true);

    const otherRes = await api.call('GET', `/api/v1/assessments/quizzes?groupId=${fx.ids.groupA}&origin=other_teachers`, { token: fx.tokens.teacherA });
    assert.equal(otherRes.body.data.quizzes.length, 1);
    assert.equal(otherRes.body.data.quizzes[0].id, fx.ids.colleagueQuizId);
    assert.equal(otherRes.body.data.quizzes[0].canEdit, false);

    const preRes = await api.call('GET', `/api/v1/assessments/quizzes?groupId=${fx.ids.groupA}&origin=preloaded`, { token: fx.tokens.teacherA });
    assert.equal(preRes.body.data.quizzes.length, 1);
    assert.equal(preRes.body.data.quizzes[0].id, fx.ids.preloadedQuizId);
    assert.equal(preRes.body.data.quizzes[0].canEdit, false);
  });

  test('recomienda dinámicamente según el desempeño actual del grupo', async () => {
    const res = await api.call('GET', `/api/v1/assessments/quizzes?groupId=${fx.ids.groupA}`, { token: fx.tokens.teacherA });
    const list = res.body.data.quizzes;

    const fracQuiz = list.find((q) => q.id === fx.ids.ownQuizId);
    const pvQuiz = list.find((q) => q.id === fx.ids.colleagueQuizId);

    assert.equal(fracQuiz.isRecommended, true);
    assert.equal(pvQuiz.isRecommended, false);
    assert.ok(fracQuiz.recommendationScore > pvQuiz.recommendationScore);
    assert.match(fracQuiz.recommendationReason, /20%.*Necesita apoyo/);

    // Si Fracciones sube a 90% y Valor posicional baja a 10%, cambia dinámicamente la recomendación
    fx.db.prepare(
      "INSERT INTO skill_mastery_history (student_id, skill_id, grade, session_index, session_percentage, autonomous_percentage, supported_percentage, mastery_percentage, mastery_level) VALUES (?, ?, 3, 2, 95, 95, 0, 90, 'mastered')",
    ).run(fx.ids.studentA, fx.skills.fractions);
    fx.db.prepare(
      "INSERT INTO skill_mastery_history (student_id, skill_id, grade, session_index, session_percentage, autonomous_percentage, supported_percentage, mastery_percentage, mastery_level) VALUES (?, ?, 3, 2, 5, 5, 0, 10, 'needs_support')",
    ).run(fx.ids.studentA, fx.skills.place_value);

    const updatedRes = await api.call('GET', `/api/v1/assessments/quizzes?groupId=${fx.ids.groupA}`, { token: fx.tokens.teacherA });
    const updatedList = updatedRes.body.data.quizzes;
    const updatedFrac = updatedList.find((q) => q.id === fx.ids.ownQuizId);
    const updatedPv = updatedList.find((q) => q.id === fx.ids.colleagueQuizId);

    assert.equal(updatedPv.isRecommended, true);
    assert.equal(updatedFrac.isRecommended, false);
    assert.ok(updatedPv.recommendationScore > updatedFrac.recommendationScore);
  });

  test('solo el docente propietario puede editar preguntas y respuestas', async () => {
    const editPayload = {
      title: 'Mi cuestionario actualizado',
      description: 'Editado con éxito',
      skillCode: 'fractions',
      grade: 3,
      questions: [
        {
          questionType: 'true_false',
          prompt: 'Dos cuartos equivalen a un medio.',
          correctAnswer: 'Verdadero',
          hint: 'Compara tiras iguales.',
        },
        {
          questionType: 'fill_blank',
          prompt: 'Un entero tiene ___ cuartos.',
          correctAnswer: '4',
          hint: '',
        },
        {
          questionType: 'multiple_choice',
          prompt: '¿Qué fracción representa la mitad?',
          options: [
            { label: 'A', text: '1/2', isCorrect: true },
            { label: 'B', text: '1/4', isCorrect: false },
          ],
          hint: '',
        },
      ],
    };

    // Otro docente y sistema -> 403 QUIZ_NOT_OWNED
    const forbiddenOther = await api.call('PATCH', `/api/v1/assessments/quizzes/${fx.ids.colleagueQuizId}`, {
      token: fx.tokens.teacherA,
      body: editPayload,
    });
    assert.equal(forbiddenOther.status, 403);
    assert.equal(forbiddenOther.body.error.code, 'QUIZ_NOT_OWNED');

    const forbiddenSystem = await api.call('PATCH', `/api/v1/assessments/quizzes/${fx.ids.preloadedQuizId}`, {
      token: fx.tokens.teacherA,
      body: editPayload,
    });
    assert.equal(forbiddenSystem.status, 403);

    // Propietario -> 200 y persiste cambios
    const ok = await api.call('PATCH', `/api/v1/assessments/quizzes/${fx.ids.ownQuizId}`, {
      token: fx.tokens.teacherA,
      body: editPayload,
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.title, 'Mi cuestionario actualizado');
    assert.equal(ok.body.data.questionCount, 3);
    assert.equal(ok.body.data.questions[0].questionType, 'true_false');
    assert.equal(ok.body.data.questions[1].correctAnswer, '4');
  });

  test('constructor crea cuestionario estilo Kahoot! con los 3 tipos y rechaza entradas inválidas o menos de 3 reactivos', async () => {
    const bad = await api.call('POST', '/api/v1/assessments/quizzes', {
      token: fx.tokens.teacherA,
      body: { title: '   ', skillCode: 'fractions', grade: 3, questions: [] },
    });
    assert.equal(bad.status, 400);

    const tooShort = await api.call('POST', '/api/v1/assessments/quizzes', {
      token: fx.tokens.teacherA,
      body: {
        title: 'Solo dos reactivos',
        skillCode: 'fractions',
        grade: 3,
        questions: [
          { questionType: 'true_false', prompt: 'Uno', correctAnswer: 'Verdadero' },
          { questionType: 'fill_blank', prompt: 'Dos ___', correctAnswer: '2' },
        ],
      },
    });
    assert.equal(tooShort.status, 422);
    assert.equal(tooShort.body.error.code, 'INSUFFICIENT_QUESTIONS_PER_SKILL');

    const payload = {
      title: 'Reto mixto de multiplicación',
      description: 'Combina los 3 tipos de reactivos',
      skillCode: 'multiplication',
      grade: 3,
      questions: [
        {
          questionType: 'multiple_choice',
          prompt: '¿Cuánto es 4 × 6?',
          options: [
            { label: 'A', text: '10', isCorrect: false },
            { label: 'B', text: '24', isCorrect: true },
            { label: 'C', text: '20', isCorrect: false },
          ],
          hint: 'Suma 6 cuatro veces.',
        },
        {
          questionType: 'true_false',
          prompt: '3 × 5 es igual a 5 × 3.',
          correctAnswer: 'Verdadero',
        },
        {
          questionType: 'fill_blank',
          prompt: 'Si hay 5 cajas con 7 lápices, son ___ lápices.',
          correctAnswer: '35',
        },
      ],
    };

    const created = await api.call('POST', '/api/v1/assessments/quizzes', {
      token: fx.tokens.teacherA,
      body: payload,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.origin, 'own');
    assert.equal(created.body.data.canEdit, true);
    assert.equal(created.body.data.questionCount, 3);
    assert.deepEqual(created.body.data.questionTypeCounts, {
      multiple_choice: 1,
      true_false: 1,
      fill_blank: 1,
    });

    const detail = await api.call('GET', `/api/v1/assessments/quizzes/${created.body.data.id}`, {
      token: fx.tokens.teacherA,
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.questions.length, 3);
  });

  test('exporta a PDF Carta B/N sin respuestas para cualquier cuestionario visible', async () => {
    // Creamos uno mixto con los 3 tipos para verificar el renderizador PDF completo
    const created = await api.call('POST', '/api/v1/assessments/quizzes', {
      token: fx.tokens.teacherA,
      body: {
        title: 'Evaluación imprimible mixta',
        skillCode: 'fractions',
        grade: 3,
        questions: [
          {
            questionType: 'multiple_choice',
            prompt: '¿Cuál es un cuarto?',
            options: [
              { label: 'A', text: '1/4', isCorrect: true },
              { label: 'B', text: '4/1', isCorrect: false },
            ],
          },
          {
            questionType: 'true_false',
            prompt: 'Un medio es mayor que un cuarto.',
            correctAnswer: 'Verdadero',
          },
          {
            questionType: 'fill_blank',
            prompt: 'Dos mitades forman ___ entero.',
            correctAnswer: 'UN_ENTERO_SECRETO',
          },
        ],
      },
    });
    const quizId = created.body.data.id;

    const pdfRes = await fetchBinary(fx.db, `/api/v1/assessments/quizzes/${quizId}/pdf?groupId=${fx.ids.groupA}`, fx.tokens.teacherA);
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
    assert.match(pdfRes.headers.get('content-disposition'), /cuestionario-\d+\.pdf/);
    assert.equal(pdfRes.bytes.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(pdfRes.bytes.length > 1000);
    const pdfLatin1 = pdfRes.bytes.toString('latin1');
    assert.ok(!pdfLatin1.includes('UN_ENTERO_SECRETO'), 'el PDF no debe incluir la respuesta de completar frase');
    const pageMatches = pdfLatin1.match(/\/Type\s*\/Page\b/g) ?? [];
    assert.equal(pageMatches.length, 1, 'un cuestionario de 3 preguntas debe caber en 1 sola página sin hojas en blanco');

    // Título largo (120 caracteres) no debe encimar encabezado ni generar páginas vacías
    const longTitleQuiz = await api.call('POST', '/api/v1/assessments/quizzes', {
      token: fx.tokens.teacherA,
      body: {
        title: 'Evaluación diagnóstica integral de fracciones equivalentes y comparación de partes iguales para tercer grado de primaria',
        skillCode: 'fractions',
        grade: 3,
        questions: [
          {
            questionType: 'multiple_choice',
            prompt: '¿Qué fracción equivale a 1/2?',
            options: [
              { label: 'A', text: '2/4', isCorrect: true },
              { label: 'B', text: '1/4', isCorrect: false },
            ],
          },
          { questionType: 'true_false', prompt: '3/6 es igual a 1/2.', correctAnswer: 'Verdadero' },
          { questionType: 'fill_blank', prompt: 'La mitad de 10 es ___ .', correctAnswer: '5' },
        ],
      },
    });
    assert.equal(longTitleQuiz.status, 201);
    const longPdf = await fetchBinary(fx.db, `/api/v1/assessments/quizzes/${longTitleQuiz.body.data.id}/pdf?groupId=${fx.ids.groupA}`, fx.tokens.teacherA);
    assert.equal(longPdf.status, 200);
    const longPages = longPdf.bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
    assert.equal(longPages.length, 1);
  });

  test('consistencia del seed completo y carga en base previamente sembrada sin cuestionarios', () => {
    const seedDb = openDatabase(':memory:');
    runMigrations(seedDb);
    const seedResult = runSeed(seedDb);
    assert.equal(seedResult.seeded, true);
    assert.equal(seedResult.counts.quizzes, 7);
    const rows = seedDb.prepare('SELECT origin_type, COUNT(*) AS n FROM quizzes GROUP BY origin_type').all();
    const map = Object.fromEntries(rows.map((r) => [r.origin_type, r.n]));
    assert.equal(map.teacher, 4);
    assert.equal(map.system, 3);

    // Simula una BD ya sembrada antes de la migración 004 (sin cuestionarios aún)
    seedDb.prepare('DELETE FROM quizzes').run();
    const incremental = runSeed(seedDb);
    assert.equal(incremental.seeded, true);
    assert.equal(incremental.reason, 'added_missing_quizzes');
    assert.equal(incremental.counts.quizzes, 7);

    // Una segunda llamada ya no inserta nada
    const noop = runSeed(seedDb);
    assert.deepEqual(noop, { seeded: false, reason: 'already_seeded' });
    seedDb.close();
  });
});
