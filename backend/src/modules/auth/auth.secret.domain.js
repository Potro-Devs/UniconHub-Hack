/**
 * Módulo auth — Capa 3 (Dominio): imagen secreta del alumno. Funciones puras (sin I/O).
 *
 * No es seguridad de banco: el objetivo es evitar que un alumno entre por error con la tarjeta
 * de un compañero (y contamine su diagnóstico). Por eso basta con 1 imagen de 9 en 1.º y 2.º
 * y 2 imágenes en orden (81 combinaciones) de 3.º a 6.º, más un límite de intentos por alumno.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../shared/errors/DomainError.js';

/** Catálogo de imágenes. El frontend decide cómo dibujarlas a partir del `code`. */
export const SECRET_IMAGES = Object.freeze([
  { code: 'turtle', label: 'Tortuga' },
  { code: 'cat', label: 'Gato' },
  { code: 'dog', label: 'Perro' },
  { code: 'fish', label: 'Pez' },
  { code: 'butterfly', label: 'Mariposa' },
  { code: 'sun', label: 'Sol' },
  { code: 'star', label: 'Estrella' },
  { code: 'flower', label: 'Flor' },
  { code: 'tree', label: 'Árbol' },
]);
const CODES = new Set(SECRET_IMAGES.map((i) => i.code));

/** Duración de la ventana de configuración (minutos): por defecto y límites. */
export const SECRET_SETUP_MINUTES = Object.freeze({ default: 60, min: 5, max: 240 });

/** 1 imagen en 1.º y 2.º (todavía leen poco); 2 en orden de 3.º a 6.º. */
export function secretLengthForGrade(grade) {
  return Number(grade) <= 2 ? 1 : 2;
}

/** Texto de SQLite (`AAAA-MM-DD HH:MM:SS`, UTC) → milisegundos; null si no hay valor. */
export function sqliteTimeToMs(value) {
  if (!value) return null;
  const ms = Date.parse(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function isSetupWindowOpen(until, now = Date.now()) {
  const ms = sqliteTimeToMs(until);
  return ms !== null && ms > now;
}

/**
 * Qué sigue después de que el alumno toca su tarjeta:
 * - `verify`: ya tiene imagen → debe tocarla.
 * - `setup`: no tiene imagen y la docente abrió la ventana → la elige ahora.
 * - `ask_teacher`: no tiene imagen y la ventana está cerrada → pedir ayuda a la maestra.
 */
export function nextJoinStep({ hasSecret, windowOpen }) {
  if (hasSecret) return 'verify';
  return windowOpen ? 'setup' : 'ask_teacher';
}

/** Valida `{ images: [code, …] }` con exactamente `length` imágenes del catálogo (se permiten repetidas). */
export function parseSecretImages(body, length) {
  const images = body?.images;
  if (!Array.isArray(images) || images.length !== length || !images.every((c) => typeof c === 'string' && CODES.has(c))) {
    throw new DomainError('VALIDATION_ERROR', length === 1 ? 'Toca tu imagen secreta.' : 'Toca tus dos imágenes secretas, en orden.', {
      field: 'images',
      expectedLength: length,
    });
  }
  return images;
}

/** HMAC del alumno + sus imágenes en orden. Atado al alumno: la misma imagen da hashes distintos. */
export function hashSecret(studentId, images, key) {
  return createHmac('sha256', String(key)).update(`axi-secret:v1:${studentId}:${images.join('>')}`).digest('hex');
}

/** Comparación en tiempo constante. */
export function secretMatches(storedHash, studentId, images, key) {
  if (typeof storedHash !== 'string' || storedHash.length !== 64) return false;
  const a = Buffer.from(storedHash, 'hex');
  const b = Buffer.from(hashSecret(studentId, images, key), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cuerpo de `POST /groups/:groupId/secret-setup`: `{ minutes? }` dentro de los límites. */
export function parseSetupMinutes(body) {
  const raw = body?.minutes;
  if (raw === undefined || raw === null) return SECRET_SETUP_MINUTES.default;
  if (!Number.isInteger(raw) || raw < SECRET_SETUP_MINUTES.min || raw > SECRET_SETUP_MINUTES.max) {
    throw new DomainError('VALIDATION_ERROR', `La ventana debe durar entre ${SECRET_SETUP_MINUTES.min} y ${SECRET_SETUP_MINUTES.max} minutos.`, {
      field: 'minutes',
    });
  }
  return raw;
}
