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
  const user = (email, role) => insert("INSERT INTO users (school_id,email,password_hash,full_name,role) VALUES (?,?,'x','Persona ficticia',?)", school, email, role);
  const teacher = user('t@interv.test', 'teacher');
  const otherTeacher = user('o@interv.test', 'teacher');
  const director = user('d@interv.test', 'director');
  const groupId = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'A','2026-2027','INTV3A')", school, teacher);
  const student = (name) => {
    const id = insert("INSERT INTO students (school_id,internal_folio,first_names,last_names,initials,avatar_color) VALUES (?,?,?,'Ejemplo','AE','#123456')", school, `FOLIO-${name}`, name);
    insert("INSERT INTO group_enrollments (group_id,student_id,status) VALUES (?,?,'active')", groupId, id);
    return id;
  };
  const [ana, beto, celia, dani] = ['Ana', 'Beto', 'Celia', 'Dani'].map(student);
  const fractions = insert("INSERT INTO skills (code,name) VALUES ('fractions','Fracciones')");
  const activity = insert("INSERT INTO recommended_activities (skill_id,grade_min,grade_max,title,description,duration_minutes,grouping,target_error_tag) VALUES (?,3,3,'Tiras de papel','Por validar',15,'En parejas','add_across')", fractions);
  const sixthOnly = insert("INSERT INTO recommended_activities (skill_id,grade_min,grade_max,title,description) VALUES (?,6,6,'Solo sexto','Por validar')", fractions);
  const question = insert("INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3) VALUES (?,3,'Ejemplo','Uno','Dos','Tres')", fractions);
  const correct = insert("INSERT INTO question_options (question_id,label,text,is_correct) VALUES (?,'A','Correcta',1)", question);
  const wrong = insert("INSERT INTO question_options (question_id,label,text,is_correct,error_tag,error_explanation) VALUES (?,'B','Distractor',0,'add_across','Suma numeradores y denominadores')", question);
  const answer = (studentId, correctAnswer, when) => {
    const assignment = insert("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'Prueba','screen')", groupId, teacher);
    const target = insert("INSERT INTO assignment_targets (assignment_id,student_id,status) VALUES (?,?,'completed_screen')", assignment, studentId);
    insert(`INSERT INTO student_responses (assignment_target_id,question_id,selected_option_id,outcome_status,error_tag,source,answered_at)
      VALUES (?,?,?,?,?,'screen',${when})`, target, question, correctAnswer ? correct : wrong,
    correctAnswer ? 'correct_autonomous' : 'incorrect', correctAnswer ? null : 'add_across');
  };
  const answerQuestion = (studentId, questionId, optionId, outcome, errorTag, when) => {
    const assignment = insert("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'Prueba','screen')", groupId, teacher);
    const target = insert("INSERT INTO assignment_targets (assignment_id,student_id,status) VALUES (?,?,'completed_screen')", assignment, studentId);
    insert(`INSERT INTO student_responses (assignment_target_id,question_id,selected_option_id,outcome_status,error_tag,source,answered_at)
      VALUES (?,?,?,?,?,'screen',${when})`, target, questionId, optionId, outcome, errorTag);
  };
  // Antes: Ana, Beto y Celia muestran el error; Dani no.
  for (const id of [ana, beto, celia]) answer(id, false, "'2026-09-25 09:00:00'");
  answer(dani, true, "'2026-09-25 09:00:00'");
  return { db, groupId, teacher, otherTeacher, director, school, activity, sixthOnly, ana, beto, dani, answer, answerQuestion };
}

describe('interventions API', () => {
  let ctx; let server;
  const as = (sub, role) => tokenFor({ sub: String(sub), role, schoolId: ctx.school });
  beforeEach(async () => {
    ctx = fixtures();
    server = await startServer(createApp({ db: ctx.db, config: configWith(), logger: silentLogger }));
  });
  afterEach(async () => { await server.close(); ctx.db.close(); });

  test('el docente registra la actividad y queda en espera de nueva prueba', async () => {
    const res = await server.call('POST', `/api/v1/interventions/groups/${ctx.groupId}`,
      { token: as(ctx.teacher, 'teacher'), body: { activityId: ctx.activity, note: ' Con tiras de papel ' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.note, 'Con tiras de papel');
    assert.equal(res.body.data.targetErrorTag, 'add_across');
    assert.equal(res.body.data.errorExplanation, 'Suma numeradores y denominadores');
    assert.deepEqual(res.body.data.outcome, { status: 'awaiting_retest', baselineCount: 3, reevaluatedCount: 0,
      overcameCount: 0, stillWithErrorCount: 0, awaitingCount: 3 });
  });

  test('después de la nueva prueba compara a los mismos alumnos', async () => {
    await server.call('POST', `/api/v1/interventions/groups/${ctx.groupId}`, { token: as(ctx.teacher, 'teacher'), body: { activityId: ctx.activity } });
    ctx.answer(ctx.ana, true, "datetime('now', '+1 minute')");
    ctx.answer(ctx.beto, false, "datetime('now', '+1 minute')");
    ctx.answer(ctx.dani, false, "datetime('now', '+1 minute')");
    const res = await server.call('GET', `/api/v1/interventions/groups/${ctx.groupId}`, { token: as(ctx.director, 'director') });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.interventions.length, 1);
    assert.deepEqual(res.body.data.interventions[0].outcome, { status: 'measured', baselineCount: 3, reevaluatedCount: 2,
      overcameCount: 1, stillWithErrorCount: 1, awaitingCount: 1 });
    assert.doesNotMatch(JSON.stringify(res.body), /FOLIO|Ana|Beto/);
  });

  test('cuenta respuestas posteriores aunque tengan el mismo segundo que la intervención', async () => {
    await server.call('POST', `/api/v1/interventions/groups/${ctx.groupId}`,
      { token: as(ctx.teacher, 'teacher'), body: { activityId: ctx.activity } });
    ctx.answer(ctx.ana, true, "'2026-09-25 09:00:00'");
    const res = await server.call('GET', `/api/v1/interventions/groups/${ctx.groupId}`, { token: as(ctx.teacher, 'teacher') });
    assert.deepEqual(res.body.data.interventions[0].outcome, { status: 'measured', baselineCount: 3, reevaluatedCount: 1,
      overcameCount: 1, stillWithErrorCount: 0, awaitingCount: 2 });
  });

  test('la línea base usa solo la evaluación previa más reciente por alumno', async () => {
    ctx.answer(ctx.ana, true, "'2026-09-25 09:00:00'");
    const res = await server.call('POST', `/api/v1/interventions/groups/${ctx.groupId}`,
      { token: as(ctx.teacher, 'teacher'), body: { activityId: ctx.activity } });
    assert.equal(res.body.data.outcome.baselineCount, 2);
    assert.equal(res.body.data.outcome.awaitingCount, 2);
  });

  test('no cuenta reevaluaciones en reactivos que no contienen el error objetivo', async () => {
    await server.call('POST', `/api/v1/interventions/groups/${ctx.groupId}`,
      { token: as(ctx.teacher, 'teacher'), body: { activityId: ctx.activity } });
    const question = Number(ctx.db.prepare(`INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3)
      VALUES ((SELECT id FROM skills WHERE code='fractions'),3,'Otro reactivo','Uno','Dos','Tres')`).run().lastInsertRowid);
    const correct = Number(ctx.db.prepare("INSERT INTO question_options (question_id,label,text,is_correct) VALUES (?,'A','Correcta',1)")
      .run(question).lastInsertRowid);
    ctx.answerQuestion(ctx.ana, question, correct, 'correct_autonomous', null, "'2026-09-25 09:00:00'");
    const res = await server.call('GET', `/api/v1/interventions/groups/${ctx.groupId}`, { token: as(ctx.teacher, 'teacher') });
    assert.deepEqual(res.body.data.interventions[0].outcome, { status: 'awaiting_retest', baselineCount: 3, reevaluatedCount: 0,
      overcameCount: 0, stillWithErrorCount: 0, awaitingCount: 3 });
  });

  test('no toma la explicación de un error etiquetado en otra habilidad', async () => {
    const fractions = ctx.db.prepare("SELECT id FROM skills WHERE code='fractions'").get().id;
    const unrelatedSkill = Number(ctx.db.prepare("INSERT INTO skills (code,name) VALUES ('multiplication','Multiplicaciones')")
      .run().lastInsertRowid);
    const activity = Number(ctx.db.prepare(`INSERT INTO recommended_activities
      (skill_id,grade_min,grade_max,title,description,target_error_tag)
      VALUES (?,3,3,'Actividad ficticia','Por validar','tag_solo_otra_habilidad')`).run(fractions).lastInsertRowid);
    const question = Number(ctx.db.prepare(`INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3)
      VALUES (?,3,'Otro reactivo','Uno','Dos','Tres')`).run(unrelatedSkill).lastInsertRowid);
    ctx.db.prepare(`INSERT INTO question_options
      (question_id,label,text,is_correct,error_tag,error_explanation)
      VALUES (?,'B','Distractor',0,'tag_solo_otra_habilidad','Explicación ajena')`).run(question);
    const res = await server.call('POST', `/api/v1/interventions/groups/${ctx.groupId}`,
      { token: as(ctx.teacher, 'teacher'), body: { activityId: activity } });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.errorExplanation, null);
  });

  test('valida cuerpo y catálogo del grado', async () => {
    const token = as(ctx.teacher, 'teacher');
    const path = `/api/v1/interventions/groups/${ctx.groupId}`;
    assert.equal((await server.call('POST', path, { token, body: { activityId: '1' } })).status, 400);
    assert.equal((await server.call('POST', path, { token, body: { activityId: ctx.activity, studentId: ctx.ana } })).status, 400);
    const foreign = await server.call('POST', path, { token, body: { activityId: ctx.sixthOnly } });
    assert.equal(foreign.status, 404);
    assert.equal(foreign.body.error.code, 'ACTIVITY_NOT_FOUND');
  });

  test('solo el docente dueño registra; director solo consulta; alumnos y ajenos no', async () => {
    const path = `/api/v1/interventions/groups/${ctx.groupId}`;
    const body = { activityId: ctx.activity };
    assert.equal((await server.call('POST', path, { body })).status, 401);
    assert.equal((await server.call('POST', path, { token: as(ctx.director, 'director'), body })).status, 403);
    assert.equal((await server.call('POST', path, { token: as(ctx.otherTeacher, 'teacher'), body })).status, 404);
    assert.equal((await server.call('GET', path, { token: as(ctx.otherTeacher, 'teacher') })).status, 404);
    assert.equal((await server.call('GET', path, { token: tokenFor({ sub: String(ctx.ana), role: 'student', schoolId: ctx.school, groupId: ctx.groupId }) })).status, 403);
  });

  describe('antes y después por prueba completa', () => {
    const register = () => server.call('POST', `/api/v1/interventions/groups/${ctx.groupId}`,
      { token: as(ctx.teacher, 'teacher'), body: { activityId: ctx.activity } });
    const outcome = async () => (await server.call('GET', `/api/v1/interventions/groups/${ctx.groupId}`,
      { token: as(ctx.teacher, 'teacher') })).body.data.interventions[0].outcome;

    test('si en la última reevaluación ya no muestra el error, cuenta como superado', async () => {
      await register();
      ctx.answer(ctx.beto, false, "datetime('now', '+1 minute')"); // primera reevaluación: aún con el error
      ctx.answer(ctx.beto, true, "datetime('now', '+2 minutes')"); // segunda: ya no
      assert.deepEqual(await outcome(), { status: 'measured', baselineCount: 3, reevaluatedCount: 1,
        overcameCount: 1, stillWithErrorCount: 0, awaitingCount: 2 });
    });

    test('una prueba en curso al registrar la actividad no se parte en antes y después', async () => {
      const q2 = Number(ctx.db.prepare(`INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3)
        VALUES ((SELECT id FROM skills WHERE code='fractions'),3,'Segundo reactivo','Uno','Dos','Tres')`).run().lastInsertRowid);
      const q2ok = Number(ctx.db.prepare("INSERT INTO question_options (question_id,label,text,is_correct) VALUES (?,'A','Correcta',1)")
        .run(q2).lastInsertRowid);
      // El segundo reactivo también permite mostrar el error objetivo (caso real de una prueba de la habilidad).
      ctx.db.prepare("INSERT INTO question_options (question_id,label,text,is_correct,error_tag,error_explanation) VALUES (?,'B','Distractor',0,'add_across','Suma numeradores y denominadores')")
        .run(q2);
      const q1 = ctx.db.prepare("SELECT id FROM questions WHERE stem = 'Ejemplo'").get().id;
      const q1wrong = ctx.db.prepare("SELECT id FROM question_options WHERE question_id = ? AND is_correct = 0").get(q1).id;
      const assignment = Number(ctx.db.prepare("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'En curso','screen')")
        .run(ctx.groupId, ctx.teacher).lastInsertRowid);
      const target = Number(ctx.db.prepare("INSERT INTO assignment_targets (assignment_id,student_id,status) VALUES (?,?,'in_progress')")
        .run(assignment, ctx.dani).lastInsertRowid);
      const respond = (questionId, optionId, status, tag) => ctx.db.prepare(`INSERT INTO student_responses
        (assignment_target_id,question_id,selected_option_id,outcome_status,error_tag,source) VALUES (?,?,?,?,?,'screen')`)
        .run(target, questionId, optionId, status, tag);
      respond(q1, q1wrong, 'incorrect', 'add_across'); // Dani contesta la 1 (con el error) antes del registro
      await register();
      respond(q2, q2ok, 'correct_autonomous', null); // termina la misma prueba después del registro
      ctx.db.prepare("UPDATE assignment_targets SET status = 'completed_screen' WHERE id = ?").run(target);
      // Toda la prueba cuenta como "antes": Dani entra a la línea base y no hay reevaluación falsa.
      assert.deepEqual(await outcome(), { status: 'awaiting_retest', baselineCount: 4, reevaluatedCount: 0,
        overcameCount: 0, stillWithErrorCount: 0, awaitingCount: 4 });
    });

    test('una prueba posterior sin el distractor objetivo no saca a nadie de la línea base', async () => {
      const q = Number(ctx.db.prepare(`INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3)
        VALUES ((SELECT id FROM skills WHERE code='fractions'),3,'Sin distractor objetivo','Uno','Dos','Tres')`).run().lastInsertRowid);
      const ok = Number(ctx.db.prepare("INSERT INTO question_options (question_id,label,text,is_correct) VALUES (?,'A','Correcta',1)")
        .run(q).lastInsertRowid);
      ctx.answerQuestion(ctx.ana, q, ok, 'correct_autonomous', null, "'2026-09-26 09:00:00'");
      const res = await register();
      assert.equal(res.body.data.outcome.baselineCount, 3);
    });
  });
});

describe('analytics: avance hacia la autonomía y plan de mañana', () => {
  test('el resumen del grupo incluye autonomyProgress y nextStep con alumnos distintos por error', async () => {
    const ctx = fixtures();
    const insert = (sql, ...args) => ctx.db.prepare(sql).run(...args);
    const skill = ctx.db.prepare("SELECT id FROM skills WHERE code = 'fractions'").get().id;
    const cut = (studentId, index, autonomous, supported, mastery) => insert(
      'INSERT INTO skill_mastery_history (student_id,skill_id,grade,session_index,session_percentage,autonomous_percentage,supported_percentage,mastery_percentage,mastery_level) VALUES (?,?,3,?,?,?,?,?,?)',
      studentId, skill, index, autonomous, autonomous, supported, mastery,
      mastery < 25 ? 'needs_support' : mastery < 50 ? 'in_progress' : mastery < 75 ? 'achieved' : 'mastered');
    cut(ctx.ana, 1, 20, 40, 20); cut(ctx.ana, 2, 60, 10, 46.67);
    cut(ctx.beto, 1, 30, 0, 30);
    const server = await startServer(createApp({ db: ctx.db, config: configWith(), logger: silentLogger }));
    try {
      const res = await server.call('GET', `/api/v1/analytics/groups/${ctx.groupId}`, { token: tokenFor({ sub: String(ctx.teacher), role: 'teacher', schoolId: ctx.school }) });
      assert.equal(res.status, 200);
      const { autonomyProgress, nextStep, typicalErrors } = res.body.data.summary;
      assert.equal(autonomyProgress.comparedStudentCount, 1);
      assert.equal(autonomyProgress.fromSupportStudentCount, 1);
      assert.deepEqual(autonomyProgress.highlight, { skillCode: 'fractions', skillName: 'Fracciones', studentCount: 1 });
      assert.equal(typicalErrors[0].studentCount, 3);
      assert.equal(nextStep.skillCode, 'fractions');
      assert.equal(nextStep.currentGradeEvidence, true);
      assert.deepEqual(nextStep.error, { errorTag: 'add_across', explanation: 'Suma numeradores y denominadores', studentCount: 3 });
      assert.equal(nextStep.activity.id, ctx.activity);
      const anaRow = res.body.data.students.find((entry) => entry.name.startsWith('Ana'));
      assert.equal(anaRow.skills[0].autonomyTrend.trend, 'toward_autonomy');
    } finally { await server.close(); ctx.db.close(); }
  });

  test('no propone actividad si la habilidad prioritaria solo tiene historial de otro grado', async () => {
    const ctx = fixtures();
    const skill = ctx.db.prepare("SELECT id FROM skills WHERE code = 'fractions'").get().id;
    ctx.db.prepare(`INSERT INTO skill_mastery_history
      (student_id,skill_id,grade,session_index,session_percentage,autonomous_percentage,supported_percentage,mastery_percentage,mastery_level)
      VALUES (?, ?, 2, 1, 20, 20, 0, 20, 'needs_support')`).run(ctx.ana, skill);
    const server = await startServer(createApp({ db: ctx.db, config: configWith(), logger: silentLogger }));
    try {
      const res = await server.call('GET', `/api/v1/analytics/groups/${ctx.groupId}`, {
        token: tokenFor({ sub: String(ctx.teacher), role: 'teacher', schoolId: ctx.school }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.summary.nextStep.currentGradeEvidence, false);
      assert.equal(res.body.data.summary.nextStep.activity, null);
      assert.equal(res.body.data.summary.recommendedActivity, null);
    } finally { await server.close(); ctx.db.close(); }
  });
});
