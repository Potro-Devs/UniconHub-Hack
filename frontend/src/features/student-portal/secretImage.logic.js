/**
 * Lógica pura del paso "imagen secreta" del acceso del alumno (sin React ni red).
 * El servidor decide el paso y valida; aquí solo se arma lo que el alumno va tocando.
 */

/** Cómo se dibuja cada imagen del catálogo del servidor (`code` → emoji). */
export const SECRET_IMAGE_EMOJI = Object.freeze({
  turtle: '🐢',
  cat: '🐱',
  dog: '🐶',
  fish: '🐟',
  butterfly: '🦋',
  sun: '☀️',
  star: '⭐',
  flower: '🌻',
  tree: '🌳',
});

export const emojiFor = (code) => SECRET_IMAGE_EMOJI[code] ?? '❓';

/** Agrega una imagen tocada sin pasarse de `count`. */
export function addPick(picks, code, count) {
  return picks.length >= count ? picks : [...picks, code];
}

export const removeLastPick = (picks) => picks.slice(0, -1);
export const isComplete = (picks, count) => picks.length === count;
export const samePicks = (a, b) => a.length === b.length && a.every((code, i) => code === b[i]);

/** Instrucción según el paso, la fase y cuántas imágenes lleva. */
export function instructionFor({ step, phase, count, picks }) {
  const nth = count === 1 ? '' : ` (${Math.min(picks.length + 1, count)} de ${count})`;
  if (step === 'setup' && phase === 'confirm') return `Tócala otra vez para confirmar${nth}.`;
  if (step === 'setup') return count === 1 ? 'Elige tu imagen secreta. Recuérdala: la usarás cada vez que entres.' : `Elige tus ${count} imágenes secretas, en orden${nth}. Recuérdalas: las usarás cada vez que entres.`;
  return count === 1 ? 'Toca tu imagen secreta.' : `Toca tus ${count} imágenes secretas, en orden${nth}.`;
}

export const SECRET_ALREADY_SAVED_MESSAGE = 'Tu imagen secreta ya se guardó. Tócala para entrar.';

/**
 * Qué hacer cuando el servidor rechaza la imagen por un cambio de estado. Devuelve el paso siguiente
 * y, si aplica, un mensaje propio:
 * - Configurando, `SECRET_ALREADY_SET` o `SECRET_MISMATCH`: la imagen ya se guardó en otro dispositivo
 *   (el servidor responde "no coincide" si ya hay una guardada) → ahora hay que tocarla (`verify`).
 * - `SECRET_SETUP_CLOSED`: la docente cerró la ventana → pedir ayuda (`ask_teacher`).
 * Cualquier otro error deja el paso como está (p. ej. sin conexión: se puede volver a confirmar).
 */
export function afterSecretError(code, step) {
  if (step === 'setup' && (code === 'SECRET_ALREADY_SET' || code === 'SECRET_MISMATCH')) {
    return { step: 'verify', message: SECRET_ALREADY_SAVED_MESSAGE };
  }
  if (code === 'SECRET_SETUP_CLOSED') return { step: 'ask_teacher', message: null };
  return { step, message: null };
}

/** Después de cuántos intentos fallidos se sugiere pedir ayuda (sin bloquear: AGENTS.md §1.5). */
export const HELP_AFTER_FAILED_ATTEMPTS = 3;
