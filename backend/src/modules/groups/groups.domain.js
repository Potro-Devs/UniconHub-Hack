/**
 * Módulo groups — Capa 3 (Dominio): identificación de alumnos, folio interno y códigos de grupo.
 * Funciones puras sin I/O (AGENTS.md §1.2 y §4.8). La aleatoriedad se inyecta con `random`.
 */

/**
 * Paleta accesible para avatares: tonos claros con contraste ≥ 4.5:1 frente a texto `#18203A`.
 */
export const AVATAR_PALETTE = Object.freeze([
  '#F4B6C2', // rosa
  '#F9E08B', // amarillo
  '#A8DCEB', // azul cielo
  '#B5E3C4', // verde menta
  '#D7C4F2', // lavanda
  '#FFCBA4', // durazno
  '#C9D8F5', // azul claro
  '#E3E8A1', // lima
]);

/** Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;
export const FOLIO_PREFIX = 'AXI-';
export const FOLIO_LENGTH = 8;

const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

/**
 * Quita espacios sobrantes y aplica mayúscula inicial a cada palabra,
 * excepto partículas como "de la" (salvo al inicio).
 *
 * @example normalizeName('  JUAN   DE LA CRUZ ') // 'Juan de la Cruz'
 */
export function normalizeName(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, idx) => {
      const lower = word.toLocaleLowerCase('es-MX');
      if (idx > 0 && NAME_PARTICLES.has(lower)) return lower;
      return lower.replace(/(^|-)(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('es-MX'));
    })
    .join(' ');
}

/**
 * Dos letras en mayúsculas: inicial del primer nombre + inicial del primer apellido.
 *
 * @example buildInitials('Ana Paula', 'Ramírez López') // 'AR'
 */
export function buildInitials(firstNames, lastNames) {
  const first = normalizeName(firstNames).charAt(0);
  const last = normalizeName(lastNames).charAt(0);
  if (!first || !last) {
    throw new RangeError('Se necesitan nombre y apellido para generar las iniciales.');
  }
  return `${first}${last}`.toLocaleUpperCase('es-MX');
}

/**
 * Separa un nombre completo en nombres y apellidos.
 *
 * - Con coma: `"Ramírez López, Ana Paula"` → apellidos antes de la coma.
 * - Sin coma: los dos últimos términos son apellidos (uno solo si hay dos palabras).
 *
 * @returns {{ firstNames: string, lastNames: string } | null} `null` si no hay al menos nombre y apellido.
 */
export function parseStudentName(fullName) {
  const text = String(fullName ?? '').trim();
  if (!text) return null;

  if (text.includes(',')) {
    const [lastNames, firstNames] = text.split(',', 2).map(normalizeName);
    return firstNames && lastNames ? { firstNames, lastNames } : null;
  }

  const words = normalizeName(text).split(' ');
  if (words.length < 2) return null;
  const surnameCount = words.length >= 3 ? 2 : 1;
  return {
    firstNames: words.slice(0, -surnameCount).join(' '),
    lastNames: words.slice(-surnameCount).join(' '),
  };
}

/**
 * Procesa una lista pegada (un alumno por línea). Ignora líneas vacías y viñetas o numeración.
 *
 * @returns {{ students: Array<{ firstNames: string, lastNames: string }>, invalidLines: Array<{ line: number, text: string }> }}
 */
export function parseBulkStudentList(text) {
  const students = [];
  const invalidLines = [];
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((raw, idx) => {
      const cleaned = raw.replace(/^\s*(?:[-*•]|\d+[.)-]?)\s+/, '').trim();
      if (!cleaned) return;
      const parsed = parseStudentName(cleaned);
      if (parsed) students.push(parsed);
      else invalidLines.push({ line: idx + 1, text: raw.trim() });
    });
  return { students, invalidLines };
}

function randomCode(length, random) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Color aleatorio de la paleta accesible.
 */
export function pickAvatarColor(random = Math.random) {
  return AVATAR_PALETTE[Math.floor(random() * AVATAR_PALETTE.length)];
}

/**
 * Folio interno único (p. ej. `AXI-7K3QH9WD`). Une el historial entre grados; no deriva de datos
 * personales. El servicio debe reintentar si ya existe.
 */
export function generateInternalFolio(random = Math.random) {
  return FOLIO_PREFIX + randomCode(FOLIO_LENGTH, random);
}

/**
 * Código de acceso del grupo para el portal del alumno (6 caracteres).
 */
export function generateJoinCode(random = Math.random) {
  return randomCode(JOIN_CODE_LENGTH, random);
}

/**
 * Normaliza lo que escribe el alumno y valida el formato del código de grupo.
 *
 * @returns {string | null} Código normalizado, o `null` si no es válido.
 */
export function normalizeJoinCode(input) {
  const code = String(input ?? '').replace(/\s+/g, '').toUpperCase();
  const valid = code.length === JOIN_CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));
  return valid ? code : null;
}

/**
 * Datos derivados de un alumno nuevo (antes de guardarlo).
 */
export function buildNewStudent({ firstNames, lastNames }, random = Math.random) {
  const first = normalizeName(firstNames);
  const last = normalizeName(lastNames);
  return {
    first_names: first,
    last_names: last,
    initials: buildInitials(first, last),
    avatar_color: pickAvatarColor(random),
    internal_folio: generateInternalFolio(random),
  };
}
