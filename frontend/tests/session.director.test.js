import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { homePathFor, isSessionValid, safeReturnPath, toSession } from '../src/shared/state/session.js';

// Respuesta con la forma de POST /auth/quick-login/director (datos ficticios).
const directorData = {
  token: 'd1',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  user: { id: 2, fullName: 'Mtro. Ricardo Salinas', email: 'direccion@axi.demo', role: 'director', schoolId: 1 },
};

describe('sesión del director', () => {
  test('toSession conserva el rol director y su inicio es /direccion/panel', () => {
    const session = toSession(directorData);
    assert.equal(session.role, 'director');
    assert.equal(isSessionValid(session), true);
    assert.equal(homePathFor(session), '/direccion/panel');
  });

  test('safeReturnPath: el director solo vuelve a sus pantallas (ruta exacta)', () => {
    const director = toSession(directorData);
    for (const ok of ['/direccion/panel', '/direccion/docentes', '/direccion/promover', '/direccion/traslados']) {
      assert.equal(safeReturnPath(ok, director), ok);
    }
    for (const from of ['/direccion/escuela', '/direccion/panelX', '/direccion/panel/../../docente/grupos', '/docente/mapa', '/docente/grupos']) {
      assert.equal(safeReturnPath(from, director), '/direccion/panel', from);
    }
  });

  test('safeReturnPath: rutas del alumno, externas o vacías van a /direccion/panel', () => {
    const director = toSession(directorData);
    for (const from of ['/alumno/inicio', '/alumno/logros', 'https://otro.sitio', '//otro.sitio', undefined, null, '']) {
      assert.equal(safeReturnPath(from, director), '/direccion/panel', String(from));
    }
  });
});
