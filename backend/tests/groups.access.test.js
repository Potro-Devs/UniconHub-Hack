import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { createGroupAccess } from '../src/modules/groups/groups.access.js';
import { createGroupsRepository } from '../src/modules/groups/groups.repository.js';
import { HttpError } from '../src/shared/errors/HttpError.js';

const isGroupNotFound = (err) =>
  err instanceof HttpError && err.status === 404 && err.code === 'GROUP_NOT_FOUND' && err.message === 'No encontramos ese grupo.';

describe('groups.access', () => {
  let db;
  let access;
  let ids;
  const auth = (sub, role, schoolId) => ({ sub: String(sub), role, schoolId });

  before(() => {
    db = openDatabase(':memory:');
    runMigrations(db);
    const id = (sql, ...params) => Number(db.prepare(sql).run(...params).lastInsertRowid);
    const schoolA = id("INSERT INTO schools (name) VALUES ('Escuela A')");
    const schoolB = id("INSERT INTO schools (name) VALUES ('Escuela B')");
    const user = (school, email, role) =>
      id("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, ?, 'x', 'Persona Demo', ?)", school, email, role);
    const teacherA = user(schoolA, 'a@axi.test', 'teacher');
    const teacherB = user(schoolA, 'b@axi.test', 'teacher');
    const directorA = user(schoolA, 'dir-a@axi.test', 'director');
    const directorB = user(schoolB, 'dir-b@axi.test', 'director');
    const groupA = id(
      "INSERT INTO groups (school_id, teacher_id, grade, section, school_year, join_code) VALUES (?, ?, 3, 'A', '2026-2027', 'MAPA3A')",
      schoolA, teacherA,
    );
    ids = { schoolA, schoolB, teacherA, teacherB, directorA, directorB, groupA };
    access = createGroupAccess(createGroupsRepository(db));
  });

  after(() => db.close());

  test('docente dueña: lee y edita su grupo', () => {
    const owner = auth(ids.teacherA, 'teacher', ids.schoolA);
    assert.equal(access.findReadableGroup(owner, String(ids.groupA)).id, ids.groupA);
    assert.equal(access.findOwnGroup(owner, String(ids.groupA)).id, ids.groupA);
    assert.equal(access.findReadableGroupById(owner, ids.groupA).id, ids.groupA);
  });

  test('docente ajena de la misma escuela → 404', () => {
    const other = auth(ids.teacherB, 'teacher', ids.schoolA);
    assert.throws(() => access.findReadableGroup(other, String(ids.groupA)), isGroupNotFound);
    assert.throws(() => access.findOwnGroup(other, String(ids.groupA)), isGroupNotFound);
    assert.equal(access.findReadableGroupById(other, ids.groupA), null);
  });

  test('docente dueña con escuela distinta en la sesión → 404', () => {
    assert.throws(() => access.findReadableGroup(auth(ids.teacherA, 'teacher', ids.schoolB), String(ids.groupA)), isGroupNotFound);
  });

  test('director de la misma escuela lee; de otra escuela → 404', () => {
    assert.equal(access.findReadableGroup(auth(ids.directorA, 'director', ids.schoolA), String(ids.groupA)).id, ids.groupA);
    assert.throws(() => access.findReadableGroup(auth(ids.directorB, 'director', ids.schoolB), String(ids.groupA)), isGroupNotFound);
  });

  test('findOwnGroup con rol director → 404 (no revela que existe)', () => {
    assert.throws(() => access.findOwnGroup(auth(ids.directorA, 'director', ids.schoolA), String(ids.groupA)), isGroupNotFound);
  });

  test('grupo inexistente → 404; id no válido → 400', () => {
    const owner = auth(ids.teacherA, 'teacher', ids.schoolA);
    assert.throws(() => access.findReadableGroup(owner, '99999'), isGroupNotFound);
    assert.throws(() => access.findOwnGroup(owner, 'abc'), (err) => err.code === 'VALIDATION_ERROR');
  });
});
