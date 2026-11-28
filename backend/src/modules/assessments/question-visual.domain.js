/**
 * Gráfico de un reactivo (Capa 3, dominio puro). Se guarda como JSON en `questions.visual` y se
 * dibuja igual en pantalla y en papel, para que ambas modalidades sean comparables.
 *
 * Tipos soportados:
 * - `fraction_bar`: un entero (tira, barra, cuerda) dividido en `parts` partes iguales, `shaded` pintadas.
 *
 * Solo se usa donde el dibujo ES la pregunta (p. ej. "¿qué fracción está pintada?"); en reactivos de
 * comparación o equivalencia un dibujo podría delatar la respuesta, por eso el generador no lo pone.
 */

export const VISUAL_TYPES = Object.freeze(['fraction_bar']);
export const FRACTION_BAR_LIMITS = Object.freeze({ minParts: 2, maxParts: 12 });

/**
 * Valida y normaliza el gráfico guardado (texto JSON u objeto). Cualquier cosa inválida → null
 * (el reactivo se muestra sin dibujo en lugar de romper la prueba).
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
  if (value.type === 'fraction_bar') {
    const { parts, shaded } = value;
    const { minParts, maxParts } = FRACTION_BAR_LIMITS;
    if (!Number.isInteger(parts) || parts < minParts || parts > maxParts) return null;
    if (!Number.isInteger(shaded) || shaded < 0 || shaded > parts) return null;
    return { type: 'fraction_bar', parts, shaded };
  }
  return null;
}

/** Texto para guardar en la base (o null). */
export function serializeQuestionVisual(visual) {
  const parsed = parseQuestionVisual(visual);
  return parsed ? JSON.stringify(parsed) : null;
}

/** Descripción para lectores de pantalla y para la bocina ("Escuchar"). */
export function describeQuestionVisual(visual) {
  const v = parseQuestionVisual(visual);
  if (!v) return null;
  if (v.type === 'fraction_bar') {
    const painted = v.shaded === 1 ? '1 parte pintada' : `${v.shaded} partes pintadas`;
    return `Dibujo: un entero dividido en ${v.parts} partes iguales, con ${painted}.`;
  }
  return null;
}
