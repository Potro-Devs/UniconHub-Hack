/**
 * Reglas de la sesión del navegador (funciones puras, sin React ni Vite).
 *
 * Se guarda en `sessionStorage`: en una computadora compartida del salón la sesión
 * desaparece al cerrar la pestaña.
 */

export const SESSION_STORAGE_KEY = 'axi.session';

export const STAFF_ROLES = Object.freeze(['teacher', 'director']);

/** Pantallas del director (coincidencia exacta: evita rutas como `/direccion/panelX` o con `..`). */
const DIRECTOR_PATHS = Object.freeze(['/direccion/panel', '/direccion/docentes', '/direccion/promover', '/direccion/traslados']);

/**
 * Convierte la respuesta de login / quick-login / student-join/select en una sesión.
 */
export function toSession(data) {
  const role = data.user ? data.user.role : 'student';
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    role,
    user: data.user ?? null,
    student: data.student ?? null,
    group: data.group ?? null,
  };
}

/**
 * Actualiza los datos públicos con la respuesta de `GET /auth/me`.
 */
export function mergeMe(session, me) {
  if (!session) return session;
  return me.role === 'student'
    ? { ...session, role: 'student', student: me.student, group: me.group }
    : { ...session, role: me.role, user: me.user };
}

export function isSessionValid(session, now = Date.now()) {
  return Boolean(session?.token) && Date.parse(session.expiresAt) > now;
}

/**
 * Lee la sesión guardada; descarta datos corruptos o expirados.
 */
export function readStoredSession(storage, now = Date.now()) {
  try {
    const raw = storage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return isSessionValid(session, now) ? session : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(storage, session) {
  try {
    if (session) storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else storage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Almacenamiento bloqueado (modo privado, políticas del navegador): la sesión vive solo en memoria.
  }
}

/**
 * Pantalla de inicio según el rol.
 */
export function homePathFor(session) {
  if (!session) return '/login';
  if (session.role === 'student') return '/alumno/inicio';
  return session.role === 'director' ? '/direccion/panel' : '/docente/grupos';
}

/**
 * Ruta a la que volver después del login, solo si corresponde al rol (evita redirecciones raras).
 */
export function safeReturnPath(from, session) {
  if (typeof from !== 'string' || !from.startsWith('/')) return homePathFor(session);
  const studentArea = from.startsWith('/alumno');
  // Dirección solo vuelve a sus pantallas; el docente, solo al área docente.
  if (session?.role === 'director') return DIRECTOR_PATHS.includes(from) ? from : homePathFor(session);
  if (session?.role === 'teacher' && from.startsWith('/docente')) return from;
  if (session?.role === 'student' && studentArea) return from;
  return homePathFor(session);
}

const TITLES = /^(mtr[oa]|maestr[oa]|prof(esor)?a?|lic|dr|dra)\.?\s+/i;

/**
 * Iniciales para el avatar del encabezado: "Mtra. Elena Torres" → "ET".
 */
export function initialsOf(fullName) {
  const words = String(fullName ?? '').trim().replace(TITLES, '').split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * Normaliza lo que escribe el alumno en el código de grupo (máx. 6 letras/números).
 */
export function normalizeJoinCodeInput(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
