import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  MAX_BULK_LINES,
  classifyAddStudentError,
  classifyBulkError,
  classifyGroupSaveError,
  contrastRatio,
  countListLines,
  draftsForUser,
  emptyDrafts,
  getDraft,
  setDraft,
  findSameGroup,
  formatJoinCode,
  groupLabel,
  joinCodeForCopy,
  phaseForGrade,
  pickActiveGroup,
  readStoredActiveGroupId,
  readableTextOn,
  schoolYearToApi,
  schoolYearToDisplay,
  sortGroups,
  sortStudents,
  writeStoredActiveGroupId,
} from '../src/features/groups/groups.logic.js';

const g = (id, grade, section, schoolYear = '2026-2027') => ({ id, grade, section, schoolYear, name: groupLabel(grade, section) });

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

describe('código de grupo', () => {
  test('se muestra en 3 + 3 y se copia sin espacio', () => {
    assert.equal(formatJoinCode('MAPA3A'), 'MAP A3A');
    assert.equal(formatJoinCode(' map a3a '), 'MAP A3A');
    assert.equal(formatJoinCode(''), '');
    assert.equal(joinCodeForCopy('MAP A3A'), 'MAPA3A');
  });
});

describe('ciclo escolar y fase', () => {
  test('convierte entre guion largo (pantalla) y guion (API)', () => {
    assert.equal(schoolYearToDisplay('2026-2027'), '2026–2027');
    assert.equal(schoolYearToApi('2026–2027'), '2026-2027');
    assert.equal(schoolYearToApi(schoolYearToDisplay('2027-2028')), '2027-2028');
  });

  test('fase por grado', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(phaseForGrade), [3, 3, 4, 4, 5, 5]);
    assert.equal(phaseForGrade(7), null);
  });
});

describe('grupo activo', () => {
  const groups = [g(5, 4, 'B'), g(2, 3, 'B'), g(9, 3, 'A')];

  test('usa el guardado si sigue en la lista', () => {
    assert.equal(pickActiveGroup(groups, '5').id, 5);
  });

  test('si no, el primero por grado y sección', () => {
    assert.equal(pickActiveGroup(groups, '99').id, 9);
    assert.equal(pickActiveGroup(groups, null).id, 9);
    assert.deepEqual(sortGroups(groups).map((x) => x.id), [9, 2, 5]);
  });

  test('sin grupos no hay activo', () => {
    assert.equal(pickActiveGroup([], '1'), null);
  });

  test('se guarda por docente y tolera almacenamiento bloqueado', () => {
    const storage = memoryStorage();
    writeStoredActiveGroupId(storage, 1, 5);
    assert.equal(readStoredActiveGroupId(storage, 1), '5');
    assert.equal(readStoredActiveGroupId(storage, 2), null);
    writeStoredActiveGroupId(storage, 1, null);
    assert.equal(readStoredActiveGroupId(storage, 1), null);
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    assert.equal(readStoredActiveGroupId(broken, 1), null);
    assert.doesNotThrow(() => writeStoredActiveGroupId(broken, 1, 3));
  });

  test('encuentra un grupo igual para "Ir a"', () => {
    assert.equal(findSameGroup(groups, { grade: 3, section: 'a', schoolYear: '2026–2027' }).id, 9);
    assert.equal(findSameGroup(groups, { grade: 3, section: 'A', schoolYear: '2026-2027' }, 9), null);
    assert.equal(findSameGroup(groups, { grade: 3, section: 'A', schoolYear: '2027-2028' }), null);
  });
});

describe('lista pegada', () => {
  test('cuenta solo renglones no vacíos', () => {
    assert.equal(countListLines(''), 0);
    assert.equal(countListLines('Ana López\n\n  \nLuis Pérez\r\nSofía Ruiz'), 3);
    assert.equal(MAX_BULK_LINES, 60);
  });
});

describe('alumnos', () => {
  test('ordena por apellidos en español', () => {
    const list = [
      { firstNames: 'Ana', lastNames: 'Ñuñez' },
      { firstNames: 'Luis', lastNames: 'Álvarez' },
      { firstNames: 'Beto', lastNames: 'Nava' },
      { firstNames: 'Abel', lastNames: 'Álvarez' },
    ];
    assert.deepEqual(sortStudents(list).map((s) => s.firstNames), ['Abel', 'Luis', 'Beto', 'Ana']);
  });

  test('iniciales oscuras sobre la paleta accesible; claras si no alcanza', () => {
    const ink = '#18203A';
    for (const bg of ['#F4B6C2', '#F9E08B', '#A8DCEB', '#B5E3C4', '#D7C4F2', '#FFCBA4', '#C9D8F5', '#E3E8A1']) {
      assert.ok(contrastRatio(bg, ink) >= 4.5, bg);
      assert.equal(readableTextOn(bg, ink, '#FFFFFF'), ink);
    }
    assert.equal(readableTextOn('#1E293B', ink, '#FFFFFF'), '#FFFFFF');
    assert.equal(readableTextOn('oklch(0.8 0.1 20)', ink, '#FFFFFF'), ink);
  });
});

describe('mapeo de errores', () => {
  test('guardar grupo', () => {
    assert.equal(classifyGroupSaveError({ status: 409, code: 'GROUP_ALREADY_EXISTS' }), 'duplicate');
    assert.equal(classifyGroupSaveError({ status: 409, code: 'GROUP_HAS_HISTORY' }), 'history');
    assert.equal(classifyGroupSaveError({ status: 0, code: 'NETWORK_ERROR' }), 'network');
    assert.equal(classifyGroupSaveError({ status: 404, code: 'GROUP_NOT_FOUND' }), 'generic');
    assert.equal(classifyGroupSaveError({ status: 500, code: 'INTERNAL_ERROR' }), 'generic');
  });

  test('carga masiva', () => {
    const lines = [{ line: 3, text: '123' }];
    assert.deepEqual(classifyBulkError({ status: 400, details: { invalidLines: lines } }), { kind: 'invalidLines', lines });
    assert.deepEqual(classifyBulkError({ status: 400, details: { maxLines: 60, lineCount: 61 } }), { kind: 'tooMany', lineCount: 61 });
    assert.deepEqual(classifyBulkError({ status: 0, code: 'NETWORK_ERROR' }), { kind: 'network' });
    for (const status of [403, 404, 500]) assert.deepEqual(classifyBulkError({ status, code: 'X' }), { kind: 'generic' });
    assert.deepEqual(classifyBulkError(new Error('inesperado')), { kind: 'generic' });
  });

  test('alta individual', () => {
    assert.equal(classifyAddStudentError({ status: 400 }), 'invalidName');
    assert.equal(classifyAddStudentError({ status: 0, code: 'NETWORK_ERROR' }), 'network');
    assert.equal(classifyAddStudentError({ status: 404, code: 'GROUP_NOT_FOUND' }), 'generic');
  });
});

describe('borradores de la lista pegada', () => {
  test('hay un borrador por grupo', () => {
    let state = emptyDrafts(1);
    state = setDraft(state, 3, 'Ana López');
    state = setDraft(state, 4, 'Luis Pérez');
    assert.equal(getDraft(state, 3), 'Ana López');
    assert.equal(getDraft(state, '4'), 'Luis Pérez');
    assert.equal(getDraft(state, 5), '');
    state = setDraft(state, 3, '');
    assert.equal(getDraft(state, 3), '');
    assert.equal(getDraft(state, 4), 'Luis Pérez');
  });

  test('se vacía al cambiar de usuario y se conserva con el mismo', () => {
    const state = setDraft(emptyDrafts(1), 3, 'Ana López');
    assert.equal(draftsForUser(state, 1), state);
    const other = draftsForUser(state, 2);
    assert.equal(getDraft(other, 3), '');
    assert.equal(other.userId, 2);
    assert.equal(getDraft(draftsForUser(state, null), 3), '');
  });
});
