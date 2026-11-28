/**
 * Módulo paper-mode — Capa 1 (Presentación): tarjetas de pistas en PDF tamaño Carta, blanco y negro.
 * Plantilla "Aventura con Axi" (shared/pdf/axi-sheet.js), la misma del cuestionario.
 * Una fila por reactivo con 3 tarjetas recortables (una por nivel) para entregar una pista a la vez.
 * Nunca incluye la respuesta correcta ni datos de alumnos.
 */
import PDFDocument from 'pdfkit';
import {
  CONTENT_BOTTOM,
  CW,
  INK,
  M,
  drawBadge,
  drawContinuation,
  drawNoteBox,
  drawPageChrome,
  drawTicketHeader,
} from '../../shared/pdf/axi-sheet.js';

const ROW_TOP = 22; // espacio para la insignia "Reactivo N" sobre las tarjetas sin tocar la línea de corte
const ROW_GAP = 10;
const CARD_GAP = 8;
const CARD_WIDTH = (CW - CARD_GAP * 2) / 3;
const CARD_PADDING = 8;

/** Qué hace cada nivel (AGENTS.md §4.6). */
const HINT_LEVEL_LABELS = Object.freeze(['Pista 1 · Qué observar', 'Pista 2 · Un paso', 'Pista 3 · Un ejemplo parecido']);

const INSTRUCTIONS =
  'Recorta por la línea punteada. Entrega una pista a la vez, empezando por la 1, solo si el alumno la pide. '
  + 'Ninguna pista dice la respuesta. Si el alumno usa alguna tarjeta, marca "Usó tarjetas de pistas" en el encabezado '
  + 'de su hoja: al capturar, sus aciertos cuentan como "Logrado con apoyo".';

function cardHeight(doc, question) {
  doc.font('Helvetica').fontSize(9);
  const textHeights = question.hints.map((hint) => doc.heightOfString(hint, { width: CARD_WIDTH - CARD_PADDING * 2 }));
  return CARD_PADDING + 12 + Math.max(...textHeights, 12) + CARD_PADDING;
}

function drawRow(doc, question, y, h) {
  question.hints.forEach((hint, level) => {
    const x = M + level * (CARD_WIDTH + CARD_GAP);
    // Borde punteado = línea de corte.
    doc.lineWidth(1).dash(4, { space: 3 }).rect(x, y, CARD_WIDTH, h).stroke(INK).undash();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8).text(
      `${question.position} · ${HINT_LEVEL_LABELS[level]}`,
      x + CARD_PADDING,
      y + CARD_PADDING,
      { width: CARD_WIDTH - CARD_PADDING * 2, lineBreak: false, ellipsis: true },
    );
    doc.font('Helvetica').fontSize(9).text(hint, x + CARD_PADDING, y + CARD_PADDING + 12, {
      width: CARD_WIDTH - CARD_PADDING * 2,
    });
  });
  // La insignia se dibuja completamente encima de las tarjetas para no invadir la línea de corte.
  drawBadge(doc, `Reactivo ${question.position} · ${question.skillName}`, y - 12);
}

/**
 * @param {{ title: string, groupLabel?: string | null,
 *   questions: Array<{ position: number, skillName: string, hints: [string, string, string] }> }} sheet
 * @returns {Promise<Buffer>}
 */
export function renderHintCardsPdf({ title, groupLabel = null, questions }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: M,
      bufferPages: true,
      info: { Title: `${title} — Tarjetas de pistas — Axi`, Author: 'Axi Diagnóstico Educativo' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawTicketHeader(doc, {
        heading: 'Axi · Tarjetas de pistas',
        title,
        detail: groupLabel ? `Grupo ${groupLabel}` : null,
        mood: 'pista',
      });
      let y = drawNoteBox(doc, INSTRUCTIONS, M + 96) + 10;
      for (const question of questions) {
        const h = cardHeight(doc, question);
        if (y + ROW_TOP + h > CONTENT_BOTTOM) {
          doc.addPage();
          y = drawContinuation(doc, `${title} · Tarjetas de pistas`);
        }
        drawRow(doc, question, y + ROW_TOP, h);
        y += ROW_TOP + h + ROW_GAP;
      }

      drawPageChrome(doc, `Axi · ${title} · Tarjetas de pistas`);
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
