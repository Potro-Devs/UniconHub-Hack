/** Lógica pura de los juegos (sin DOM): formato de números y cuándo se puede comprobar un reto. */

/** 0.25 → "0.25", 2.5 → "2.5", 100 → "100". */
export function formatGameNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** El botón "Comprobar mi idea" se activa cuando la respuesta está completa. */
export function isAnswerReady(code, answer) {
  if (code === 'grammar_fix') return answer?.wordIndex != null && answer?.optionIndex != null;
  if (code === 'mental_math') return Array.isArray(answer) && answer.length === 2;
  return true;
}
