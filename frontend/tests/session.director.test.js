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

  test('safeReturnPath: vuelve a rutas de dirección y del área de personal', () => {
    const director = toSession(directorData);
    assert.equal(safeReturnPath('/direccion/promover', director), '/direccion/promover');
    assert.equal(safeReturnPath('/docente/mapa', director), '/docente/mapa');
  });

  test('safeReturnPath: rutas del alumno, externas o vacías van a /direccion/panel', () => {
    const director = toSession(directorData);
    for (const from of ['/alumno/inicio', '/alumno/logros', 'https://otro.sitio', '//otro.sitio', undefined, null, '']) {
      assert.equal(safeReturnPath(from, director), '/direccion/panel', String(from));
    }
  });
});
