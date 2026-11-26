/**
 * Módulo paper-mode — Capa 1 (Presentación): tarjetas de pistas en PDF tamaño Carta, blanco y negro.
 * Una fila por reactivo con 3 tarjetas recortables (una por nivel) para entregar una pista a la vez.
 * Nunca incluye la respuesta correcta ni datos de alumnos.
 */
import PDFDocument from 'pdfkit';

const PAGE_MARGIN = 36;
const CONTENT_WIDTH = 612 - PAGE_MARGIN * 2; // 540 pt en Carta (612x792)
const BOTTOM_Y = 722;
const FOOTER_LINE_Y = 734;
const FOOTER_TEXT_Y = 740;
const CARD_GAP = 8;
const CARD_WIDTH = (CONTENT_WIDTH - CARD_GAP * 2) / 3;
const CARD_PADDING = 8;

/** Qué hace cada nivel (AGENTS.md §4.6). */
const HINT_LEVEL_LABELS = Object.freeze(['Pista 1 · Qué observar', 'Pista 2 · Un paso', 'Pista 3 · Un ejemplo parecido']);

const INSTRUCTIONS =
  'Recorta por la línea punteada. Entrega una pista a la vez, empezando por la 1, solo si el alumno la pide. '
  + 'Ninguna pista dice la respuesta.';

function measureRow(doc, question) {
  doc.font('Helvetica').fontSize(9);
  const textHeights = question.hints.map((hint) => doc.heightOfString(hint, { width: CARD_WIDTH - CARD_PADDING * 2 }));
  const cardHeight = CARD_PADDING + 12 + Math.max(...textHeights, 12) + CARD_PADDING;
  return { cardHeight, rowHeight: 16 + cardHeight + 12 };
}

function drawHeader(doc, { title, groupLabel }) {
  doc.font('Helvetica-Bold').fontSize(15).fillColor('black').text('Axi · Tarjetas de pistas', PAGE_MARGIN, PAGE_MARGIN, {
    width: CONTENT_WIDTH,
  });
  doc.font('Helvetica').fontSize(10).text(`${title}${groupLabel ? ` · ${groupLabel}` : ''}`, PAGE_MARGIN, doc.y + 2, {
    width: CONTENT_WIDTH,
  });
  const lineY = doc.y + 6;
  doc.lineWidth(1.5).strokeColor('black').moveTo(PAGE_MARGIN, lineY).lineTo(PAGE_MARGIN + CONTENT_WIDTH, lineY).stroke();

  doc.font('Helvetica').fontSize(8.5);
  const boxY = lineY + 8;
  const boxHeight = doc.heightOfString(INSTRUCTIONS, { width: CONTENT_WIDTH - 18 }) + 12;
  doc.lineWidth(1).roundedRect(PAGE_MARGIN, boxY, CONTENT_WIDTH, boxHeight, 6).stroke();
  doc.text(INSTRUCTIONS, PAGE_MARGIN + 9, boxY + 6, { width: CONTENT_WIDTH - 18 });
  doc.y = boxY + boxHeight + 12;
}

function drawRow(doc, question, { cardHeight, rowHeight }) {
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(
    `Reactivo ${question.position} · ${question.skillName}`,
    PAGE_MARGIN,
    y,
    { width: CONTENT_WIDTH, lineBreak: false },
  );

  const cardY = y + 16;
  question.hints.forEach((hint, level) => {
    const x = PAGE_MARGIN + level * (CARD_WIDTH + CARD_GAP);
    // Borde punteado = línea de corte.
    doc.lineWidth(1).strokeColor('black').dash(4, { space: 3 }).rect(x, cardY, CARD_WIDTH, cardHeight).stroke().undash();
    doc.font('Helvetica-Bold').fontSize(8).text(
      `${question.position} · ${HINT_LEVEL_LABELS[level]}`,
      x + CARD_PADDING,
      cardY + CARD_PADDING,
      { width: CARD_WIDTH - CARD_PADDING * 2, lineBreak: false, ellipsis: true },
    );
    doc.font('Helvetica').fontSize(9).text(hint, x + CARD_PADDING, cardY + CARD_PADDING + 12, {
      width: CARD_WIDTH - CARD_PADDING * 2,
    });
  });

  doc.y = y + rowHeight;
  doc.x = PAGE_MARGIN;
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
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: { Title: `${title} — Tarjetas de pistas — Axi`, Author: 'Axi Diagnóstico Educativo' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawHeader(doc, { title, groupLabel });
      for (const question of questions) {
        const size = measureRow(doc, question);
        if (doc.y + size.rowHeight > BOTTOM_Y) {
          doc.addPage();
          doc.y = PAGE_MARGIN;
        }
        drawRow(doc, question, size);
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        const savedBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.lineWidth(0.75).strokeColor('black').moveTo(PAGE_MARGIN, FOOTER_LINE_Y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, FOOTER_LINE_Y).stroke();
        doc.font('Helvetica').fontSize(8.5).fillColor('black').text(
          `Axi · ${title} · Tarjetas de pistas`,
          PAGE_MARGIN,
          FOOTER_TEXT_Y,
          { width: CONTENT_WIDTH - 95, height: 12, ellipsis: true, lineBreak: false },
        );
        doc.text(`Hoja ${i + 1} de ${range.count}`, PAGE_MARGIN + CONTENT_WIDTH - 90, FOOTER_TEXT_Y, {
          width: 90,
          align: 'right',
          lineBreak: false,
        });
        doc.page.margins.bottom = savedBottomMargin;
      }
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
