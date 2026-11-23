import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  AVATAR_IDS,
  AVATAR_PALETTE,
  CODE_ALPHABET,
  MAX_BULK_LINES,
  MAX_NAME_LENGTH,
  assertGroupPatchAllowed,
  buildInitials,
  buildNewStudent,
  generateInternalFolio,
  generateJoinCode,
  isValidNamePart,
  normalizeJoinCode,
  normalizeName,
  parseAvatarPatch,
  parseBulkInput,
  parseBulkStudentList,
  parseGrade,
  parseGroupInput,
  parseGroupPatch,
  parsePositiveId,
  parseSchoolYear,
  parseSection,
  parseStudentInput,
  parseStudentName,
  pickAvatarColor,
  toGroupDto,
  toStudentDto,
} from '../../src/modules/groups/groups.domain.js';

/** Generador determinista para pruebas. */
const sequence = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('nombres e iniciales', () => {
  test('normalizeName limpia espacios y respeta partículas', () => {
    assert.equal(normalizeName('  JUAN   DE LA CRUZ '), 'Juan de la Cruz');
    assert.equal(normalizeName('maría-josé'), 'María-José');
  });

  test('iniciales: primer nombre + primer apellido, en mayúsculas', () => {
    assert.equal(buildInitials('Ana Paula', 'Ramírez López'), 'AR');
    assert.equal(buildInitials('ángel', 'ortiz'), 'ÁO');
  });

  test('iniciales exigen nombre y apellido', () => {
    assert.throws(() => buildInitials('Ana', ' '), RangeError);
  });

  test('parseStudentName con coma: apellidos primero', () => {
    assert.deepEqual(parseStudentName('Ramírez López, Ana Paula'), {
      firstNames: 'Ana Paula',
      lastNames: 'Ramírez López',
    });
  });

  test('parseStudentName sin coma: los dos últimos términos son apellidos', () => {
    assert.deepEqual(parseStudentName('Ana Paula Ramírez López'), { firstNames: 'Ana Paula', lastNames: 'Ramírez López' });
    assert.deepEqual(parseStudentName('Sofía Ramírez'), { firstNames: 'Sofía', lastNames: 'Ramírez' });
    assert.equal(parseStudentName('Sofía'), null);
  });
});

describe('parseBulkStudentList', () => {
  test('procesa una lista pegada con viñetas, numeración y líneas vacías', () => {
    const text = '1. Sofía Ramírez García\r\n\n- Mateo Hernández\n• López Cruz, Diego\nXimena\n';
    const { students, invalidLines } = parseBulkStudentList(text);
    assert.deepEqual(students, [
      { firstNames: 'Sofía', lastNames: 'Ramírez García' },
      { firstNames: 'Mateo', lastNames: 'Hernández' },
      { firstNames: 'Diego', lastNames: 'López Cruz' },
    ]);
    assert.deepEqual(invalidLines, [{ line: 5, text: 'Ximena' }]);
  });
});

describe('avatar, folio y código de grupo', () => {
  test('pickAvatarColor elige de la paleta accesible', () => {
    assert.equal(pickAvatarColor(sequence(0)), AVATAR_PALETTE[0]);
    assert.equal(pickAvatarColor(sequence(0.999)), AVATAR_PALETTE[AVATAR_PALETTE.length - 1]);
  });

  test('la paleta tiene contraste ≥ 4.5:1 con el texto #18203A', () => {
    const luminance = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ink = luminance('#18203A');
    for (const color of AVATAR_PALETTE) {
      const ratio = (luminance(color) + 0.05) / (ink + 0.05);
      assert.ok(ratio >= 4.5, `${color} tiene contraste ${ratio.toFixed(2)}`);
    }
  });

  test('generateInternalFolio tiene prefijo, longitud y alfabeto sin ambigüedades', () => {
    const folio = generateInternalFolio();
    assert.match(folio, /^AXI-[A-Z2-9]{8}$/);
    assert.ok([...folio.slice(4)].every((ch) => CODE_ALPHABET.includes(ch)));
    assert.ok(!/[01OIL]/.test(folio.slice(4)));
  });

  test('generateJoinCode produce 6 caracteres válidos', () => {
    const code = generateJoinCode();
    assert.equal(code.length, 6);
    assert.equal(normalizeJoinCode(code), code);
  });

  test('normalizeJoinCode acepta minúsculas y espacios, rechaza formatos inválidos', () => {
    assert.equal(normalizeJoinCode(' abc 234 '), 'ABC234');
    assert.equal(normalizeJoinCode('ABC12'), null);
    assert.equal(normalizeJoinCode('ABCO23'), null);
  });

  test('buildNewStudent arma los datos derivados sin CURP', () => {
    const student = buildNewStudent({ firstNames: ' sofía ', lastNames: 'RAMÍREZ garcía' }, sequence(0));
    assert.deepEqual(student, {
      first_names: 'Sofía',
      last_names: 'Ramírez García',
      initials: 'SR',
      avatar_color: AVATAR_PALETTE[0],
      internal_folio: 'AXI-AAAAAAAA',
    });
    assert.ok(!Object.keys(student).some((k) => /curp/i.test(k)));
  });
});

describe('validación de entradas de grupos', () => {
  const code = (fn) => {
    try {
      fn();
    } catch (error) {
      return error.code;
    }
    return 'NO_ERROR';
  };

  test('parsePositiveId acepta enteros positivos y rechaza el resto', () => {
    assert.equal(parsePositiveId('12'), 12);
    for (const value of ['0', '-1', '1.5', 'abc', '', undefined, '1e3', '9'.repeat(16)]) {
      assert.equal(code(() => parsePositiveId(value)), 'VALIDATION_ERROR', String(value));
    }
  });

  test('grado 1–6, sección de 1 o 2 letras y ciclo con años consecutivos', () => {
    assert.equal(parseGrade(6), 6);
    assert.equal(parseGrade(' 3 '), 3);
    for (const g of [0, 7, 2.5, '3a', null, true]) assert.equal(code(() => parseGrade(g)), 'VALIDATION_ERROR');
    assert.equal(parseSection(' ab '), 'AB');
    for (const s of ['', 'ABC', '1', 'Ñ', 5]) assert.equal(code(() => parseSection(s)), 'VALIDATION_ERROR');
    assert.equal(parseSchoolYear('2026-2027'), '2026-2027');
    for (const y of ['2026', '2026-2028', '2027-2026', '1999-2000', '2026/2027']) {
      assert.equal(code(() => parseSchoolYear(y)), 'VALIDATION_ERROR', y);
    }
  });

  test('parseGroupInput exige todo; parseGroupPatch al menos un campo', () => {
    assert.deepEqual(parseGroupInput({ grade: 3, section: 'a', schoolYear: '2026-2027' }), { grade: 3, section: 'A', schoolYear: '2026-2027' });
    assert.equal(code(() => parseGroupInput({ grade: 3 })), 'VALIDATION_ERROR');
    assert.deepEqual(parseGroupPatch({ section: 'b' }), { section: 'B' });
    assert.equal(code(() => parseGroupPatch({})), 'VALIDATION_ERROR');
    assert.equal(code(() => parseGroupPatch(undefined)), 'VALIDATION_ERROR');
  });

  test('nombres de alumno: letras con acentos, guion, apóstrofo y punto', () => {
    assert.ok(isValidNamePart("María-José O'Neil"));
    assert.ok(isValidNamePart('Ma. Fernanda'));
    for (const t of ['', 'Ana1', '<b>', '-Ana', 'A'.repeat(MAX_NAME_LENGTH + 1), null]) assert.equal(isValidNamePart(t), false);
    assert.deepEqual(parseStudentInput({ firstNames: ' ana ', lastNames: 'RUIZ' }), { firstNames: 'Ana', lastNames: 'Ruiz' });
    assert.equal(code(() => parseStudentInput({ firstNames: 'Ana' })), 'VALIDATION_ERROR');
  });

  test('parseBulkStudentList marca como inválidas las líneas con dígitos o símbolos', () => {
    const { students, invalidLines } = parseBulkStudentList('Ana Ruiz\nPedro 123 Gómez\n<x> Soto');
    assert.deepEqual(students, [{ firstNames: 'Ana', lastNames: 'Ruiz' }]);
    assert.deepEqual(invalidLines.map((l) => l.line), [2, 3]);
  });

  test('parseBulkInput: límite de líneas y rechazo total si alguna es inválida', () => {
    assert.deepEqual(parseBulkInput({ text: 'Ana Ruiz\nLuis Soto' }), [
      { firstNames: 'Ana', lastNames: 'Ruiz' },
      { firstNames: 'Luis', lastNames: 'Soto' },
    ]);
    let error;
    try {
      parseBulkInput({ text: 'Ana Ruiz\nXimena' });
    } catch (e) {
      error = e;
    }
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.deepEqual(error.details.invalidLines, [{ line: 2, text: 'Ximena' }]);
    assert.equal(code(() => parseBulkInput({})), 'VALIDATION_ERROR');
    assert.equal(code(() => parseBulkInput({ text: 123 })), 'VALIDATION_ERROR');
    const limit = Array(MAX_BULK_LINES).fill('Ana Ruiz').join('\n\n');
    assert.equal(parseBulkInput({ text: limit }).length, MAX_BULK_LINES, 'las líneas vacías no cuentan');
    assert.equal(code(() => parseBulkInput({ text: `${limit}\nEva Luna` })), 'VALIDATION_ERROR');
  });

  test('assertGroupPatchAllowed: con historial no cambian grado ni ciclo', () => {
    const group = { grade: 3, school_year: '2026-2027' };
    assert.equal(code(() => assertGroupPatchAllowed(group, { grade: 4 }, true)), 'GROUP_HAS_HISTORY');
    assert.equal(code(() => assertGroupPatchAllowed(group, { schoolYear: '2027-2028' }, true)), 'GROUP_HAS_HISTORY');
    assert.equal(code(() => assertGroupPatchAllowed(group, { section: 'B' }, true)), 'NO_ERROR');
    assert.equal(code(() => assertGroupPatchAllowed(group, { grade: 3, schoolYear: '2026-2027' }, true)), 'NO_ERROR', 'mismo valor');
    assert.equal(code(() => assertGroupPatchAllowed(group, { grade: 4, schoolYear: '2027-2028' }, false)), 'NO_ERROR');
  });

  test('parseAvatarPatch usa listas cerradas', () => {
    assert.deepEqual(parseAvatarPatch({ avatarId: 'azul' }), { avatarId: 'azul' });
    assert.deepEqual(parseAvatarPatch({ avatarId: null }), { avatarId: null });
    assert.deepEqual(parseAvatarPatch({ avatarColor: AVATAR_PALETTE[1].toLowerCase() }), { avatarColor: AVATAR_PALETTE[1] });
    assert.ok(!AVATAR_IDS.includes('linea'));
    for (const body of [{}, { avatarId: 'linea' }, { avatarColor: '#000000' }]) {
      assert.equal(code(() => parseAvatarPatch(body)), 'VALIDATION_ERROR');
    }
  });

  test('los DTO no exponen el folio interno', () => {
    const row = { id: 1, first_names: 'Ana', last_names: 'Ruiz', initials: 'AR', avatar_color: '#F4B6C2', avatar_id: null, internal_folio: 'AXI-X' };
    assert.ok(!('internalFolio' in toStudentDto(row)) && !JSON.stringify(toStudentDto(row)).includes('AXI-'));
    const group = toGroupDto({ id: 2, grade: 3, section: 'A', school_year: '2026-2027', join_code: 'MAPA3A', teacher_id: 7, student_count: 45 }, 4);
    assert.equal(group.name, '3.º A');
    assert.equal(group.studentCount, 45);
  });
});
