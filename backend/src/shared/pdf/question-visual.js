/**
 * Dibujo del gráfico de un reactivo en PDF (Carta, blanco y negro). Mismo dato que en pantalla
 * (`questions.visual`), para que papel y pantalla midan lo mismo.
 *
 * Estilo libro para colorear: solo contornos negros, sin rellenos (gasta poco tóner, se fotocopia bien
 * y el alumno puede colorearlo). Lo "marcado" se distingue por su dibujo, no por el color:
 * - tira `plain`: rayado diagonal en las partes pintadas;
 * - pizza / pastel: champiñones o fresas dibujados en las rebanadas marcadas;
 * - chocolate: los cuadritos comidos quedan en línea punteada.
 */
import { parseQuestionVisual } from '../../modules/assessments/question-visual.domain.js';

export const FRACTION_BAR_HEIGHT = 30;
export const FRACTION_CIRCLE_SIZE = 96;
export const CHOCOLATE_CELL = 30;
const MAX_WIDTH = 300;
const CHOCOLATE_MAX_COLUMNS = 6;

/** Columnas y filas de la barra de chocolate (8 cuadritos → 4 × 2). Igual que en pantalla. */
export function chocolateGrid(parts) {
  const rows = parts > CHOCOLATE_MAX_COLUMNS ? 2 : 1;
  return { columns: Math.ceil(parts / rows), rows };
}

/** Alto que ocupa el gráfico (0 si no hay). */
export function questionVisualHeight(visual) {
  const v = parseQuestionVisual(visual);
  if (!v) return 0;
  if (v.type === 'fraction_circle') return FRACTION_CIRCLE_SIZE;
  if (v.theme === 'chocolate') return chocolateGrid(v.parts).rows * CHOCOLATE_CELL;
  return FRACTION_BAR_HEIGHT;
}

function drawPlainBar(doc, v, x, y, width) {
  const w = Math.min(width, MAX_WIDTH);
  const cell = w / v.parts;
  const h = FRACTION_BAR_HEIGHT;
  for (let i = 0; i < v.parts; i += 1) {
    const cx = x + i * cell;
    if (i < v.shaded) {
      // Rayado diagonal dentro de la parte pintada.
      doc.save().rect(cx, y, cell, h).clip().lineWidth(0.9);
      for (let t = -h; t < cell; t += 4) doc.moveTo(cx + t, y + h).lineTo(cx + t + h, y).stroke('black');
      doc.restore();
    }
    doc.lineWidth(1).rect(cx, y, cell, h).stroke('black');
  }
  doc.lineWidth(2).rect(x, y, cell * v.parts, h).stroke('black');
  return h;
}

function drawChocolate(doc, v, x, y) {
  const { columns, rows } = chocolateGrid(v.parts);
  const c = CHOCOLATE_CELL;
  const gap = 3;
  for (let i = 0; i < v.parts; i += 1) {
    const cx = x + (i % columns) * c;
    const cy = y + Math.floor(i / columns) * c;
    if (i < v.shaded) {
      // Cuadrito comido: solo su lugar, punteado.
      doc.save().lineWidth(1).dash(3, { space: 2.5 });
      doc.roundedRect(cx + gap, cy + gap, c - 2 * gap, c - 2 * gap, 3).stroke('black');
      doc.undash().restore();
    } else {
      doc.lineWidth(1.4).roundedRect(cx + gap, cy + gap, c - 2 * gap, c - 2 * gap, 3).stroke('black');
      doc.lineWidth(0.7).roundedRect(cx + gap + 5, cy + gap + 5, c - 2 * gap - 10, c - 2 * gap - 10, 2).stroke('black');
    }
  }
  return rows * c;
}

/** Ángulo (radianes) del borde i de la rebanada, empezando arriba y en el sentido del reloj. */
const sliceAngle = (i, parts) => -Math.PI / 2 + (2 * Math.PI * i) / parts;

function drawMushroom(doc, cx, cy, s) {
  doc.lineWidth(0.9);
  doc.path(`M ${cx - s} ${cy} A ${s} ${s} 0 0 1 ${cx + s} ${cy} Z`).stroke('black');
  doc.rect(cx - s * 0.35, cy, s * 0.7, s * 0.8).stroke('black');
}

function drawStrawberry(doc, cx, cy, s) {
  doc.lineWidth(0.9);
  // Gota invertida: arriba ancha, abajo en punta.
  doc.path(`M ${cx - s} ${cy - s * 0.3} Q ${cx - s} ${cy + s * 0.6} ${cx} ${cy + s * 1.1} Q ${cx + s} ${cy + s * 0.6} ${cx + s} ${cy - s * 0.3} Q ${cx} ${cy - s * 0.9} ${cx - s} ${cy - s * 0.3} Z`).stroke('black');
  // Hojitas.
  doc.moveTo(cx - s * 0.5, cy - s * 0.75).lineTo(cx, cy - s * 0.45).lineTo(cx + s * 0.5, cy - s * 0.75).stroke('black');
  // Semillas.
  for (const [dx, dy] of [[-0.4, 0.1], [0.4, 0.1], [0, 0.5]]) doc.circle(cx + dx * s, cy + dy * s, 0.6).fill('black');
}

function drawCircle(doc, v, x, y) {
  const r = FRACTION_CIRCLE_SIZE / 2;
  const cx = x + r;
  const cy = y + r;
  doc.lineWidth(2).circle(cx, cy, r).stroke('black');
  // Orilla de la pizza (línea continua) o betún del pastel (punteado).
  doc.save().lineWidth(0.8);
  if (v.theme === 'pastel') doc.dash(2, { space: 2 });
  doc.circle(cx, cy, r * 0.86).stroke('black');
  doc.undash().restore();
  doc.lineWidth(1.2);
  for (let i = 0; i < v.parts; i += 1) {
    const a = sliceAngle(i, v.parts);
    doc.moveTo(cx, cy).lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)).stroke('black');
  }
  const s = v.parts > 4 ? 7 : 10;
  for (let i = 0; i < v.shaded; i += 1) {
    const mid = (sliceAngle(i, v.parts) + sliceAngle(i + 1, v.parts)) / 2;
    const tx = cx + r * 0.55 * Math.cos(mid);
    const ty = cy + r * 0.55 * Math.sin(mid);
    if (v.theme === 'pastel') drawStrawberry(doc, tx, ty, s);
    else drawMushroom(doc, tx, ty, s);
  }
  return FRACTION_CIRCLE_SIZE;
}

/**
 * Dibuja el gráfico en (x, y). Devuelve el alto usado (0 si no hay gráfico válido).
 * @param {PDFKit.PDFDocument} doc
 */
export function drawQuestionVisual(doc, visual, x, y, width) {
  const v = parseQuestionVisual(visual);
  if (!v) return 0;
  doc.save();
  let h;
  if (v.type === 'fraction_circle') h = drawCircle(doc, v, x, y);
  else if (v.theme === 'chocolate') h = drawChocolate(doc, v, x, y);
  else h = drawPlainBar(doc, v, x, y, width);
  doc.restore();
  return h;
}
