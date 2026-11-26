/**
 * Errores típicos del mapa del grupo y "Qué hago mañana":
 * - un error típico es (habilidad, etiqueta) y cuenta alumnos distintos aunque la explicación varíe por reactivo;
 * - la tarjeta y la actividad sugerida usan el mismo error (el de más alumnos).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { createAnalyticsRepository } from '../src/modules/analytics/analytics.repository.js';
import { buildNextStep, selectRecommendedActivity, topErrorForSkill } from '../src/modules/analytics/analytics.domain.js';

describe('errores típicos por (habilidad, etiqueta)', () => {
  test('una etiqueta con explicaciones distintas cuenta a cada alumno una sola vez', () => {
    const db = openDatabase(':memory:');
    runMigrations(db);
    const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);
    const school = insert("INSERT INTO schools (name) VALUES ('Escuela ficticia')");
    const teacher = insert("INSERT INTO users (school_id,email,password_hash,full_name,role) VALUES (?,'t@err.test','x','Persona ficticia','teacher')", school);
    const group = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'A','2026-2027','ERRT3A')", school, teacher);
    const skill = insert("INSERT INTO skills (code,name) VALUES ('fractions','Fracciones')");
    // Dos reactivos con la misma etiqueta y explicaciones distintas.
    const question = (stem, explanation) => {
      const q = insert("INSERT INTO questions (skill_id,grade,stem,hint_1,hint_2,hint_3) VALUES (?,3,?,'Uno','Dos','Tres')", skill, stem);
      insert("INSERT INTO question_options (question_id,label,text,is_correct) VALUES (?,'A','Correcta',1)", q);
      const wrong = insert("INSERT INTO question_options (question_id,label,text,is_correct,error_tag,error_explanation) VALUES (?,'B','Distractor',0,'add_across',?)", q, explanation);
      return { q, wrong };
    };
    const q1 = question('Uno', 'Suma numeradores y denominadores.');
    const q2 = question('Dos', 'Suma también los denominadores.');
    const assignment = insert("INSERT INTO assignments (group_id,created_by,title,modality) VALUES (?,?,'Prueba','screen')", group, teacher);
    for (let i = 0; i < 5; i += 1) {
      const student = insert("INSERT INTO students (school_id,internal_folio,first_names,last_names,initials,avatar_color) VALUES (?,?,'Ficticio','Ejemplo','FE','#123456')", school, `ERR-${i}`);
      insert("INSERT INTO group_enrollments (group_id,student_id,status) VALUES (?,?,'active')", group, student);
      const target = insert("INSERT INTO assignment_targets (assignment_id,student_id,status) VALUES (?,?,'completed_screen')", assignment, student);
      for (const { q, wrong } of [q1, q2]) {
        insert("INSERT INTO student_responses (assignment_target_id,question_id,selected_option_id,outcome_status,error_tag,source) VALUES (?,?,?,'incorrect','add_across','screen')", target, q, wrong);
      }
    }
    const rows = createAnalyticsRepository(db).listTypicalErrors(group, school);
    assert.equal(rows.length, 1, 'una sola fila por (habilidad, etiqueta)');
    assert.equal(rows[0].student_count, 5);
    assert.equal(rows[0].count, 10);
    db.close();
  });
});

describe('"Qué hago mañana": error y actividad coinciden', () => {
  // Orden por respuestas (como antes): A tiene más respuestas, B más alumnos.
  const typicalErrors = [
    { skillCode: 'fractions', errorTag: 'A', explanation: 'Error A', count: 20, studentCount: 3 },
    { skillCode: 'fractions', errorTag: 'B', explanation: 'Error B', count: 9, studentCount: 9 },
  ];
  const activities = [
    { id: 1, skill_code: 'fractions', target_error_tag: 'A', title: 'Para A' },
    { id: 2, skill_code: 'fractions', target_error_tag: 'B', title: 'Para B' },
  ];

  test('el error prioritario es el de más alumnos (a igualdad, más respuestas)', () => {
    assert.equal(topErrorForSkill(typicalErrors, 'fractions').errorTag, 'B');
    const tie = [{ skillCode: 'x', errorTag: 'P', count: 4, studentCount: 2 }, { skillCode: 'x', errorTag: 'Q', count: 7, studentCount: 2 }];
    assert.equal(topErrorForSkill(tie, 'x').errorTag, 'Q');
    assert.equal(topErrorForSkill(typicalErrors, 'reading_comprehension'), null);
  });

  test('la actividad sugerida atiende el mismo error que muestra la tarjeta', () => {
    const activity = selectRecommendedActivity(activities, 'fractions', typicalErrors);
    const step = buildNextStep({ code: 'fractions', name: 'Fracciones', average: 30, label: 'En proceso', gradeCounts: { 3: 10 } },
      typicalErrors, activity, 3);
    assert.equal(step.error.errorTag, 'B');
    assert.equal(step.activity.targetErrorTag, 'B');
  });
});
