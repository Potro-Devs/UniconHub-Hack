import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  SESSION_STORAGE_KEY,
  homePathFor,
  initialsOf,
  isSessionValid,
  mergeMe,
  normalizeJoinCodeInput,
  readStoredSession,
  safeReturnPath,
  toSession,
  writeStoredSession,
} from '../src/shared/state/session.js';

const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

const teacherData = {
  token: 't1',
  expiresAt: future(),
  user: { id: 1, fullName: 'Mtra. Elena Torres', email: 'docente@axi.demo', role: 'teacher', schoolId: 1 },
};
const studentData = {
  token: 's1',
  expiresAt: future(),
  student: { id: 7, displayName: 'Sofía R.', initials: 'SR', avatarColor: '#F4B6C2', avatarId: null },
  group: { id: 3, name: '3.º A', grade: 3, section: 'A', schoolYear: '2026-2027' },
};

describe('toSession', () => {
  test('docente', () => {
    const s = toSession(teacherData);
    assert.equal(s.role, 'teacher');
    assert.equal(s.user.fullName, 'Mtra. Elena Torres');
    assert.equal(s.student, null);
  });

  test('alumno', () => {
    const s = toSession(studentData);
    assert.equal(s.role, 'student');
    assert.equal(s.student.displayName, 'Sofía R.');
    assert.equal(s.group.name, '3.º A');
  });
});

describe('almacenamiento', () => {
  test('guarda y recupera una sesión vigente', () => {
    const storage = memoryStorage();
    writeStoredSession(storage, toSession(teacherData));
    assert.equal(readStoredSession(storage).token, 't1');
    writeStoredSession(storage, null);
    assert.equal(storage.data.has(SESSION_STORAGE_KEY), false);
  });

  test('descarta sesiones expiradas o corruptas', () => {
    assert.equal(readStoredSession(memoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'x', expiresAt: past() }) })), null);
    assert.equal(readStoredSession(memoryStorage({ [SESSION_STORAGE_KEY]: '{no es json' })), null);
    assert.equal(readStoredSession(null), null);
  });

  test('no falla si el almacenamiento está bloqueado', () => {
    const blocked = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } };
    assert.equal(readStoredSession(blocked), null);
    assert.doesNotThrow(() => writeStoredSession(blocked, toSession(teacherData)));
  });

  test('isSessionValid exige token y vencimiento futuro', () => {
    assert.equal(isSessionValid(toSession(teacherData)), true);
    assert.equal(isSessionValid({ token: 'x', expiresAt: past() }), false);
    assert.equal(isSessionValid({ expiresAt: future() }), false);
    assert.equal(isSessionValid(null), false);
  });
});

describe('navegación', () => {
  test('homePathFor según el rol', () => {
    assert.equal(homePathFor(null), '/login');
    assert.equal(homePathFor(toSession(teacherData)), '/docente/grupos');
    assert.equal(homePathFor({ role: 'director' }), '/direccion/panel');
    assert.equal(homePathFor(toSession(studentData)), '/alumno/inicio');
  });

  test('safeReturnPath solo vuelve a rutas del área del rol', () => {
    const teacher = toSession(teacherData);
    const student = toSession(studentData);
    assert.equal(safeReturnPath('/docente/mapa', teacher), '/docente/mapa');
    // Sin vista previa de Dirección: el docente no vuelve a rutas de /direccion.
    assert.equal(safeReturnPath('/direccion/escuela', teacher), '/docente/grupos');
    assert.equal(safeReturnPath('/direccion/panel', teacher), '/docente/grupos');
    assert.equal(safeReturnPath('/alumno/logros', teacher), '/docente/grupos');
    assert.equal(safeReturnPath('/alumno/logros', student), '/alumno/logros');
    assert.equal(safeReturnPath('/docente/mapa', student), '/alumno/inicio');
    assert.equal(safeReturnPath('https://otro.sitio', teacher), '/docente/grupos');
    assert.equal(safeReturnPath(undefined, student), '/alumno/inicio');
  });
});

describe('utilidades', () => {
  test('mergeMe actualiza los datos públicos y conserva el token', () => {
    const merged = mergeMe(toSession(teacherData), { role: 'teacher', user: { ...teacherData.user, fullName: 'Elena T.' } });
    assert.equal(merged.token, 't1');
    assert.equal(merged.user.fullName, 'Elena T.');
    assert.equal(mergeMe(null, {}), null);
  });

  test('initialsOf ignora títulos', () => {
    assert.equal(initialsOf('Mtra. Elena Torres'), 'ET');
    assert.equal(initialsOf('Mtro. Raúl Méndez'), 'RM');
    assert.equal(initialsOf('Ana'), 'A');
    assert.equal(initialsOf(undefined), '');
  });

  test('normalizeJoinCodeInput deja solo 6 letras/números en mayúsculas', () => {
    assert.equal(normalizeJoinCodeInput('mapa 3a'), 'MAPA3A');
    assert.equal(normalizeJoinCodeInput('3A-7K2'), '3A7K2');
    assert.equal(normalizeJoinCodeInput('abcdefgh'), 'ABCDEF');
  });
});
