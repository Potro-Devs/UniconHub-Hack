import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ApiError, NETWORK_ERROR_MESSAGE, createApiClient, errorMessageOf } from '../src/shared/api/createApiClient.js';

/** fetch falso que registra las llamadas y responde lo indicado. */
function fakeFetch(respond) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const { status = 200, body } = await respond(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError('sin cuerpo');
        return body;
      },
    };
  };
  return { impl, calls };
}

describe('createApiClient', () => {
  test('devuelve `data` y envía JSON con el token', async () => {
    const { impl, calls } = fakeFetch(() => ({ body: { data: { ok: true } } }));
    const api = createApiClient({ baseUrl: '/api/v1', fetchImpl: impl, getToken: () => 'abc' });
    assert.deepEqual(await api.post('/auth/login', { email: 'a@b.mx' }), { ok: true });
    assert.equal(calls[0].url, '/api/v1/auth/login');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer abc');
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].init.body, '{"email":"a@b.mx"}');
  });

  test('omite el token con `auth: false` y el Content-Type sin cuerpo', async () => {
    const { impl, calls } = fakeFetch(() => ({ body: { data: null } }));
    const api = createApiClient({ baseUrl: '', fetchImpl: impl, getToken: () => 'abc' });
    await api.post('/auth/quick-login/teacher', undefined, { auth: false });
    assert.equal(calls[0].init.headers.Authorization, undefined);
    assert.equal(calls[0].init.headers['Content-Type'], undefined);
    assert.equal(calls[0].init.body, undefined);
  });

  test('convierte `{ error }` en ApiError con código y mensaje del servidor', async () => {
    const { impl } = fakeFetch(() => ({
      status: 404,
      body: { error: { code: 'GROUP_NOT_FOUND', message: 'No encontramos ese código.' } },
    }));
    const api = createApiClient({ baseUrl: '', fetchImpl: impl });
    await assert.rejects(api.post('/auth/student-join', { joinCode: 'ZZZZZZ' }), (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 404);
      assert.equal(err.code, 'GROUP_NOT_FOUND');
      assert.equal(errorMessageOf(err), 'No encontramos ese código.');
      return true;
    });
  });

  test('respuestas sin JSON dan un error genérico', async () => {
    const { impl } = fakeFetch(() => ({ status: 502 }));
    const api = createApiClient({ baseUrl: '', fetchImpl: impl });
    await assert.rejects(api.get('/x'), (err) => err.code === 'HTTP_ERROR' && err.status === 502);
  });

  test('sin conexión → NETWORK_ERROR con mensaje claro', async () => {
    const api = createApiClient({ baseUrl: '', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    await assert.rejects(api.get('/x'), (err) => err.code === 'NETWORK_ERROR' && err.message === NETWORK_ERROR_MESSAGE);
  });

  test('un 401 con token avisa para cerrar la sesión; sin token, no', async () => {
    const { impl } = fakeFetch(() => ({ status: 401, body: { error: { code: 'TOKEN_EXPIRED', message: 'Expiró' } } }));
    let notified = 0;
    const withToken = createApiClient({ baseUrl: '', fetchImpl: impl, getToken: () => 'abc', onUnauthorized: () => { notified += 1; } });
    await assert.rejects(withToken.get('/auth/me'));
    assert.equal(notified, 1);

    const withoutToken = createApiClient({ baseUrl: '', fetchImpl: impl, onUnauthorized: () => { notified += 1; } });
    await assert.rejects(withoutToken.post('/auth/login', {}));
    assert.equal(notified, 1);
  });

  test('errorMessageOf da un mensaje genérico para errores desconocidos', () => {
    assert.match(errorMessageOf(new Error('interno')), /inesperado/);
  });
});
