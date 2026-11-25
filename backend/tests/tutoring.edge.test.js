/**
 * Casos borde de la Red de tutores: roles, escuelas ajenas, matrícula retirada,
 * corrección de demostraciones, validación del cuerpo y contenido del PDF.
 * Base SQLite en memoria; datos ficticios.
 */
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { buildCardScript, chooseCardQuestions } from '../src/modules/tutoring/tutoring.domain.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

function fixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);
  const school = insert("INSERT INTO schools (name) VALUES ('Escuela ficticia')");
  const otherSchool = insert("INSERT INTO schools (name) VALUES ('Otra escuela')");
  const user = (email, role, schoolId = school) => insert("INSERT INTO users (school_id,email,password_hash,full_name,role) VALUES (?,?,'HASH-SECRETO','Persona ficticia',?)", schoolId, email, role);
  const teacher = user('t@edge.test', 'teacher');
  const director = user('d@edge.test', 'director');
  const otherTeacher = user('o@edge.test', 'teacher', otherSchool);
  const otherDirector = user('od@edge.test', 'director', otherSchool);
  const groupId = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'A','2026-2027','EDGE3A')", school, teacher);
  const secondGroup = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'B','2026-2027','EDGE3B')", school, teacher);
  const foreignGroup = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'A','2026-2027','EDGEXA')", otherSchool, otherTeacher);
  const skill = insert("INSERT INTO skills (code,name) VALUES ('multiplication','Multiplicación')");
  insert("INSERT INTO skills (code,name) VALUES ('fractions','Fracciones')");
  const questionIds = [1, 2, 3, 4, 5].map((n) => insert("INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3) VALUES (?,3,?,'Mira los grupos','Cuenta de 4 en 4','Ejemplo con otros datos: 2 x 5')", skill, `Reactivo ${n}: cuanto es ${n} x 4`));
  const options = questionIds.map((q, i) => ({
    correct: insert("INSERT INTO question_options (question_id,label,text,is_correct) VALUES (?,'B',?,1)", q, String((i + 1) * 4)),
    wrong: insert("INSERT INTO question_options (question_id,label,text,is_correct,error_tag,error_explanation) VALUES (?,'A','99',0,'adds_instead','Suma los dos números en lugar de juntar grupos iguales.')", q),
  }));
  const assignment = insert("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'Prueba','screen')", groupId, teacher);
  const student = (name, mastery, group = groupId, status = 'active') => {
    const id = insert("INSERT INTO students (school_id,internal_folio,first_names,last_names,initials,avatar_color) VALUES (?,?,?,'Ejemplo','AE','#123456')", school, `FOLIO-${name}`, name);
    insert('INSERT INTO group_enrollments (group_id,student_id,status) VALUES (?,?,?)', group, id, status);
    if (mastery !== null) {
      const level = mastery < 25 ? 'needs_support' : mastery < 50 ? 'in_progress' : mastery < 75 ? 'achieved' : 'mastered';
      insert(`INSERT INTO skill_mastery_history (student_id,skill_id,assignment_id,grade,session_index,session_percentage,
        autonomous_percentage,supported_percentage,mastery_percentage,mastery_level) VALUES (?,?,?,3,1,?,?,0,?,?)`, id, skill, assignment, mastery, mastery, mastery, level);
    }
    return id;
  };
  const ids = { ana: student('Ana', 100), beto: student('Beto', 80), celia: student('Celia', 40), dani: student('Dani', 30),
    eli: student('Eli', 10), gabi: student('Gabi', 20, groupId, 'withdrawn') };
  const wrong = (studentId) => {
    const target = insert("INSERT INTO assignment_targets (assignment_id,student_id,status) VALUES (?,?,'completed_screen')", assignment, studentId);
    insert("INSERT INTO student_responses (assignment_target_id,question_id,selected_option_id,outcome_status,error_tag,source) VALUES (?,?,?,'incorrect','adds_instead','screen')", target, questionIds[0], options[0].wrong);
  };
  for (const id of [ids.celia, ids.dani, ids.eli, ids.gabi]) wrong(id);
  const otherGroupStudent = student('Hugo', 10, secondGroup);
  return { db, school, otherSchool, teacher, director, otherTeacher, otherDirector, groupId, secondGroup, foreignGroup, ids, otherGroupStudent };
}

/** Texto por flujo de contenido del PDF (PDFKit comprime con Flate y escribe hex en TJ). */
function pdfStreams(buffer) {
  const raw = buffer.toString('latin1');
  const out = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content;
    try { content = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { continue; }
    const text = [...content.matchAll(/\[([^\]]*)\]\s*TJ/g)]
      .map((tj) => [...tj[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join(''))
      .join('\n');
    if (text) out.push(text);
  }
  return out;
}

describe('tutoring API — casos borde', () => {
  let ctx; let server; let listener; let baseUrl;
  const as = (sub, role, schoolId = ctx.school) => tokenFor({ sub: String(sub), role, schoolId });
  const base = (groupId = ctx.groupId) => `/api/v1/tutoring/groups/${groupId}`;
  const teacher = () => as(ctx.teacher, 'teacher');
  const create = (pairs, token = teacher(), extra = {}) =>
    server.call('POST', `${base()}/sessions`, { token, body: { skillCode: 'multiplication', pairs, ...extra } });
  const demo = (pairId, correct, token = teacher()) =>
    server.call('PATCH', `${base()}/pairs/${pairId}/demonstration`, { token, body: { correct } });
  const proposal = async () => (await server.call('GET', `${base()}/proposal?skillCode=multiplication`, { token: teacher() })).body.data;
  const pdf = async (sessionId, token = teacher(), part = 'cards') => {
    const res = await fetch(`${baseUrl}${base()}/sessions/${sessionId}/${part}.pdf`, { headers: { authorization: `Bearer ${token}` } });
    return { status: res.status, type: res.headers.get('content-type'), bytes: Buffer.from(await res.arrayBuffer()) };
  };

  beforeEach(async () => {
    ctx = fixtures();
    const app = createApp({ db: ctx.db, config: configWith(), logger: silentLogger });
    server = await startServer(app);
    listener = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => listener.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${listener.address().port}`;
  });
  afterEach(async () => {
    await server.close();
    await new Promise((resolve) => listener.close(resolve));
    ctx.db.close();
  });

  test('roles: director no escribe (POST/PATCH 403), alumno 403 en lectura, director lee y descarga PDF', async () => {
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    assert.equal(created.status, 201);
    const pairId = created.body.data.pairs[0].id;
    const dir = as(ctx.director, 'director');
    const patch = await demo(pairId, 3, dir);
    assert.equal(patch.status, 403);
    assert.equal(typeof patch.body.error.code, 'string');
    assert.equal(ctx.db.prepare('SELECT demo_correct FROM tutoring_pairs WHERE id = ?').get(pairId).demo_correct, null);
    const studentToken = tokenFor({ sub: String(ctx.ids.celia), role: 'student', schoolId: ctx.school, groupId: ctx.groupId });
    for (const path of [`${base()}/proposal`, `${base()}/sessions`]) {
      assert.equal((await server.call('GET', path, { token: studentToken })).status, 403, path);
    }
    assert.equal((await demo(pairId, 3, studentToken)).status, 403);
    assert.equal((await server.call('GET', `${base()}/sessions`, { token: dir })).status, 200);
    const file = await pdf(created.body.data.id, dir);
    assert.equal(file.status, 200);
    assert.equal(file.type, 'application/pdf');
  });

  test('escuela ajena: docente y director de otra escuela reciben 404 en todas las rutas', async () => {
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    const pairId = created.body.data.pairs[0].id;
    const sessionId = created.body.data.id;
    const outsiders = [as(ctx.otherTeacher, 'teacher', ctx.otherSchool), as(ctx.otherDirector, 'director', ctx.otherSchool)];
    for (const token of outsiders) {
      for (const path of [`${base()}/proposal`, `${base()}/sessions`]) {
        const res = await server.call('GET', path, { token });
        assert.equal(res.status, 404, path);
        assert.equal(res.body.error.code, 'GROUP_NOT_FOUND');
      }
      assert.equal((await pdf(sessionId, token)).status, 404);
    }
    assert.equal((await demo(pairId, 3, outsiders[0])).status, 404);
    // El docente propio tampoco entra al grupo de otra escuela.
    const foreign = await server.call('GET', `${base(ctx.foreignGroup)}/proposal`, { token: teacher() });
    assert.equal(foreign.status, 404);
    // Id inválido → 400.
    assert.equal((await server.call('GET', '/api/v1/tutoring/groups/abc/proposal', { token: teacher() })).status, 400);
  });

  test('pareja de otro grupo del mismo docente no se puede capturar desde este grupo (404)', async () => {
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    const pairId = created.body.data.pairs[0].id;
    const res = await server.call('PATCH', `${base(ctx.secondGroup)}/pairs/${pairId}/demonstration`, { token: teacher(), body: { correct: 3 } });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'PAIR_NOT_FOUND');
    const pdfOther = await fetch(`${baseUrl}${base(ctx.secondGroup)}/sessions/${created.body.data.id}/cards.pdf`, { headers: { authorization: `Bearer ${teacher()}` } });
    assert.equal(pdfOther.status, 404);
    // Alumno de otro grupo del mismo docente tampoco puede entrar a la sesión.
    const cross = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.otherGroupStudent }]);
    assert.equal(cross.status, 404);
    assert.equal(cross.body.error.code, 'STUDENT_NOT_FOUND');
  });

  test('alumno retirado: fuera de la propuesta, no se puede emparejar y su pareja desaparece', async () => {
    const p = await proposal();
    const everyone = [...p.pairs.flatMap((x) => [x.tutor, ...x.tutees]), ...p.teacherTable, ...p.tutors, ...p.availableTutors];
    assert.equal(everyone.some((s) => s.id === ctx.ids.gabi), false, 'Gabi (withdrawn) no aparece');
    assert.equal(p.skills.find((s) => s.code === 'multiplication').tuteeCount, 3);
    const asTutee = await create([{ tutorId: null, tuteeId: ctx.ids.gabi }]);
    assert.equal(asTutee.status, 404);
    assert.equal(asTutee.body.error.code, 'STUDENT_NOT_FOUND');

    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }, { tutorId: ctx.ids.beto, tuteeId: ctx.ids.dani }]);
    const celiaPair = created.body.data.pairs.find((x) => x.tutee.id === ctx.ids.celia).id;
    ctx.db.prepare("UPDATE group_enrollments SET status = 'withdrawn' WHERE student_id = ?").run(ctx.ids.celia);
    const list = await server.call('GET', `${base()}/sessions`, { token: teacher() });
    const pairs = list.body.data.sessions[0].pairs;
    assert.deepEqual(pairs.map((x) => x.tutee.id), [ctx.ids.dani]);
    assert.equal(list.body.data.network.students.some((s) => s.id === ctx.ids.celia), false);
    assert.equal((await demo(celiaPair, 3)).status, 404);
    const text = pdfStreams((await pdf(created.body.data.id)).bytes).join('\n');
    assert.equal(text.includes('Celia'), false, 'el PDF no lista al alumno retirado');
    assert.ok(text.includes('Dani'));
  });

  test('tutor retirado después de la sesión: no aparece su nombre ni puede volver a ser tutor', async () => {
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    ctx.db.prepare("UPDATE group_enrollments SET status = 'withdrawn' WHERE student_id = ?").run(ctx.ids.ana);
    const list = await server.call('GET', `${base()}/sessions`, { token: teacher() });
    assert.equal(JSON.stringify(list.body).includes('Ana'), false);
    assert.equal((await proposal()).tutors.some((t) => t.id === ctx.ids.ana), false);
    const again = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.dani }]);
    assert.equal(again.status, 404);
    const text = pdfStreams((await pdf(created.body.data.id)).bytes).join('\n');
    assert.equal(text.includes('Ana'), false);
  });

  test('demostración corregida de 3 a 1 deja de hacerlo tutor y vuelve a recibir tutoría', async () => {
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    const pairId = created.body.data.pairs[0].id;
    assert.equal((await demo(pairId, 3)).body.data.demonstration.code, 'ready_to_teach');
    let p = await proposal();
    assert.ok(p.tutors.some((t) => t.id === ctx.ids.celia));
    assert.equal(p.tutors.find((t) => t.id === ctx.ids.celia).readyToTeach, true);
    const fixed = await demo(pairId, 1);
    assert.equal(fixed.status, 200);
    assert.deepEqual(fixed.body.data.demonstration, { code: 'keep_practicing', label: 'Seguimos practicando juntos', correct: 1, total: 3 });
    p = await proposal();
    assert.equal(p.tutors.some((t) => t.id === ctx.ids.celia), false, 'ya no es tutora');
    const tutees = [...p.pairs.flatMap((x) => x.tutees), ...p.teacherTable].map((t) => t.id);
    assert.ok(tutees.includes(ctx.ids.celia), 'vuelve a recibir tutoría');
    const tutorTry = await create([{ tutorId: ctx.ids.celia, tuteeId: ctx.ids.eli }]);
    assert.equal(tutorTry.status, 422);
    assert.equal(tutorTry.body.error.code, 'TUTOR_NOT_READY');
    const list = await server.call('GET', `${base()}/sessions`, { token: teacher() });
    assert.equal(list.body.data.network.errors[0].readyToTeachCount, 0);
    assert.equal(list.body.data.network.students.find((s) => s.id === ctx.ids.celia).canTeach.length, 0);
    // 2/3 → Va avanzando, tampoco enseña.
    assert.equal((await demo(pairId, 2)).body.data.demonstration.code, 'progressing');
    assert.equal((await proposal()).tutors.some((t) => t.id === ctx.ids.celia), false);
  });

  test('quien ya pasó 3/3 no aparece como tutorado y puede enseñar; cuenta en tutorsWhoWereTutees', async () => {
    const first = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    await demo(first.body.data.pairs[0].id, 3);
    const p = await proposal();
    const tutees = [...p.pairs.flatMap((x) => x.tutees), ...p.teacherTable].map((t) => t.id);
    assert.equal(tutees.includes(ctx.ids.celia), false);
    assert.equal(p.skills.find((s) => s.code === 'multiplication').tuteeCount, 2);
    const second = await create([{ tutorId: ctx.ids.celia, tuteeId: ctx.ids.eli }]);
    assert.equal(second.status, 201);
    const list = await server.call('GET', `${base()}/sessions`, { token: teacher() });
    assert.equal(list.body.data.network.tutorsWhoWereTuteesCount, 1);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM skill_mastery_history').get().n, 7, 'sin cortes nuevos');
  });

  test('validación del cuerpo de POST y PATCH: 400 VALIDATION_ERROR sin escribir', async () => {
    const t = teacher();
    const bad = [
      { skillCode: 'multiplication', pairs: [] },
      { skillCode: 'multiplication', pairs: Array.from({ length: 81 }, (_, i) => ({ tutorId: null, tuteeId: i + 1 })) },
      { skillCode: 'nope', pairs: [{ tutorId: null, tuteeId: ctx.ids.eli }] },
      { skillCode: 'multiplication', pairs: [{ tutorId: null, tuteeId: ctx.ids.eli }], extra: 1 },
      { skillCode: 'multiplication', pairs: [{ tutorId: null, tuteeId: ctx.ids.eli, errorTag: 'x' }] },
      { skillCode: 'multiplication', pairs: [{ tutorId: String(ctx.ids.ana), tuteeId: ctx.ids.eli }] },
      { skillCode: 'multiplication', pairs: [{ tutorId: ctx.ids.ana, tuteeId: 1.5 }] },
      { skillCode: 'multiplication', note: 'x'.repeat(301), pairs: [{ tutorId: null, tuteeId: ctx.ids.eli }] },
      { skillCode: 'multiplication', pairs: [{ tutorId: null, tuteeId: ctx.ids.eli }, { tutorId: ctx.ids.ana, tuteeId: ctx.ids.eli }] },
      { skillCode: 'multiplication', pairs: [{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }, { tutorId: ctx.ids.ana, tuteeId: ctx.ids.dani }, { tutorId: ctx.ids.ana, tuteeId: ctx.ids.eli }] },
      { skillCode: 'multiplication', pairs: [{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }, { tutorId: ctx.ids.celia, tuteeId: ctx.ids.dani }] },
    ];
    for (const body of bad) {
      const res = await server.call('POST', `${base()}/sessions`, { token: t, body });
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 120));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.equal(typeof res.body.error.message, 'string');
    }
    const ok = await create([{ tutorId: null, tuteeId: ctx.ids.eli }], t, { note: '  nota  ' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.note, 'nota');
    const pairId = ok.body.data.pairs[0].id;
    for (const body of [{}, { correct: -1 }, { correct: '3' }, { correct: 2.5 }, { correct: 3, extra: 1 }, []]) {
      const res = await server.call('PATCH', `${base()}/pairs/${pairId}/demonstration`, { token: t, body });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal((await server.call('PATCH', `${base()}/pairs/abc/demonstration`, { token: t, body: { correct: 1 } })).status, 400);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM tutoring_sessions').get().n, 1);
    assert.equal(ctx.db.prepare('SELECT demo_correct FROM tutoring_pairs WHERE id = ?').get(pairId).demo_correct, null);
  });

  test('banco insuficiente bloquea PDF y demostración sin modificar resultados; tres reactivos permiten continuar', async () => {
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    assert.equal(created.status, 201);
    const sessionId = created.body.data.id;
    const pairId = created.body.data.pairs[0].id;
    const questions = ctx.db.prepare('SELECT id FROM questions ORDER BY id').all();
    for (const count of [0, 1, 2]) {
      ctx.db.exec('UPDATE questions SET grade = 4');
      for (const question of questions.slice(0, count)) ctx.db.prepare('UPDATE questions SET grade = 3 WHERE id = ?').run(question.id);
      for (const part of ['cards', 'key']) {
        const result = await pdf(sessionId, teacher(), part);
        assert.equal(result.status, 422, `${count} reactivos, ${part}`);
        assert.equal(JSON.parse(result.bytes.toString()).error.code, 'INSUFFICIENT_DEMONSTRATION_QUESTIONS');
      }
      const result = await demo(pairId, 3);
      assert.equal(result.status, 422, `${count} reactivos, captura`);
      assert.equal(result.body.error.code, 'INSUFFICIENT_DEMONSTRATION_QUESTIONS');
      assert.equal(ctx.db.prepare('SELECT demo_correct FROM tutoring_pairs WHERE id = ?').get(pairId).demo_correct, null);
    }
    ctx.db.exec('UPDATE questions SET grade = 4');
    for (const question of questions.slice(0, 3)) ctx.db.prepare('UPDATE questions SET grade = 3 WHERE id = ?').run(question.id);
    assert.equal((await pdf(sessionId)).status, 200);
    assert.equal((await pdf(sessionId, teacher(), 'key')).status, 200);
    assert.equal((await demo(pairId, 3)).status, 200);
  });

  test('respuestas sin folio interno, hash de contraseña ni alumnos de otros grupos; formato { data, meta }', async () => {
    await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    for (const path of [`${base()}/proposal`, `${base()}/sessions`]) {
      const res = await server.call('GET', path, { token: teacher() });
      assert.ok('data' in res.body && 'meta' in res.body, path);
      const raw = JSON.stringify(res.body);
      for (const forbidden of ['FOLIO', 'internal_folio', 'HASH-SECRETO', 'password_hash', 'Hugo', 'curp']) {
        assert.equal(raw.toLowerCase().includes(forbidden.toLowerCase()), false, `${path} expone ${forbidden}`);
      }
    }
  });

  test('PDF sin parejas con tutor: tarjetas sin tarjeta de pareja; la hoja de la maestra lista la mesa', async () => {
    const created = await create([{ tutorId: null, tuteeId: ctx.ids.eli }, { tutorId: null, tuteeId: ctx.ids.dani }]);
    const cards = await pdf(created.body.data.id);
    assert.equal(cards.status, 200);
    const cardsText = pdfStreams(cards.bytes).join('\n');
    assert.equal(cardsText.includes('Compañero guía:'), false, 'no hay tarjeta de pareja');
    assert.equal(cardsText.includes('Eli') || cardsText.includes('Dani'), false, 'sin nombres en las tarjetas');
    assert.ok(cardsText.includes('Página 1 de 1'));
    const key = await pdf(created.body.data.id, teacher(), 'key');
    assert.equal(key.status, 200);
    assert.equal(key.type, 'application/pdf');
    const keyText = pdfStreams(key.bytes).join('\n');
    assert.ok(keyText.includes('Eli Ejemplo') && keyText.includes('Dani Ejemplo'));
    assert.ok(keyText.includes('Reactivo 1: cuanto es 1 x 4'), 'incluye la práctica aunque no haya tarjetas de parejas');
    assert.ok(keyText.includes('Mira los grupos') && keyText.includes('Cuenta de 4 en 4'), 'incluye pistas para la mesa docente');
    assert.ok(keyText.includes('A) 99') && keyText.includes('B) 4'), 'incluye las opciones de práctica');
    for (const n of [2, 3, 4]) {
      assert.ok(keyText.includes(`Reactivo ${n}: cuanto es ${n} x 4`), `incluye demostración ${n}`);
      assert.ok(keyText.includes(`B) ${n * 4}`), `incluye opciones de demostración ${n}`);
    }
    assert.equal(keyText.includes('FOLIO'), false);
    const sharedMaterial = pdfStreams(key.bytes).filter((page) => page.includes('Material para la mesa docente'));
    assert.equal(sharedMaterial.length, 2, 'dos alumnos comparten un juego de guía y demostración');
    for (const page of sharedMaterial) assert.ok(page.includes('Eli Ejemplo') && page.includes('Dani Ejemplo'), 'ambos alumnos aparecen en el mismo material');
  });

  test('PDF: las tarjetas no revelan la clave ni atribuyen errores; solo key.pdf trae la clave', async () => {
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }, { tutorId: ctx.ids.beto, tuteeId: ctx.ids.dani }]);
    const cardStreams = pdfStreams((await pdf(created.body.data.id)).bytes);
    const guides = cardStreams.filter((page) => page.includes('Pista 1'));
    const demonstrations = cardStreams.filter((page) => page.includes('Respuesta: ______'));
    assert.equal(guides.length, 2, 'cada pareja recibe una guía');
    assert.equal(demonstrations.length, 2, 'cada pareja recibe una demostración separada');
    for (const card of cardStreams) {
      assert.equal(/clave|SOLO PARA DOCENTES/i.test(card), false);
      assert.equal(/Reactivo \d: cuanto es \d x 4\s+\S+\s+B\s*$/m.test(card), false, 'ningún enunciado con su letra correcta');
      assert.equal(/Tu compañero a veces/.test(card), false, 'no atribuye el error al alumno');
    }
    for (const card of guides) {
      assert.ok(card.includes('Pista 1') && card.includes('Pista 2') && card.includes('Pista 3'));
      assert.ok(card.indexOf('Pista 1') < card.indexOf('Pista 2') && card.indexOf('Pista 2') < card.indexOf('Pista 3'), 'pistas en orden');
      assert.equal(card.includes('Respuesta: ______'), false, 'las pistas van separadas del trabajo individual');
    }
    for (const card of demonstrations) {
      assert.equal(/Pista [123]/.test(card), false, 'la demostración se resuelve sin pistas en su página');
      assert.ok(card.includes('Respuesta: ______'));
    }
    const key = pdfStreams((await pdf(created.body.data.id, teacher(), 'key')).bytes).join('\n');
    assert.ok(key.includes('SOLO PARA DOCENTES'));
    const keyLines = key.split('\n').filter((line) => line.startsWith('Reactivo'));
    assert.equal(keyLines.length, 3);
    for (const line of keyLines) assert.match(line, /B$/);
    // La hoja de la maestra también se acota: otra escuela → 404, alumno → 403.
    assert.equal((await pdf(created.body.data.id, as(ctx.otherDirector, 'director', ctx.otherSchool), 'key')).status, 404);
    assert.equal((await pdf(created.body.data.id, tokenFor({ sub: String(ctx.ids.celia), role: 'student', schoolId: ctx.school }), 'key')).status, 403);
  });

  test('PDF conserva nombres largos completos y separa guía y demostración sin páginas vacías', async () => {
    const firstNames = 'María Fernanda Alejandra Guadalupe';
    const lastNames = 'Hernández de los Santos Martínez del Valle';
    ctx.db.prepare('UPDATE students SET first_names = ?, last_names = ? WHERE id = ?').run(firstNames, lastNames, ctx.ids.ana);
    ctx.db.prepare('UPDATE students SET first_names = ?, last_names = ? WHERE id = ?').run('José Leonardo Maximiliano Santiago', 'González de la Cruz Rodríguez del Río', ctx.ids.celia);
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    assert.equal(created.status, 201);
    const file = await pdf(created.body.data.id);
    assert.equal(file.status, 200);
    const pages = pdfStreams(file.bytes);
    const normal = (value) => value.replace(/\s+/g, ' ');
    const text = normal(pages.join('\n'));
    assert.ok(text.includes(`${firstNames} ${lastNames}`), 'el nombre completo del compañero guía no se corta');
    assert.ok(text.includes('José Leonardo Maximiliano Santiago González de la Cruz Rodríguez del Río'), 'el nombre completo de quien practica no se corta');
    assert.equal(pages.filter((page) => page.includes('Pista 1')).length, 1);
    assert.equal(pages.filter((page) => page.includes('Respuesta: ______')).length, 1);
    assert.ok(pages.every((page) => page.replace(/Uso escolar privado[^\n]*|Página \d+ de \d+/g, '').trim().length > 40), 'no hay páginas con solo pie');
    assert.match(file.bytes.toString('latin1'), /\/MediaBox \[0 0 612 792\]/, 'formato Carta');
  });

  test('PDF: la clave se imprime legible (sin caracteres fuera de WinAnsi)', async () => {
    const created = await create([{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }]);
    const key = pdfStreams((await pdf(created.body.data.id, teacher(), 'key')).bytes).join('\n');
    const line = key.split('\n').find((l) => l.startsWith('Reactivo'));
    assert.ok(line, 'hay línea de clave');
    // PDFKit con Helvetica (WinAnsi) no tiene "→": lo imprime como "!" o lo omite.
    assert.equal(/4\s+B$/.test(line), false, `falta el separador legible: ${JSON.stringify(line)}`);
    assert.equal(line.includes('!'), false, `línea de clave ilegible: ${JSON.stringify(line)}`);
  });
});

describe('tutoring domain — guion sin respuesta', () => {
  test('buildCardScript no incluye opciones, letra correcta ni etiquetas de error', () => {
    const q = { id: 1, stem: 'S', hint_1: 'h1', hint_2: 'h2', hint_3: 'h3', correctLabel: 'B',
      options: [{ label: 'B', text: '8' }], errorTags: ['x'] };
    const script = buildCardScript(q);
    assert.deepEqual(Object.keys(script).sort(), ['stem', 'steps']);
    assert.deepEqual(script.steps.map((s) => [s.level, s.text]), [[1, 'h1'], [2, 'h2'], [3, 'h3']]);
    assert.equal(JSON.stringify(script).includes('"B"'), false);
    assert.equal(buildCardScript(null), null);
  });

  test('chooseCardQuestions: la práctica nunca se repite en la demostración y máximo 3', () => {
    const qs = [1, 2, 3, 4, 5].map((id) => ({ id, errorTags: id === 4 ? ['t'] : [] }));
    const { practice, demonstration } = chooseCardQuestions(qs, 't');
    assert.equal(practice.id, 4);
    assert.deepEqual(demonstration.map((q) => q.id), [1, 2, 3]);
    const none = chooseCardQuestions([], 't');
    assert.equal(none.practice, null);
    assert.deepEqual(none.demonstration, []);
  });
});
