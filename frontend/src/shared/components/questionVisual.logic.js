/**
 * Lógica pura del gráfico de un reactivo (`question.visual` que manda el servidor).
 * El servidor ya lo valida; aquí solo se protege la vista ante datos inesperados.
 * Mismos tipos y temas que `question-visual.domain.js` del backend.
 */

const THEMES = { fraction_bar: ['plain', 'chocolate'], fraction_circle: ['pizza', 'pastel'] };

/** Gráfico válido y normalizado ({ type, theme, parts, shaded }) o null. */
export function toVisual(visual) {
  if (!visual || !THEMES[visual.type]) return null;
  const { parts, shaded } = visual;
  if (!Number.isInteger(parts) || parts < 2 || parts > 12) return null;
  if (!Number.isInteger(shaded) || shaded < 0 || shaded > parts) return null;
  const theme = visual.theme ?? (visual.type === 'fraction_bar' ? 'plain' : undefined);
  if (!THEMES[visual.type].includes(theme)) return null;
  return { type: visual.type, theme, parts, shaded };
}

const verb = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Misma descripción que el servidor: para lectores de pantalla y para la bocina. */
export function describeVisual(visual) {
  const v = toVisual(visual);
  if (!v) return null;
  if (v.theme === 'pizza') return `Dibujo: una pizza partida en ${v.parts} rebanadas iguales; ${verb(v.shaded, 'tiene', 'tienen')} champiñones.`;
  if (v.theme === 'pastel') return `Dibujo: un pastel partido en ${v.parts} rebanadas iguales; ${verb(v.shaded, 'tiene', 'tienen')} fresas.`;
  if (v.theme === 'chocolate') return `Dibujo: una barra de chocolate de ${v.parts} cuadritos iguales; ${v.shaded === 1 ? 'se comió 1' : `se comieron ${v.shaded}`}.`;
  return `Dibujo: un entero dividido en ${v.parts} partes iguales, con ${verb(v.shaded, 'parte pintada', 'partes pintadas')}.`;
}

/** Columnas y filas de la barra de chocolate (8 cuadritos → 4 × 2), igual que en papel. */
export function chocolateGrid(parts) {
  const rows = parts > 6 ? 2 : 1;
  return { columns: Math.ceil(parts / rows), rows };
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * Rebanadas de un círculo de radio `r` con centro en (c, c): para cada una, el trazo SVG de la
 * rebanada y el punto donde va su ingrediente. Empiezan arriba y van en el sentido del reloj.
 */
export function circleSlices(parts, r = 90, c = 100) {
  const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / parts;
  return Array.from({ length: parts }, (_, i) => {
    const a0 = angle(i);
    const a1 = angle(i + 1);
    const mid = (a0 + a1) / 2;
    const p0 = [round(c + r * Math.cos(a0)), round(c + r * Math.sin(a0))];
    const p1 = [round(c + r * Math.cos(a1)), round(c + r * Math.sin(a1))];
    return {
      edge: p0,
      path: `M ${c} ${c} L ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 1 ${p1[0]} ${p1[1]} Z`,
      topping: [round(c + r * 0.58 * Math.cos(mid)), round(c + r * 0.58 * Math.sin(mid))],
    };
  });
}
