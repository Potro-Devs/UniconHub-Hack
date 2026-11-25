/**
 * Reglas de presentación de grupos (funciones puras, sin React ni Vite) para poder
 * probarlas con `node --test`. No calculan niveles ni recomendaciones: solo formato,
 * selección del grupo activo y mapeo de errores de `/api/v1/groups` a mensajes.
 */

/**
 * Máximo de renglones no vacíos por carga masiva.
 * Debe coincidir con `MAX_BULK_LINES` de `backend/src/modules/groups/groups.domain.js`.
 */
export const MAX_BULK_LINES = 60;
/** Tamaño máximo del archivo de importación (igual que el servidor). */
export const MAX_IMPORT_BYTES = 60 * 1024;

export const GRADES = Object.freeze([1, 2, 3, 4, 5, 6]);
export const SECTIONS = Object.freeze(['A', 'B', 'C', 'D']);
/**
 * Ciclos en formato de la API (`AAAA-AAAA`). El primero es el predeterminado.
 * Deben pasar `parseSchoolYear` de `backend/src/modules/groups/groups.domain.js`.
 */
export const SCHOOL_YEARS = Object.freeze(['2026-2027', '2027-2028']);

export const ACTIVE_GROUP_STORAGE_PREFIX = 'axi.activeGroupId';

/** `3` → `3.º` */
export const gradeLabel = (grade) => `${grade}.º`;

/** `(3, 'A')` → `3.º A` */
export const groupLabel = (grade, section) => `${gradeLabel(grade)} ${section}`;

/**
 * Fase SEP según el grado: 1–2 → 3, 3–4 → 4, 5–6 → 5 (misma regla que el backend).
 * Solo para la vista previa de un grado elegido; con un grupo existente se usa `group.phase`.
 */
export function phaseForGrade(grade) {
  const g = Number(grade);
  if (!Number.isInteger(g) || g < 1 || g > 6) return null;
  return Math.ceil(g / 2) + 2;
}

/** `2026-2027` → `2026–2027` (guion largo para mostrar). */
export const schoolYearToDisplay = (value) => String(value ?? '').replace(/\s*[-–—]\s*/, '–');

/** `2026–2027` → `2026-2027` (formato que espera la API). */
export const schoolYearToApi = (value) => String(value ?? '').trim().replace(/\s*[-–—]\s*/, '-');

/** `MAPA3A` → `MAP A3A` (3 + 3 para leerlo en voz alta o copiarlo del pizarrón). */
export function formatJoinCode(code) {
  const clean = String(code ?? '').replace(/\s+/g, '').toUpperCase();
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3)}`;
}

/** Quita espacios para copiarlo al portapapeles. */
export const joinCodeForCopy = (code) => String(code ?? '').replace(/\s+/g, '').toUpperCase();

/** Ordena por grado y luego por sección. No modifica el arreglo original. */
export function sortGroups(groups) {
  return [...(groups ?? [])].sort(
    (a, b) => a.grade - b.grade || String(a.section).localeCompare(String(b.section), 'es-MX'),
  );
}

/**
 * Grupo activo: el último usado si sigue en la lista; si no, el primero por grado y sección.
 * Con la lista vacía devuelve `null`.
 */
export function pickActiveGroup(groups, storedId) {
  if (!groups?.length) return null;
  const stored = groups.find((g) => String(g.id) === String(storedId));
  return stored ?? sortGroups(groups)[0];
}

/** Clave de `localStorage` por docente: es una preferencia del dispositivo. */
export const activeGroupStorageKey = (userId) => `${ACTIVE_GROUP_STORAGE_PREFIX}.${userId ?? 'anon'}`;

export function readStoredActiveGroupId(storage, userId) {
  try {
    return storage?.getItem(activeGroupStorageKey(userId)) ?? null;
  } catch {
    return null;
  }
}

export function writeStoredActiveGroupId(storage, userId, groupId) {
  try {
    if (groupId == null) storage?.removeItem(activeGroupStorageKey(userId));
    else storage?.setItem(activeGroupStorageKey(userId), String(groupId));
  } catch {
    // Almacenamiento bloqueado: la preferencia vive solo en memoria.
  }
}

/** Renglones no vacíos de la lista pegada (mismo criterio que el backend). */
export const countListLines = (text) =>
  String(text ?? '').split(/\r?\n/).filter((line) => line.trim() !== '').length;

/** Busca un grupo con el mismo grado, sección y ciclo (para el botón `Ir a {name}`). */
export function findSameGroup(groups, { grade, section, schoolYear }, excludeId = null) {
  return (
    (groups ?? []).find(
      (g) =>
        g.grade === Number(grade) &&
        String(g.section).toUpperCase() === String(section).toUpperCase() &&
        schoolYearToApi(g.schoolYear) === schoolYearToApi(schoolYear) &&
        String(g.id) !== String(excludeId),
    ) ?? null
  );
}

/** Alumnos por apellidos (y luego nombres) con orden alfabético en español. */
export function sortStudents(students) {
  return [...(students ?? [])].sort(
    (a, b) =>
      String(a.lastNames).localeCompare(String(b.lastNames), 'es-MX', { sensitivity: 'base' }) ||
      String(a.firstNames).localeCompare(String(b.firstNames), 'es-MX', { sensitivity: 'base' }),
  );
}

/* ---------- Mensajes (sin tecnicismos ni términos punitivos) ---------- */

export const MESSAGES = Object.freeze({
  createNetwork: 'No se pudo crear el grupo. Revisa tu conexión e intenta de nuevo.',
  createGeneric: 'No se pudo crear el grupo. Intenta de nuevo.',
  editNetwork: 'No se pudieron guardar los cambios. Revisa tu conexión e intenta de nuevo.',
  editGeneric: 'No se pudieron guardar los cambios. Intenta de nuevo.',
  historyLock:
    'El grado y el ciclo ya no se pueden cambiar porque este grupo ya tiene alumnos o pruebas. Así cuidamos su historial. Sí puedes cambiar la sección.',
  bulkTooMany: `Son más de ${MAX_BULK_LINES} renglones. Divide la lista y guárdala en dos partes.`,
  bulkNetwork: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo. Tu lista sigue aquí.',
  bulkGeneric: 'No se pudo guardar la lista. Intenta de nuevo. Tu lista sigue aquí.',
  studentInvalidName: 'Revisa el nombre: usa solo letras, espacios, guion o apóstrofo.',
  studentNetwork: 'No se pudo agregar al alumno. Revisa tu conexión e intenta de nuevo.',
  studentGeneric: 'No se pudo agregar al alumno. Intenta de nuevo.',
});

/** Solo un fallo de conexión (`ApiError` con `NETWORK_ERROR`) pide revisar la conexión. */
export const isNetworkError = (error) => error?.code === 'NETWORK_ERROR';

/** Error de `POST /groups` o `PATCH /groups/:id`. */
export function classifyGroupSaveError(error) {
  if (error?.status === 409 && error.code === 'GROUP_ALREADY_EXISTS') return 'duplicate';
  if (error?.status === 409 && error.code === 'GROUP_HAS_HISTORY') return 'history';
  if (isNetworkError(error)) return 'network';
  return 'generic';
}

/**
 * Error de `POST /groups/:id/students/bulk`.
 * @returns {{ kind: 'invalidLines', lines: Array<{ line: number, text: string }> }
 *   | { kind: 'tooMany', lineCount: number | null }
 *   | { kind: 'network' } | { kind: 'generic' }}
 */
export function classifyBulkError(error) {
  const details = error?.details;
  if (error?.status === 400 && Array.isArray(details?.invalidLines) && details.invalidLines.length) {
    return { kind: 'invalidLines', lines: details.invalidLines };
  }
  if (error?.status === 400 && details?.maxLines != null) {
    return { kind: 'tooMany', lineCount: details.lineCount ?? null };
  }
  if (isNetworkError(error)) return { kind: 'network' };
  return { kind: 'generic' };
}

/** Error de `POST /groups/:id/students`. */
export function classifyAddStudentError(error) {
  if (error?.status === 400) return 'invalidName';
  if (isNetworkError(error)) return 'network';
  return 'generic';
}

/* ---------- Borradores de la lista pegada (uno por grupo, por docente) ---------- */

/** Estado inicial: los borradores pertenecen a un usuario y viven solo en memoria. */
export const emptyDrafts = (userId) => ({ userId: userId ?? null, byGroup: {} });

/** Si cambió el usuario, descarta todos los borradores (computadora compartida). */
export const draftsForUser = (state, userId) =>
  state && state.userId === (userId ?? null) ? state : emptyDrafts(userId);

export const getDraft = (state, groupId) => state?.byGroup?.[String(groupId)] ?? '';

/** Guarda (o borra, con texto vacío) el borrador de un grupo sin tocar los demás. */
export function setDraft(state, groupId, text) {
  const byGroup = { ...(state?.byGroup ?? {}) };
  if (text) byGroup[String(groupId)] = text;
  else delete byGroup[String(groupId)];
  return { userId: state?.userId ?? null, byGroup };
}

/* ---------- Contraste de las iniciales sobre el color del avatar ---------- */

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos colores hex; `null` si alguno no es hex. */
export function contrastRatio(a, b) {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const [l1, l2] = [luminance(ra), luminance(rb)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Color del texto de las iniciales: el oscuro si da 4.5:1; si no, el que contraste más.
 * Los colores llegan como parámetro (tokens de `brand.js`) para no depender de Vite.
 * Si el fondo no es hex (no debería pasar con `AVATAR_PALETTE`), usa el oscuro.
 */
export function readableTextOn(background, dark, light) {
  const darkRatio = contrastRatio(background, dark);
  if (darkRatio == null || darkRatio >= 4.5) return dark;
  const lightRatio = contrastRatio(background, light) ?? 0;
  return lightRatio > darkRatio ? light : dark;
}
