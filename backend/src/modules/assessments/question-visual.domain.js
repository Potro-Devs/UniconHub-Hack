/**
 * Gráfico de un reactivo (Capa 3, dominio puro). Se guarda como JSON en `questions.visual` y se
 * dibuja igual en pantalla (a color) y en papel (solo contorno, estilo libro para colorear), para que
 * ambas modalidades sean comparables.
 *
 * Tipos soportados (siempre un entero en `parts` partes iguales con `shaded` partes marcadas):
 * - `fraction_bar`    · `theme`: `plain` (tira) o `chocolate` (cuadritos; los marcados son los que se comieron).
 * - `fraction_circle` · `theme`: `pizza` (marcadas = con champiñones) o `pastel` (marcadas = con fresas).
 *
 * Solo se usa donde el dibujo ES la pregunta (p. ej. "¿qué fracción…?"); en reactivos de
 * comparación o equivalencia un dibujo podría delatar la respuesta, por eso el generador no lo pone.
 */

export const VISUAL_THEMES = Object.freeze({
  fraction_bar: Object.freeze(['plain', 'chocolate']),
  fraction_circle: Object.freeze(['pizza', 'pastel']),
});
export const VISUAL_TYPES = Object.freeze(Object.keys(VISUAL_THEMES));
export const FRACTION_LIMITS = Object.freeze({ minParts: 2, maxParts: 12 });

/**
 * Valida y normaliza el gráfico guardado (texto JSON u objeto). Cualquier cosa inválida → null
 * (el reactivo se muestra sin dibujo en lugar de romper la prueba). Una barra sin `theme` es `plain`.
 */
export function parseQuestionVisual(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || !VISUAL_TYPES.includes(value.type)) return null;
  const { parts, shaded } = value;
  const { minParts, maxParts } = FRACTION_LIMITS;
  if (!Number.isInteger(parts) || parts < minParts || parts > maxParts) return null;
  if (!Number.isInteger(shaded) || shaded < 0 || shaded > parts) return null;
  const theme = value.theme ?? (value.type === 'fraction_bar' ? 'plain' : undefined);
  if (!VISUAL_THEMES[value.type].includes(theme)) return null;
  return { type: value.type, theme, parts, shaded };
}

/** Texto para guardar en la base (o null). */
export function serializeQuestionVisual(visual) {
  const parsed = parseQuestionVisual(visual);
  return parsed ? JSON.stringify(parsed) : null;
}

const verb = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Descripción para lectores de pantalla y para la bocina ("Escuchar"). */
export function describeQuestionVisual(visual) {
  const v = parseQuestionVisual(visual);
  if (!v) return null;
  if (v.theme === 'pizza') return `Dibujo: una pizza partida en ${v.parts} rebanadas iguales; ${verb(v.shaded, 'tiene', 'tienen')} champiñones.`;
  if (v.theme === 'pastel') return `Dibujo: un pastel partido en ${v.parts} rebanadas iguales; ${verb(v.shaded, 'tiene', 'tienen')} fresas.`;
  if (v.theme === 'chocolate') return `Dibujo: una barra de chocolate de ${v.parts} cuadritos iguales; ${v.shaded === 1 ? 'se comió 1' : `se comieron ${v.shaded}`}.`;
  return `Dibujo: un entero dividido en ${v.parts} partes iguales, con ${verb(v.shaded, 'parte pintada', 'partes pintadas')}.`;
}
