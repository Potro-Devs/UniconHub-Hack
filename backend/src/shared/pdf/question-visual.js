/**
 * Dibujo del gráfico de un reactivo en PDF (Carta, blanco y negro). Mismo dato que en pantalla
 * (`questions.visual`), para que papel y pantalla midan lo mismo.
 * Las partes pintadas van con rayado diagonal: se distinguen bien al fotocopiar y gastan menos tóner.
 */
import { parseQuestionVisual } from '../../modules/assessments/question-visual.domain.js';

export const FRACTION_BAR_HEIGHT = 30;
const MAX_WIDTH = 300;

/** Alto que ocupa el gráfico (0 si no hay). */
export function questionVisualHeight(visual) {
  return parseQuestionVisual(visual) ? FRACTION_BAR_HEIGHT : 0;
}

/**
 * Dibuja el gráfico en (x, y). Devuelve el alto usado (0 si no hay gráfico válido).
 * @param {PDFKit.PDFDocument} doc
 */
export function drawQuestionVisual(doc, visual, x, y, width) {
  const v = parseQuestionVisual(visual);
  if (!v) return 0;
  if (v.type === 'fraction_bar') {
    const w = Math.min(width, MAX_WIDTH);
    const cell = w / v.parts;
    const h = FRACTION_BAR_HEIGHT;
    doc.save();
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
    doc.restore();
    return h;
  }
  return 0;
}
