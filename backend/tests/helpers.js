/**
 * Utilidades compartidas por las pruebas HTTP (no es un archivo de pruebas).
 */
import { once } from 'node:events';
import { loadConfig } from '../src/config/env.js';
import { signToken } from '../src/shared/utils/tokens.js';

export const TEST_SECRET = 'test-secret-for-backend-tests-0123456789';
export const silentLogger = { error() {} };

export function configWith(overrides = {}) {
  return loadConfig({ NODE_ENV: 'test', JWT_SECRET: TEST_SECRET, ...overrides });
}

/** Firma un token de prueba con los mismos claims que emite el módulo auth. */
export function tokenFor(claims) {
  return signToken(claims, { secret: TEST_SECRET, expiresIn: '1h' }).token;
}

/**
 * Levanta la app en un puerto libre y devuelve `call(method, path, { body, raw, token })`.
 */
export async function startServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { body, raw, token } = {}) => {
    const headers = {};
    if (body !== undefined || raw !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    return { status: res.status, body: await res.json() };
  };
  return { base, call, close: () => new Promise((resolve) => server.close(resolve)) };
}
