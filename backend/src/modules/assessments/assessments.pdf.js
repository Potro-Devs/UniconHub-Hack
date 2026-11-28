/**
 * Renderizador de cuestionarios en PDF tamaño Carta, blanco y negro, alto contraste.
 * Plantilla "Aventura con Axi" (shared/pdf/axi-sheet.js).
 * Nunca incluye las respuestas correctas ni pistas reveladoras: está listo para fotocopiar.
 */
import PDFDocument from 'pdfkit';
import {
  CARD_RADIUS,
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
import { drawOmrAnswerSheetPage } from '../paper-mode/paper-mode.omr.pdf.js';

const CARD_TOP = 12; // espacio para la insignia "Pregunta N" sobre la tarjeta
const CARD_GAP = 8;
const PROMPT_WIDTH = CW - 52;
const OPTION_WIDTH = CW - 76;
const INSTRUCTION =
  'Lee con calma cada pregunta y responde sin prisa. No hay tiempo límite. En opción múltiple o verdadero/falso rellena un solo círculo.';

function promptHeight(doc, question) {
  doc.font('Helvetica-Bold').fontSize(10);
  return doc.heightOfString(question.prompt, { width: PROMPT_WIDTH });
}

function optionRows(doc, question) {
  doc.font('Helvetica').fontSize(9.5);
  return question.options.map((opt) => Math.max(15, doc.heightOfString(opt.text, { width: OPTION_WIDTH }) + 3));
}

function cardHeight(doc, question) {
  let answer = 26;
  if (question.questionType === 'multiple_choice') answer = optionRows(doc, question).reduce((sum, h) => sum + h, 0);
  else if (question.questionType === 'true_false') answer = 22;
  return 10 + promptHeight(doc, question) + 8 + answer + 4;
}

/** Folio, nombre, fecha, casilla de apoyo opcional e instrucciones. Devuelve la Y donde empiezan las preguntas. */
function drawHeader(doc, quiz, groupLabel, supportField) {
  const detail = `${quiz.skill.name} · ${quiz.grade}.º grado${groupLabel ? ` · ${groupLabel}` : ''}`;
  drawTicketHeader(doc, { heading: 'Axi · Hoja de evaluación', title: quiz.title, detail, mood: 'celebra' });

  const y = M + 96;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text('Nombre:', M, y, { lineBreak: false });
  doc.lineWidth(0.8).moveTo(M + 48, y + 11).lineTo(M + 244, y + 11).stroke(INK);
  doc.font('Helvetica-Bold').fontSize(9.5).text('Fecha:', M + 256, y, { lineBreak: false });
  doc.lineWidth(0.8).moveTo(M + 294, y + 11).lineTo(M + 374, y + 11).stroke(INK);
  doc.font('Helvetica-Bold').fontSize(9.5).text('Folio:', M + 384, y, { lineBreak: false });
  doc.lineWidth(0.8).moveTo(M + 416, y + 11).lineTo(M + CW, y + 11).stroke(INK);
  doc.font('Helvetica').fontSize(7).text('(lo llena el docente)', M + 416, y + 13, {
    width: CW - 416,
    align: 'right',
    lineBreak: false,
  });

  let top = y + 22;
  if (supportField) {
    // Casilla general de apoyo (Modo Papel). La marca el docente; tono neutro, sin castigo.
    doc.font('Helvetica-Bold').fontSize(9).text('Apoyo durante la prueba', M, top, { lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).text('(lo marca el docente):', M + 122, top + 0.5, { lineBreak: false });
    for (const [x, label] of [[M + 238, 'Sin tarjetas de pistas'], [M + 370, 'Usó tarjetas de pistas']]) {
      doc.lineWidth(1).circle(x, top + 4.5, 5).stroke(INK);
      doc.font('Helvetica').fontSize(9).text(label, x + 9, top, { lineBreak: false });
    }
    top += 20;
  }
  return drawNoteBox(doc, INSTRUCTION, top) + 10;
}

function drawQuestionCard(doc, question, y, h) {
  doc.lineWidth(1.5).roundedRect(M, y, CW, h, CARD_RADIUS).stroke(INK);
  drawBadge(doc, `Pregunta ${question.position}`, y);

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(question.prompt, M + 40, y + 10, { width: PROMPT_WIDTH });
  const top = y + 10 + promptHeight(doc, question) + 8;

  if (question.questionType === 'multiple_choice') {
    const rows = optionRows(doc, question);
    let oy = top;
    question.options.forEach((opt, i) => {
      doc.lineWidth(1).circle(M + 50, oy + 5.5, 6).stroke(INK);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(7.5).text(opt.label, M + 44, oy + 2.4, {
        width: 12,
        align: 'center',
        lineBreak: false,
      });
      doc.font('Helvetica').fontSize(9.5).text(opt.text, M + 64, oy + 1.5, { width: OPTION_WIDTH });
      oy += rows[i];
    });
  } else if (question.questionType === 'true_false') {
    for (const [cx, key, label] of [[M + 50, 'V', 'Verdadero'], [M + 190, 'F', 'Falso']]) {
      doc.lineWidth(1).circle(cx, top + 6, 7).stroke(INK);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(8).text(key, cx - 2.8, top + 2.2, { lineBreak: false });
      doc.font('Helvetica').fontSize(9.5).text(label, cx + 13, top + 0.5, { lineBreak: false });
    }
  } else {
    doc.fillColor(INK).font('Helvetica').fontSize(9.5).text('Respuesta:', M + 40, top + 4, { lineBreak: false });
    doc.lineWidth(0.8).moveTo(M + 100, top + 15).lineTo(M + CW - 14, top + 15).stroke(INK);
  }
}

/**
 * Genera el buffer PDF Carta blanco y negro de un cuestionario (sin respuestas).
 *
 * @param {object} quiz DTO de detalle del cuestionario.
 * @param {{ groupLabel?: string | null, supportField?: boolean, omrLayout?: object | null }} [options]
 *   `supportField` agrega la casilla general de apoyo (Modo Papel); `omrLayout` agrega una página final escaneable.
 * @returns {Promise<Buffer>}
 */
export function renderQuizPdf(quiz, { groupLabel = null, supportField = false, omrLayout = null } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: M,
      bufferPages: true,
      info: {
        Title: `${quiz.title} — Axi`,
        Author: 'Axi Diagnóstico Educativo',
        Subject: `${quiz.skill.name} · ${quiz.grade}.º grado`,
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      let y = drawHeader(doc, quiz, groupLabel, supportField);
      for (const question of quiz.questions) {
        const h = cardHeight(doc, question);
        if (y + CARD_TOP + h > CONTENT_BOTTOM) {
          doc.addPage();
          y = drawContinuation(doc, quiz.title);
        }
        drawQuestionCard(doc, question, y + CARD_TOP, h);
        y += CARD_TOP + h + CARD_GAP;
      }

      // El marco punteado se dibuja solo en las hojas de preguntas para no invadir las marcas de esquina OMR.
      drawPageChrome(doc, `Axi · ${quiz.skill.name} · ${quiz.grade}.º grado · Hoja imprimible sin respuestas`);
      if (omrLayout) {
        doc.addPage();
        drawOmrAnswerSheetPage(doc, omrLayout);
      }
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
