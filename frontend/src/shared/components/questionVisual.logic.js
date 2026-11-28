/**
 * Lógica pura del gráfico de un reactivo (`question.visual` que manda el servidor).
 * El servidor ya lo valida; aquí solo se protege la vista ante datos inesperados.
 */

/** Barra válida o null. */
export function toFractionBar(visual) {
  if (!visual || visual.type !== 'fraction_bar') return null;
  const { parts, shaded } = visual;
  if (!Number.isInteger(parts) || parts < 2 || parts > 12) return null;
  if (!Number.isInteger(shaded) || shaded < 0 || shaded > parts) return null;
  return { parts, shaded };
}

/** Misma descripción que el servidor: para lectores de pantalla y para la bocina. */
export function describeVisual(visual) {
  const bar = toFractionBar(visual);
  if (!bar) return null;
  const painted = bar.shaded === 1 ? '1 parte pintada' : `${bar.shaded} partes pintadas`;
  return `Dibujo: un entero dividido en ${bar.parts} partes iguales, con ${painted}.`;
}
