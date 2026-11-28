/**
 * Módulo paper-mode — Capa 1 (Presentación): hoja de respuestas escaneable (OMR) en PDF Carta B/N.
 * Dibuja las marcas de esquina, tira de verificación, burbuja de apoyo y cuadrícula usando
 * exactamente las coordenadas de `buildOmrLayout` (fuente única de verdad).
 */
import PDFDocument from 'pdfkit';
import { INK, PAPER } from '../../shared/pdf/axi-sheet.js';
import { OMR_COLUMNS } from './paper-mode.omr.domain.js';

const CONTENT_LEFT = 76;
const CONTENT_RIGHT = 536;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
const LIGHT_GRAY = '#999999';
const CELL_BORDER = '#BBBBBB';
const ROW_RULE = '#DDDDDD';

function drawColumnHeaders(doc, centers, numberX, y) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5);
  doc.text('#', numberX - 10, y - 5, { width: 20, align: 'center', lineBreak: false });
  centers.forEach((cx, idx) => {
    doc.text(OMR_COLUMNS[idx], cx - 10, y - 5, { width: 20, align: 'center', lineBreak: false });
  });
}

/**
 * Dibuja una hoja de respuestas OMR completa en la página actual de `doc`.
 * Mantiene limpias las zonas de silencio alrededor de los 4 cuadros fiduciales.
 *
 * @param {import('pdfkit')} doc
 * @param {ReturnType<import('./paper-mode.omr.domain.js').buildOmrLayout>} layout
 */
export function drawOmrAnswerSheetPage(doc, layout) {
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  try {
    const halfMarker = layout.fiducials.markerSizePt / 2;
    for (const corner of Object.values(layout.fiducials.corners)) {
      doc.rect(corner.x - halfMarker, corner.y - halfMarker, layout.fiducials.markerSizePt, layout.fiducials.markerSizePt).fill(INK);
    }

    // Cabecera genérica dentro de x ∈ [76..536], y ∈ [74..148]
    const codeBoxW = 72;
    const codeBoxX = CONTENT_RIGHT - codeBoxW;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(15).text('Axi · Hoja de respuestas', CONTENT_LEFT, 74, {
      width: CONTENT_WIDTH - codeBoxW - 10,
      lineBreak: false,
      ellipsis: true,
    });
    doc.lineWidth(1.4).roundedRect(codeBoxX, 72, codeBoxW, 24, 5).stroke(INK);
    doc.font('Helvetica-Bold').fontSize(11).text(layout.code, codeBoxX, 79, {
      width: codeBoxW,
      align: 'center',
      lineBreak: false,
    });

    const subtitle = layout.groupLabel ? `${layout.title} · Grupo ${layout.groupLabel}` : layout.title;
    doc.font('Helvetica').fontSize(9).text(subtitle, CONTENT_LEFT, 96, {
      width: CONTENT_WIDTH - codeBoxW - 10,
      lineBreak: false,
      ellipsis: true,
    });

    // Líneas genéricas en blanco (nunca prellenadas)
    doc.font('Helvetica-Bold').fontSize(9).text('Nombre:', CONTENT_LEFT, 114, { lineBreak: false });
    doc.lineWidth(0.8).moveTo(CONTENT_LEFT + 44, 124).lineTo(CONTENT_LEFT + 286, 124).stroke(INK);
    doc.font('Helvetica-Bold').fontSize(9).text('Fecha:', CONTENT_LEFT + 300, 114, { lineBreak: false });
    doc.lineWidth(0.8).moveTo(CONTENT_LEFT + 334, 124).lineTo(CONTENT_RIGHT, 124).stroke(INK);

    doc.font('Helvetica').fontSize(8.2).text(
      'Rellena por completo un solo círculo por pregunta con lápiz o pluma oscura.',
      CONTENT_LEFT,
      133,
      { width: CONTENT_WIDTH, lineBreak: false, ellipsis: true },
    );

    // Tira de calibración y código binario de la prueba
    const halfCell = layout.codeStrip.cellSizePt / 2;
    const { blackRef, whiteRef, bits } = layout.codeStrip;
    doc.rect(blackRef.x - halfCell, blackRef.y - halfCell, layout.codeStrip.cellSizePt, layout.codeStrip.cellSizePt).fill(INK);
    doc
      .lineWidth(0.6)
      .rect(whiteRef.x - halfCell, whiteRef.y - halfCell, layout.codeStrip.cellSizePt, layout.codeStrip.cellSizePt)
      .stroke(CELL_BORDER);
    for (const bit of bits) {
      const bx = bit.x - halfCell;
      const by = bit.y - halfCell;
      if (bit.value === 1) {
        doc.rect(bx, by, layout.codeStrip.cellSizePt, layout.codeStrip.cellSizePt).fill(INK);
      } else {
        doc.lineWidth(0.5).rect(bx, by, layout.codeStrip.cellSizePt, layout.codeStrip.cellSizePt).stroke(CELL_BORDER);
      }
    }
    doc.fillColor(INK).font('Helvetica').fontSize(7.5).text(`Código ${layout.code}`, 376, 153, {
      width: CONTENT_RIGHT - 376,
      align: 'right',
      lineBreak: false,
    });

    // Casilla de apoyo docente (sin cruzar las burbujas)
    doc.lineWidth(1).roundedRect(CONTENT_LEFT, 174, CONTENT_WIDTH, 32, 6).stroke(INK);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text('Apoyo durante la prueba (docente):', CONTENT_LEFT + 12, 185, {
      lineBreak: false,
    });
    const sb = layout.supportBubble;
    doc.lineWidth(1.1).circle(sb.x, sb.y, sb.r).stroke(INK);
    doc.font('Helvetica').fontSize(9).text(sb.label, sb.x + sb.r + 8, 185, { lineBreak: false });

    // Encabezados de columnas y cuadrícula fija de burbujas
    if (layout.gridColumns === 1) {
      drawColumnHeaders(doc, [188, 252, 316, 380], 128, 224);
    } else {
      drawColumnHeaders(doc, [128, 168, 208, 248], 84, 224);
      drawColumnHeaders(doc, [370, 410, 450, 490], 326, 224);
    }

    layout.questions.forEach((question, idx) => {
      const firstOpt = question.options[0];
      if (!firstOpt) return;
      const cy = firstOpt.y;
      const isRight = layout.gridColumns === 2 && idx >= 20;
      const numX = layout.gridColumns === 1 ? 128 : isRight ? 326 : 84;
      const rowInCol = isRight ? idx - 20 : idx;

      if (rowInCol > 0 && rowInCol % 5 === 0) {
        const ruleLeft = layout.gridColumns === 1 ? 116 : isRight ? 314 : 78;
        const ruleRight = layout.gridColumns === 1 ? 404 : isRight ? 512 : 270;
        doc.save().lineWidth(0.4).moveTo(ruleLeft, cy - 11).lineTo(ruleRight, cy - 11).stroke(ROW_RULE).restore();
      }

      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(`${question.position}`, numX - 14, cy - 4.5, {
        width: 28,
        align: 'center',
        lineBreak: false,
      });

      for (const opt of question.options) {
        doc.lineWidth(1.1).circle(opt.x, opt.y, opt.r).fillAndStroke(PAPER, INK);
        doc.fillColor(LIGHT_GRAY).font('Helvetica-Bold').fontSize(6.5).text(opt.label, opt.x - opt.r, opt.y - 2.6, {
          width: opt.r * 2,
          align: 'center',
          lineBreak: false,
        });
      }
    });

    // Pie limpio lejos de los cuadros inferiores
    doc.fillColor(INK).font('Helvetica').fontSize(8).text(
      `Axi · Hoja de respuestas genérica (sin datos del alumno) · Código ${layout.code}`,
      82,
      718,
      { width: 448, align: 'center', lineBreak: false, ellipsis: true },
    );
  } finally {
    doc.page.margins.bottom = savedBottom;
  }
}

/**
 * Genera un PDF independiente de 1 página tamaño Carta B/N con la hoja de respuestas OMR.
 *
 * @param {ReturnType<import('./paper-mode.omr.domain.js').buildOmrLayout>} layout
 * @returns {Promise<Buffer>}
 */
export function renderOmrAnswerSheetPdf(layout) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 36,
      info: {
        Title: `${layout.title} — Hoja de respuestas (${layout.code}) — Axi`,
        Author: 'Axi Diagnóstico Educativo',
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawOmrAnswerSheetPage(doc, layout);
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
