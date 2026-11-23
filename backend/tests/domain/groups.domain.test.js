import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  AVATAR_PALETTE,
  CODE_ALPHABET,
  buildInitials,
  buildNewStudent,
  generateInternalFolio,
  generateJoinCode,
  normalizeJoinCode,
  normalizeName,
  parseBulkStudentList,
  parseStudentName,
  pickAvatarColor,
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
