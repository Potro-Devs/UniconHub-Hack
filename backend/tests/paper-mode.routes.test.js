import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

/**
 * Esqueleto de `/api/v1/paper`: rutas montadas, autorización por rol y 501 mientras
 * no se implemente cada caso de uso. Al implementar un endpoint, reemplaza su caso 501
 * por pruebas del contrato real.
 */
describe('paper-mode routes (esqueleto)', () => {
  let server;
  const teacher = tokenFor({ sub: '1', role: 'teacher', schoolId: 1 });
  const director = tokenFor({ sub: '2', role: 'director', schoolId: 1 });
  const student = tokenFor({ sub: '3', role: 'student', schoolId: 1, groupId: 1 });

  before(async () => {
    const db = openDatabase(':memory:');
    runMigrations(db);
    server = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });
  after(() => server.close());

  const reads = ['/pdf', '/hints-pdf', '/capture-status'].map((p) => `/api/v1/paper/assignments/1${p}`);
  const capture = '/api/v1/paper/assignments/1/capture/1';

  test('sin sesión → 401', async () => {
    for (const path of reads) assert.equal((await server.call('GET', path)).status, 401);
    assert.equal((await server.call('POST', capture, { body: {} })).status, 401);
  });

  test('alumno → 403 en todo', async () => {
    for (const path of reads) assert.equal((await server.call('GET', path, { token: student })).status, 403);
    assert.equal((await server.call('POST', capture, { token: student, body: {} })).status, 403);
  });

  test('director no puede capturar → 403', async () => {
    assert.equal((await server.call('POST', capture, { token: director, body: {} })).status, 403);
  });

  test('personal autorizado → 501 NOT_IMPLEMENTED mientras no se implemente', async () => {
    for (const path of reads) {
      for (const token of [teacher, director]) {
        const res = await server.call('GET', path, { token });
        assert.equal(res.status, 501, path);
        assert.equal(res.body.error.code, 'NOT_IMPLEMENTED');
      }
    }
    const res = await server.call('POST', capture, { token: teacher, body: {} });
    assert.equal(res.status, 501);
  });
});
