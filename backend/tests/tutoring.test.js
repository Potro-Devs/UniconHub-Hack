import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

function fixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);
  const school = insert("INSERT INTO schools (name) VALUES ('Escuela ficticia')");
  const otherSchool = insert("INSERT INTO schools (name) VALUES ('Otra escuela')");
  const user = (email, role, schoolId = school) => insert("INSERT INTO users (school_id,email,password_hash,full_name,role) VALUES (?,?,'x','Persona ficticia',?)", schoolId, email, role);
  const teacher = user('t@tut.test', 'teacher');
  const otherTeacher = user('o@tut.test', 'teacher');
  const director = user('d@tut.test', 'director');
  const groupId = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'A','2026-2027','TUTR3A')", school, teacher);
  const skill = insert("INSERT INTO skills (code,name) VALUES ('multiplication','Multiplicación')");
  insert("INSERT INTO skills (code,name) VALUES ('fractions','Fracciones')");
  const questionIds = [1, 2, 3, 4].map((n) => insert("INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3) VALUES (?,3,?,'Mira los grupos','Cuenta de 4 en 4','Ejemplo: 2 × 5 = 10')", skill, `¿Cuánto es ${n} × 4?`));
  const options = questionIds.map((q, i) => ({
    correct: insert("INSERT INTO question_options (question_id,label,text,is_correct) VALUES (?,'A',?,1)", q, String((i + 1) * 4)),
    wrong: insert("INSERT INTO question_options (question_id,label,text,is_correct,error_tag,error_explanation) VALUES (?,'B','99',0,'adds_instead','Suma los dos números en lugar de juntar grupos iguales.')", q),
  }));
  const assignment = insert("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'Prueba','screen')", groupId, teacher);
  const student = (name, mastery) => {
    const id = insert("INSERT INTO students (school_id,internal_folio,first_names,last_names,initials,avatar_color) VALUES (?,?,?,'Ejemplo','AE','#123456')", school, `FOLIO-${name}`, name);
    insert("INSERT INTO group_enrollments (group_id,student_id,status) VALUES (?,?,'active')", groupId, id);
    const level = mastery < 25 ? 'needs_support' : mastery < 50 ? 'in_progress' : mastery < 75 ? 'achieved' : 'mastered';
    insert(`INSERT INTO skill_mastery_history (student_id,skill_id,assignment_id,grade,session_index,session_percentage,
      autonomous_percentage,supported_percentage,mastery_percentage,mastery_level) VALUES (?,?,?,3,1,?,?,0,?,?)`, id, skill, assignment, mastery, mastery, mastery, level);
    return id;
  };
  const ids = { ana: student('Ana', 100), beto: student('Beto', 80), celia: student('Celia', 40), dani: student('Dani', 30), eli: student('Eli', 10), fer: student('Fer', 60) };
  const wrongAnswer = (studentId, assignmentId) => {
    const target = insert("INSERT INTO assignment_targets (assignment_id,student_id,status) VALUES (?,?,'completed_screen')", assignmentId, studentId);
    insert("INSERT INTO student_responses (assignment_target_id,question_id,selected_option_id,outcome_status,error_tag,source) VALUES (?,?,?,'incorrect','adds_instead','screen')", target, questionIds[0], options[0].wrong);
  };
  for (const id of [ids.celia, ids.dani, ids.eli]) wrongAnswer(id, assignment);
  // Beto tuvo el mismo error en una prueba anterior y hoy domina la habilidad.
  wrongAnswer(ids.beto, insert("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'Anterior','screen')", groupId, teacher));
  const foreign = insert("INSERT INTO students (school_id,internal_folio,first_names,last_names,initials,avatar_color) VALUES (?,'FOLIO-X','Xime','Otra','XO','#123456')", otherSchool);
  return { db, school, teacher, otherTeacher, director, groupId, ids, foreign };
}

describe('tutoring API', () => {
  let ctx; let server;
  const as = (sub, role) => tokenFor({ sub: String(sub), role, schoolId: ctx.school });
  const base = () => `/api/v1/tutoring/groups/${ctx.groupId}`;
  beforeEach(async () => {
    ctx = fixtures();
    server = await startServer(createApp({ db: ctx.db, config: configWith(), logger: silentLogger }));
  });
  afterEach(async () => { await server.close(); ctx.db.close(); });

  test('propone parejas: tutor que superó el error, tope de 2 y mesa de la maestra', async () => {
    const res = await server.call('GET', `${base()}/proposal`, { token: as(ctx.teacher, 'teacher') });
    assert.equal(res.status, 200);
    const { skill, pairs, teacherTable, skills } = res.body.data;
    assert.equal(skill.code, 'multiplication');
    assert.deepEqual(skills.find((s) => s.code === 'multiplication'), { code: 'multiplication', name: 'Multiplicación', tutorCount: 2, tuteeCount: 3 });
    const beto = pairs.find((p) => p.tutor.id === ctx.ids.beto);
    assert.equal(beto.tutees[0].tutorOvercameError, true);
    assert.equal(beto.tutees[0].explanation, 'Suma los dos números en lugar de juntar grupos iguales.');
    assert.equal(pairs.flatMap((p) => p.tutees).length + teacherTable.length, 3);
    assert.equal(pairs.flatMap((p) => p.tutees).some((t) => t.id === ctx.ids.fer), false, 'Logrado no recibe tutoría');
    assert.equal(JSON.stringify(res.body).includes('FOLIO'), false, 'nunca expone folios');
  });

  test('habilidad sin tutores deja a todos con la maestra; habilidad desconocida → 404', async () => {
    const res = await server.call('GET', `${base()}/proposal?skillCode=fractions`, { token: as(ctx.teacher, 'teacher') });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.pairs, []);
    const bad = await server.call('GET', `${base()}/proposal?skillCode=nope`, { token: as(ctx.teacher, 'teacher') });
    assert.equal(bad.status, 404);
  });

  test('ciclo completo: guardar, demostrar 3/3 y el tutorado pasa a ser tutor', async () => {
    const token = as(ctx.teacher, 'teacher');
    const created = await server.call('POST', `${base()}/sessions`, { token, body: { skillCode: 'multiplication', pairs: [
      { tutorId: ctx.ids.beto, tuteeId: ctx.ids.celia }, { tutorId: ctx.ids.ana, tuteeId: ctx.ids.dani }, { tutorId: null, tuteeId: ctx.ids.eli }] } });
    assert.equal(created.status, 201);
    const celiaPair = created.body.data.pairs.find((p) => p.tutee.id === ctx.ids.celia);
    assert.equal(celiaPair.tutorOvercameError, true);
    assert.equal(celiaPair.errorTag, 'adds_instead');
    assert.equal(created.body.data.pairs.find((p) => p.tutee.id === ctx.ids.eli).tutor, null);

    const demo = await server.call('PATCH', `${base()}/pairs/${celiaPair.id}/demonstration`, { token, body: { correct: 3 } });
    assert.equal(demo.status, 200);
    assert.equal(demo.body.data.demonstration.code, 'ready_to_teach');

    const history = ctx.db.prepare('SELECT COUNT(*) AS n FROM skill_mastery_history').get().n;
    assert.equal(history, 6, 'la demostración no escribe en el dominio oficial');

    const proposal = await server.call('GET', `${base()}/proposal?skillCode=multiplication`, { token });
    assert.ok(proposal.body.data.tutors.some((t) => t.id === ctx.ids.celia), 'Celia ya puede enseñar');

    const list = await server.call('GET', `${base()}/sessions`, { token: as(ctx.director, 'director') });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.sessions.length, 1);
    const { network } = list.body.data;
    assert.equal(network.teachSomethingCount, 3);
    assert.equal(network.errors[0].readyToTeachCount, 1);
    assert.deepEqual(network.students.find((s) => s.id === ctx.ids.celia).canTeach.map((s) => s.code), ['multiplication']);
  });

  test('rechaza tutores que no dominan, alumnos ajenos y otros docentes', async () => {
    const token = as(ctx.teacher, 'teacher');
    const notReady = await server.call('POST', `${base()}/sessions`, { token, body: { skillCode: 'multiplication', pairs: [{ tutorId: ctx.ids.fer, tuteeId: ctx.ids.celia }] } });
    assert.equal(notReady.status, 422);
    assert.equal(notReady.body.error.code, 'TUTOR_NOT_READY');
    const foreign = await server.call('POST', `${base()}/sessions`, { token, body: { skillCode: 'multiplication', pairs: [{ tutorId: ctx.ids.ana, tuteeId: ctx.foreign }] } });
    assert.equal(foreign.status, 404);
    const invalid = await server.call('POST', `${base()}/sessions`, { token, body: { skillCode: 'multiplication', pairs: [{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.ana }] } });
    assert.equal(invalid.status, 400);
    const other = await server.call('GET', `${base()}/proposal`, { token: as(ctx.otherTeacher, 'teacher') });
    assert.equal(other.status, 404);
    const director = await server.call('POST', `${base()}/sessions`, { token: as(ctx.director, 'director'), body: { skillCode: 'multiplication', pairs: [{ tutorId: null, tuteeId: ctx.ids.eli }] } });
    assert.equal(director.status, 403);
    const anonymous = await server.call('GET', `${base()}/proposal`);
    assert.equal(anonymous.status, 401);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM tutoring_sessions').get().n, 0);
  });

  test('demostración inválida o de otra pareja; tarjetas en PDF', async () => {
    const token = as(ctx.teacher, 'teacher');
    const created = await server.call('POST', `${base()}/sessions`, { token, body: { skillCode: 'multiplication', pairs: [{ tutorId: ctx.ids.ana, tuteeId: ctx.ids.celia }] } });
    const pairId = created.body.data.pairs[0].id;
    assert.equal((await server.call('PATCH', `${base()}/pairs/${pairId}/demonstration`, { token, body: { correct: 4 } })).status, 400);
    assert.equal((await server.call('PATCH', `${base()}/pairs/9999/demonstration`, { token, body: { correct: 1 } })).status, 404);

    // `startServer.call` solo lee JSON; para el PDF se levanta un servidor propio.
    const app = createApp({ db: ctx.db, config: configWith(), logger: silentLogger });
    const listener = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => listener.once('listening', resolve));
    try {
      const url = `http://127.0.0.1:${listener.address().port}${base()}/sessions/${created.body.data.id}/cards.pdf`;
      const pdf = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(pdf.status, 200);
      assert.equal(pdf.headers.get('content-type'), 'application/pdf');
      const bytes = Buffer.from(await pdf.arrayBuffer());
      assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
      const missing = await fetch(url.replace(/sessions\/\d+/, 'sessions/9999'), { headers: { authorization: `Bearer ${token}` } });
      assert.equal(missing.status, 404);
    } finally { await new Promise((resolve) => listener.close(resolve)); }
  });

  test('solo propone habilidades del programa del grado (sin fracciones ni multiplicación en 1.º)', async () => {
    ctx.db.prepare('UPDATE groups SET grade = 1 WHERE id = ?').run(ctx.groupId);
    const token = as(ctx.teacher, 'teacher');
    for (const code of ['fractions', 'multiplication']) {
      const res = await server.call('GET', `${base()}/proposal?skillCode=${code}`, { token });
      assert.equal(res.status, 404, code);
    }
    const any = await server.call('GET', `${base()}/proposal`, { token });
    if (any.status === 200) {
      assert.ok(!any.body.data.skills.some((s) => ['fractions', 'multiplication'].includes(s.code)));
    }
  });
});
