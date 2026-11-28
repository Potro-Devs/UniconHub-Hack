/**
 * Módulo groups — Capa 3 (Dominio): identificación de alumnos, folio interno y códigos de grupo.
 * Funciones puras sin I/O (AGENTS.md §1.2 y §4.8). La aleatoriedad se inyecta con `random`.
 */
import { DomainError } from '../../shared/errors/DomainError.js';

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
 * Una línea es inválida si no tiene nombre y apellido, o si alguno no pasa `isValidNamePart`.
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
      if (parsed && isValidNamePart(parsed.firstNames) && isValidNamePart(parsed.lastNames)) students.push(parsed);
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

// ───────────────────────── Validación de entradas (API de grupos) ─────────────────────────

/**
 * Variantes de avatar/mascota que el frontend sabe dibujar (`MASCOT_PALETTES` en
 * `frontend/src/features/mascot/mascot.config.js`). Se excluye `linea` (variante B/N de impresión).
 */
export const AVATAR_IDS = Object.freeze(['rosa', 'azul', 'amarillo', 'lila']);

/** Límite de líneas no vacías por carga masiva (un grupo grande ronda 45 alumnos). */
export const MAX_BULK_LINES = 60;
export const MAX_NAME_LENGTH = 80;
export const MIN_GRADE = 1;
export const MAX_GRADE = 6;

const SECTION_PATTERN = /^[A-Z]{1,2}$/;
const SCHOOL_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;
// Letras (con acentos), espacios, guion, apóstrofo y punto; debe empezar con letra.
const NAME_PATTERN = /^\p{L}[\p{L}\p{M} '.-]*$/u;

const invalid = (message, details) => new DomainError('VALIDATION_ERROR', message, details);

/**
 * Id numérico de la ruta (`:groupId`, `:studentId`). Lanza `VALIDATION_ERROR` si no es entero positivo.
 */
export function parsePositiveId(value, label = 'id') {
  const text = String(value ?? '');
  const id = /^\d{1,15}$/.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw invalid(`El ${label} debe ser un número entero positivo.`);
  }
  return id;
}

/** Grado 1–6. Acepta número entero o texto con dígitos (`"3"`). */
export function parseGrade(value) {
  const grade = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  if (!Number.isInteger(grade) || grade < MIN_GRADE || grade > MAX_GRADE) {
    throw invalid(`El grado debe ser un número del ${MIN_GRADE} al ${MAX_GRADE}.`);
  }
  return grade;
}

/** Grupo/sección: 1 o 2 letras A–Z; se guarda en mayúsculas. */
export function parseSection(value) {
  const section = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!SECTION_PATTERN.test(section)) {
    throw invalid('El grupo debe ser de 1 o 2 letras (p. ej. "A").');
  }
  return section;
}

/** Ciclo escolar `AAAA-AAAA` con años consecutivos (p. ej. `2026-2027`), entre 2000 y 2100. */
export function parseSchoolYear(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = SCHOOL_YEAR_PATTERN.exec(text);
  const start = match ? Number(match[1]) : NaN;
  if (!match || Number(match[2]) !== start + 1 || start < 2000 || start > 2099) {
    throw invalid('El ciclo escolar debe tener el formato AAAA-AAAA con años consecutivos (p. ej. 2026-2027).');
  }
  return text;
}

/** Cuerpo de `POST /groups`: los tres campos son obligatorios. */
export function parseGroupInput(body) {
  return {
    grade: parseGrade(body?.grade),
    section: parseSection(body?.section),
    schoolYear: parseSchoolYear(body?.schoolYear),
  };
}

/** Cuerpo de `PATCH /groups/:groupId`: al menos un campo; solo se validan los presentes. */
export function parseGroupPatch(body) {
  const patch = {};
  if (body?.grade !== undefined) patch.grade = parseGrade(body.grade);
  if (body?.section !== undefined) patch.section = parseSection(body.section);
  if (body?.schoolYear !== undefined) patch.schoolYear = parseSchoolYear(body.schoolYear);
  if (Object.keys(patch).length === 0) {
    throw invalid('Indica al menos un dato para cambiar: grade, section o schoolYear.');
  }
  return patch;
}

/** Nombre o apellido ya normalizado: empieza con letra, sin dígitos ni símbolos, ≤ 80 caracteres. */
export function isValidNamePart(text) {
  return typeof text === 'string' && text.length > 0 && text.length <= MAX_NAME_LENGTH && NAME_PATTERN.test(text);
}

/**
 * Cuerpo de `POST /groups/:groupId/students`.
 *
 * @returns {{ firstNames: string, lastNames: string }} Nombres normalizados.
 */
export function parseStudentInput(body) {
  const firstNames = normalizeName(typeof body?.firstNames === 'string' ? body.firstNames : '');
  const lastNames = normalizeName(typeof body?.lastNames === 'string' ? body.lastNames : '');
  if (!isValidNamePart(firstNames) || !isValidNamePart(lastNames)) {
    throw invalid(`Escribe nombre(s) y apellido(s) con letras (máximo ${MAX_NAME_LENGTH} caracteres cada uno).`);
  }
  return { firstNames, lastNames };
}

/**
 * Cuerpo de `PATCH /groups/:groupId/students/:studentId`: `{ firstNames?, lastNames? }`, al menos uno.
 * Mismas reglas que el alta; las iniciales se recalculan con el nombre completo resultante.
 *
 * @returns {{ firstNames?: string, lastNames?: string }} Solo los campos enviados, ya normalizados.
 */
export function parseStudentPatch(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid('Envía el nombre o los apellidos a corregir.');
  const patch = {};
  for (const field of ['firstNames', 'lastNames']) {
    if (body[field] === undefined) continue;
    const value = normalizeName(typeof body[field] === 'string' ? body[field] : '');
    if (!isValidNamePart(value)) {
      throw invalid(`Escribe nombre(s) y apellido(s) con letras (máximo ${MAX_NAME_LENGTH} caracteres cada uno).`, { field });
    }
    patch[field] = value;
  }
  if (Object.keys(patch).length === 0) throw invalid('Indica el nombre o los apellidos a corregir.');
  return patch;
}

/**
 * ¿El alumno tiene algo que perder si se elimina? Respuestas, cortes de dominio, logros, pistas,
 * tutorías o inscripciones en otros grupos (historial de otro grado). En ese caso solo se da de baja.
 *
 * @param {{ responses: number, masteryCuts: number, achievements: number, hintRequests: number, tutoringPairs: number, otherEnrollments: number }} counts
 */
export function studentHasHistory(counts) {
  return Object.values(counts).some((n) => n > 0);
}

/**
 * Cuerpo de `POST /groups/:groupId/students/bulk` (`{ text }`). Aplica el límite de líneas y
 * rechaza el lote completo si alguna línea es inválida (`details.invalidLines`), para que la
 * docente corrija la lista y la vuelva a pegar sin altas parciales.
 */
export function parseBulkInput(body) {
  if (typeof body?.text !== 'string' || body.text.trim() === '') {
    throw invalid('Pega la lista de alumnos, uno por línea.');
  }
  const lineCount = body.text.split(/\r?\n/).filter((line) => line.trim() !== '').length;
  if (lineCount > MAX_BULK_LINES) {
    throw invalid(`La lista tiene ${lineCount} líneas; el máximo es ${MAX_BULK_LINES} por carga.`, {
      maxLines: MAX_BULK_LINES,
      lineCount,
    });
  }
  const { students, invalidLines } = parseBulkStudentList(body.text);
  if (invalidLines.length > 0) {
    throw invalid(
      `Revisa ${invalidLines.length === 1 ? 'la línea' : 'las líneas'} ${invalidLines.map((l) => l.line).join(', ')}: ` +
        'cada alumno necesita nombre y apellido con letras. No se guardó ningún alumno.',
      { invalidLines },
    );
  }
  return students;
}

/**
 * Regla: el grado y el ciclo de un grupo solo cambian si aún no tiene historial (inscripciones de
 * cualquier estado ni asignaciones); cambiarlos reescribiría el historial longitudinal.
 * Un valor igual al actual no cuenta como cambio.
 *
 * @param {{ grade: number, school_year: string }} group Fila actual.
 * @param {{ grade?: number, schoolYear?: string }} patch Cambios validados.
 * @param {boolean} hasHistory
 */
export function assertGroupPatchAllowed(group, patch, hasHistory) {
  const changesGrade = patch.grade !== undefined && patch.grade !== group.grade;
  const changesYear = patch.schoolYear !== undefined && patch.schoolYear !== group.school_year;
  if (hasHistory && (changesGrade || changesYear)) {
    throw new DomainError(
      'GROUP_HAS_HISTORY',
      'Este grupo ya tiene alumnos o pruebas: no se puede cambiar el grado ni el ciclo. Solo puedes cambiar la letra del grupo.',
    );
  }
}

/**
 * Cuerpo de `PATCH /groups/students/:studentId/avatar`: `avatarId` (lista cerrada `AVATAR_IDS`,
 * o `null` para quitarlo) y/o `avatarColor` (de `AVATAR_PALETTE`).
 */
export function parseAvatarPatch(body) {
  const patch = {};
  if (body?.avatarId !== undefined) {
    if (body.avatarId !== null && !AVATAR_IDS.includes(body.avatarId)) {
      throw invalid(`Avatar no válido. Usa uno de: ${AVATAR_IDS.join(', ')}.`);
    }
    patch.avatarId = body.avatarId;
  }
  if (body?.avatarColor !== undefined) {
    const color = typeof body.avatarColor === 'string' ? body.avatarColor.trim().toUpperCase() : '';
    if (!AVATAR_PALETTE.includes(color)) {
      throw invalid('Color no válido. Elige uno de la paleta.');
    }
    patch.avatarColor = color;
  }
  if (Object.keys(patch).length === 0) {
    throw invalid('Indica avatarId o avatarColor.');
  }
  return patch;
}

/**
 * Grupo para la API del personal escolar. `phase` se recibe ya calculada (`phaseForGrade`).
 */
export function toGroupDto(row, phase) {
  return {
    id: row.id,
    name: `${row.grade}.º ${row.section}`,
    grade: row.grade,
    section: row.section,
    schoolYear: row.school_year,
    phase,
    joinCode: row.join_code,
    teacherId: row.teacher_id ?? null,
    studentCount: row.student_count ?? 0,
    // Hasta cuándo pueden los alumnos elegir su imagen secreta (texto UTC de SQLite) o null.
    secretSetupUntil: row.secret_setup_until ?? null,
  };
}

/**
 * Alumno para contextos autenticados de la escuela: nombre completo, sin `internal_folio`.
 */
export function toStudentDto(row) {
  return {
    id: row.id,
    firstNames: row.first_names,
    lastNames: row.last_names,
    initials: row.initials,
    avatarColor: row.avatar_color,
    avatarId: row.avatar_id ?? null,
    // Solo si ya configuró su imagen secreta; el hash nunca sale del servidor.
    hasSecret: Boolean(row.secret_hash),
  };
}
