import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

function fixtures() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);
  const school = insert("INSERT INTO schools (name) VALUES ('Escuela ficticia A')");
  const otherSchool = insert("INSERT INTO schools (name) VALUES ('Escuela ficticia B')");
  const user = (schoolId, email, role) => insert("INSERT INTO users (school_id,email,password_hash,full_name,role) VALUES (?,?,'hidden-hash','Persona ficticia',?)", schoolId, email, role);
  const teacher = user(school, 'teacher@analytics.test', 'teacher');
  const otherTeacher = user(school, 'other@analytics.test', 'teacher');
  const director = user(school, 'director@analytics.test', 'director');
  const otherDirector = user(otherSchool, 'foreign@analytics.test', 'director');
  const group = (teacherId, grade, year, code) => insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,?,'A',?,?)", school, teacherId, grade, year, code);
  const groupId = group(teacher, 3, '2026-2027', 'ANAL3A');
  const older1 = group(teacher, 1, '2024-2025', 'ANAL1A');
  const older2 = group(teacher, 2, '2025-2026', 'ANAL2A');
  const otherGroup = group(otherTeacher, 4, '2026-2027', 'ANAL4A');
  const emptyGroup = group(teacher, 6, '2026-2027', 'ANAL6A');
  const student = (name, folio, currentGroup = groupId) => {
    const id = insert("INSERT INTO students (school_id,internal_folio,first_names,last_names,initials,avatar_color) VALUES (?,?,?,'Ejemplo','AE','#123456')", school, folio, name);
    insert("INSERT INTO group_enrollments (group_id,student_id,status) VALUES (?,?,'active')", currentGroup, id);
    return id;
  };
  const ana = student('Ana', 'PRIVATE-FOLIO-ANA');
  const beto = student('Beto', 'PRIVATE-FOLIO-BETO');
  const celia = student('Celia', 'PRIVATE-FOLIO-CELIA');
  const foreign = student('Persona ajena', 'PRIVATE-FOLIO-OTHER', otherGroup);
  const fractions = insert("INSERT INTO skills (code,name) VALUES ('fractions','Fracciones')");
  const place = insert("INSERT INTO skills (code,name) VALUES ('place_value','Valor posicional')");
  insert("INSERT INTO skills (code,name) VALUES ('multiplication','Multiplicaciones')");
  const assignment = (g) => insert("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'Prueba ficticia','screen')", g, teacher);
  const oldAssignment1 = assignment(older1);
  const oldAssignment2 = assignment(older2);
  const currentAssignment = assignment(groupId);
  const cut = (studentId, skill, assignmentId, grade, index, pct, mastery, supported, date) => insert(
    'INSERT INTO skill_mastery_history (student_id,skill_id,assignment_id,grade,session_index,session_percentage,autonomous_percentage,supported_percentage,mastery_percentage,mastery_level,recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    studentId, skill, assignmentId, grade, index, pct, pct, supported, mastery,
    mastery < 25 ? 'needs_support' : mastery < 50 ? 'in_progress' : mastery < 75 ? 'achieved' : 'mastered', date);
  cut(ana, fractions, oldAssignment1, 1, 1, 0, 0, 100, '2025-05-01 10:00:00');
  cut(ana, fractions, oldAssignment2, 2, 2, 0, 0, 66.67, '2026-05-01 10:00:00');
  cut(ana, fractions, currentAssignment, 3, 3, 0, 0, 66.67, '2026-11-01 10:00:00');
  cut(beto, fractions, currentAssignment, 3, 1, 100, 100, 0, '2026-11-01 10:00:00');
  cut(ana, place, currentAssignment, 3, 1, 75, 75, 25, '2026-11-01 10:00:00');
  const content = (title) => insert("INSERT INTO curriculum_contents (phase,grade,formative_field,title,pda,skill_id) VALUES (4,3,'saberes_pensamiento_cientifico',?,'Ejemplo por validar',?)", title, fractions);
  const seen = content('Contenido visto');
  content('Contenido pendiente');
  insert("INSERT INTO group_curriculum_progress (group_id,content_id,status) VALUES (?,?,'seen')", groupId, seen);
  insert("INSERT INTO recommended_activities (skill_id,grade_min,grade_max,title,description) VALUES (?,3,3,'Actividad ficticia','Por validar con docente')", fractions);
  const question = insert("INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3) VALUES (?,3,'Ejemplo','Pista uno','Pista dos','Pista tres')", fractions);
  const distractor = insert("INSERT INTO question_options (question_id,label,text,is_correct,error_tag,error_explanation) VALUES (?,'B','Distractor',0,'partes_distintas','Considera partes de diferente tamaño')", question);
  const completed = insert("INSERT INTO assignment_targets (assignment_id,student_id,status) VALUES (?,?,'completed_screen')", currentAssignment, ana);
  insert("INSERT INTO student_responses (assignment_target_id,question_id,selected_option_id,outcome_status,error_tag,source) VALUES (?,?,?,'incorrect','partes_distintas','screen')", completed, question, distractor);
  const pending = insert("INSERT INTO assignment_targets (assignment_id,student_id,status) VALUES (?,?,'in_progress')", currentAssignment, celia);
  insert("INSERT INTO student_responses (assignment_target_id,question_id,selected_option_id,outcome_status,error_tag,source) VALUES (?,?,?,'incorrect','partes_distintas','screen')", pending, question, distractor);
  const staff = (id, role, schoolId = school) => tokenFor({ sub: String(id), role, schoolId });
  return { db, ids: { groupId, emptyGroup, ana, beto, celia, foreign }, tokens: {
    teacher: staff(teacher, 'teacher'), otherTeacher: staff(otherTeacher, 'teacher'),
    director: staff(director, 'director'), otherDirector: staff(otherDirector, 'director', otherSchool),
    student: tokenFor({ sub: String(ana), role: 'student', schoolId: school, groupId }),
  } };
}

describe('analytics API: evidencia real, lectura y privacidad', () => {
  let fx;
  let api;
  const base = () => `/api/v1/analytics/groups/${fx.ids.groupId}`;
  const profile = (id = fx.ids.ana) => `${base()}/students/${id}`;
  const read = (path, token = fx.tokens.teacher) => api.call('GET', path, { token });
  beforeEach(async () => {
    fx = fixtures();
    api = await startServer(createApp({ db: fx.db, config: configWith(), logger: silentLogger }));
  });
  afterEach(async () => { await api.close(); fx.db.close(); });

  test('mapa calcula promedios de evaluados, conserva cero y separa apoyo de dominio', async () => {
    const { status, body } = await read(base());
    assert.equal(status, 200);
    assert.ok(body.meta);
    const data = body.data;
    assert.equal(data.students.length, 3);
    const frac = data.skills.find((s) => s.code === 'fractions');
    assert.equal(frac.average, 50);
    assert.equal(frac.evaluatedCount, 2);
    assert.equal(frac.label, 'Logrado');
    assert.equal(data.summary.studentCount, 3);
    assert.equal(data.summary.needsSupportCount, 1);
    assert.equal(data.summary.weakestSkill.code, 'fractions');
    const ana = data.students.find((s) => s.id === fx.ids.ana).skills.find((s) => s.code === 'fractions');
    assert.equal(ana.masteryPercentage, 0);
    assert.equal(ana.label, 'Necesita apoyo');
    assert.equal(ana.autonomousPercentage, 0);
    assert.equal(ana.supportedPercentage, 66.67);
    const celia = data.students.find((s) => s.id === fx.ids.celia).skills.find((s) => s.code === 'fractions');
    assert.equal(celia.masteryPercentage, null);
    assert.equal(data.skills.find((s) => s.code === 'multiplication').average, null);
  });

  test('cobertura y sugerencia usan catálogo y errores de respuestas terminadas', async () => {
    const { body } = await read(base());
    assert.equal(body.data.summary.coverage.total, 2);
    assert.equal(body.data.summary.coverage.seen, 1);
    assert.equal(body.data.summary.coverage.coveragePercentage, 50);
    assert.equal(body.data.summary.recommendedActivity.title, 'Actividad ficticia');
    assert.equal(body.data.summary.typicalErrors.length, 1);
    assert.equal(body.data.summary.typicalErrors[0].errorTag, 'partes_distintas');
    assert.equal(body.data.summary.typicalErrors[0].count, 1);
    assert.equal(body.data.summary.typicalErrors[0].explanation, 'Considera partes de diferente tamaño');
  });

  test('perfil conserva cortes de tres grados con ciclos reales y lectura no altera SQLite', async () => {
    const changesBefore = fx.db.prepare('SELECT total_changes() AS n').get().n;
    const { status, body } = await read(profile());
    assert.equal(status, 200);
    assert.equal(body.data.student.id, fx.ids.ana);
    const history = body.data.history.filter((h) => h.skillCode === 'fractions');
    assert.deepEqual(history.map((h) => h.grade).sort(), [1, 2, 3]);
    assert.deepEqual(history.map((h) => h.schoolYear).sort(), ['2024-2025', '2025-2026', '2026-2027']);
    assert.equal(history.length, 3);
    assert.ok(history.every((h) => h.recordedAt));
    assert.equal(fx.db.prepare('SELECT total_changes() AS n').get().n, changesBefore);
    const serialized = JSON.stringify(body);
    for (const privateText of ['internal_folio', 'internalFolio', 'PRIVATE-FOLIO', 'password_hash', 'hidden-hash', 'CURP']) {
      assert.ok(!serialized.includes(privateText), privateText);
    }
  });

  test('grupo vacío y alumno sin cortes tienen estados explícitos', async () => {
    const empty = await read(`/api/v1/analytics/groups/${fx.ids.emptyGroup}`);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.data.students, []);
    assert.equal(empty.body.data.summary.weakestSkill, null);
    assert.equal(empty.body.data.summary.needsSupportCount, 0);
    const student = await read(profile(fx.ids.celia));
    assert.equal(student.status, 200);
    assert.deepEqual(student.body.data.history, []);
    assert.ok(student.body.data.skills.every((s) => s.masteryPercentage === null));
  });

  test('historial excluye asignaciones de otra escuela y no inventa ciclo sin asignación', async () => {
    const school = fx.db.prepare("SELECT id FROM schools WHERE name = 'Escuela ficticia B'").get().id;
    const group = Number(fx.db.prepare("INSERT INTO groups (school_id,grade,section,school_year,join_code) VALUES (?,4,'B','2027-2028','OUTS4B')").run(school).lastInsertRowid);
    const assignment = Number(fx.db.prepare("INSERT INTO assignments (group_id,title,modality) VALUES (?,'Registro externo','screen')").run(group).lastInsertRowid);
    const skill = fx.db.prepare("SELECT id FROM skills WHERE code = 'fractions'").get().id;
    fx.db.prepare("INSERT INTO skill_mastery_history (student_id,skill_id,assignment_id,grade,session_index,session_percentage,autonomous_percentage,supported_percentage,mastery_percentage,mastery_level) VALUES (?,?,?,4,4,100,100,0,100,'mastered')").run(fx.ids.ana, skill, assignment);
    const outside = await read(profile());
    assert.equal(outside.status, 200);
    assert.equal(outside.body.data.history.filter((h) => h.skillCode === 'fractions').length, 3);
    assert.equal(outside.body.data.skills.find((s) => s.code === 'fractions').masteryPercentage, 0);
    fx.db.prepare("INSERT INTO skill_mastery_history (student_id,skill_id,grade,session_index,session_percentage,autonomous_percentage,supported_percentage,mastery_percentage,mastery_level) VALUES (?,?,2,1,50,50,50,50,'achieved')").run(fx.ids.celia, skill);
    const orphan = await read(profile(fx.ids.celia));
    assert.equal(orphan.status, 200);
    assert.equal(orphan.body.data.history.length, 1);
    assert.equal(orphan.body.data.history[0].schoolYear, null);
    assert.equal(orphan.body.data.history[0].grade, 2);
  });

  test('ambos endpoints exigen sesión y rechazan rol alumno', async () => {
    for (const path of [base(), profile()]) {
      assert.equal((await api.call('GET', path)).status, 401);
      assert.equal((await read(path, fx.tokens.student)).status, 403);
    }
  });

  test('docente ajeno y director de otra escuela reciben 404; director propio puede leer', async () => {
    for (const path of [base(), profile()]) {
      assert.equal((await read(path, fx.tokens.otherTeacher)).status, 404);
      assert.equal((await read(path, fx.tokens.otherDirector)).status, 404);
      assert.equal((await read(path, fx.tokens.director)).status, 200);
    }
    assert.equal((await read(profile(fx.ids.foreign))).status, 404);
    assert.equal((await read(profile(999999))).status, 404);
    assert.equal((await read('/api/v1/analytics/groups/999999')).status, 404);
  });

  test('rechaza identificadores inválidos sin consultar otro recurso', async () => {
    for (const id of ['0', '-1', 'abc', '1.5', '1e3', '9007199254740993']) {
      assert.equal((await read(`/api/v1/analytics/groups/${id}`)).status, 400, `grupo ${id}`);
      assert.equal((await read(profile(id))).status, 400, `alumno ${id}`);
    }
  });

  test('despliegue conserva 404 JSON para API y archivos faltantes', async () => {
    for (const path of ['/api/v1/no-existe', '/assets/no-existe.js']) {
      const response = await api.call('GET', path);
      assert.equal(response.status, 404);
      assert.ok(response.body.error.code);
    }
  });

  test('despliegue sirve rutas SPA si existe frontend compilado', { skip: !existsSync(new URL('../../frontend/dist/index.html', import.meta.url)) }, async () => {
    const server = createApp({ db: fx.db, config: configWith(), logger: silentLogger }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const url = `http://127.0.0.1:${server.address().port}`;
      for (const path of ['/', '/docente/mapa', `/docente/perfil/${fx.ids.ana}`]) {
        const response = await fetch(url + path, { headers: { accept: 'text/html' } });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /text\/html/);
        assert.equal(await response.text(), readFileSync(new URL('../../frontend/dist/index.html', import.meta.url), 'utf8'));
      }
      const api404 = await fetch(`${url}/api/v1/no-existe`, { headers: { accept: 'text/html' } });
      assert.equal(api404.status, 404);
      assert.match(api404.headers.get('content-type'), /application\/json/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
