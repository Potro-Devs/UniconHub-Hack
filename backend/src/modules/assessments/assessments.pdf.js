/**
 * Renderizador de cuestionarios en PDF tamaño Carta, blanco y negro, alto contraste.
 * Nunca incluye las respuestas correctas ni pistas reveladoras: está listo para fotocopiar.
 */
import PDFDocument from 'pdfkit';

const PAGE_MARGIN = 36;
const CONTENT_WIDTH = 612 - PAGE_MARGIN * 2; // 540 pt en Carta (612x792)
const FOOTER_LINE_Y = 734;
const FOOTER_TEXT_Y = 740;
const BOTTOM_Y = 722;

function measureQuestionHeight(doc, question, boxWidth) {
  const innerWidth = boxWidth - 20;
  doc.font('Helvetica-Bold').fontSize(10);
  const promptHeight = doc.heightOfString(`${question.position}. ${question.prompt}`, { width: innerWidth });

  let answerHeight = 24;
  if (question.questionType === 'multiple_choice') {
    doc.font('Helvetica').fontSize(9.5);
    const optHeights = question.options.map(
      (opt) => doc.heightOfString(`${opt.label}) ${opt.text}`, { width: innerWidth - 24 }) + 4,
    );
    answerHeight = optHeights.reduce((sum, h) => sum + Math.max(17, h), 2);
  } else if (question.questionType === 'true_false') {
    answerHeight = 22;
  } else {
    answerHeight = 24;
  }

  return 9 + promptHeight + 6 + answerHeight + 9;
}

function drawHeader(doc, quiz, groupLabel, supportField = false) {
  const startY = PAGE_MARGIN;
  doc.font('Helvetica-Bold').fontSize(15).fillColor('black').text('Axi · Hoja de evaluación', PAGE_MARGIN, startY, {
    width: CONTENT_WIDTH - 130,
  });
  doc.font('Helvetica').fontSize(10).text(
    `${quiz.title}`,
    PAGE_MARGIN,
    doc.y + 2,
    { width: CONTENT_WIDTH - 130 },
  );
  doc.font('Helvetica').fontSize(9).text(
    `${quiz.skill.name} · ${quiz.grade}.º grado${groupLabel ? ` · ${groupLabel}` : ''}`,
    PAGE_MARGIN,
    doc.y + 2,
    { width: CONTENT_WIDTH - 130 },
  );
  const leftBottom = doc.y;

  doc.font('Helvetica').fontSize(9).text(
    'Folio ____________\n(lo llena el docente)',
    PAGE_MARGIN + CONTENT_WIDTH - 125,
    startY + 2,
    { width: 125, align: 'right' },
  );
  const folioBottom = doc.y;

  const lineY = Math.max(leftBottom, folioBottom, startY + 46) + 6;
  doc.lineWidth(1.5).strokeColor('black').moveTo(PAGE_MARGIN, lineY).lineTo(PAGE_MARGIN + CONTENT_WIDTH, lineY).stroke();

  const metaY = lineY + 8;
  doc.font('Helvetica').fontSize(9.5).text('Nombre: ____________________________________________', PAGE_MARGIN, metaY);
  doc.text('Fecha: ________________', PAGE_MARGIN + 370, metaY);

  let instrY = metaY + 18;
  if (supportField) {
    // Casilla general de apoyo (Modo Papel). La marca el docente; tono neutro, sin castigo.
    const rowY = metaY + 17;
    doc.font('Helvetica-Bold').fontSize(9).text('Apoyo durante la prueba', PAGE_MARGIN, rowY, { lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).text('(lo marca el docente):', PAGE_MARGIN + 112, rowY + 0.5, { lineBreak: false });
    const choices = [{ x: PAGE_MARGIN + 215, label: 'Sin tarjetas de pistas' }, { x: PAGE_MARGIN + 345, label: 'Usó tarjetas de pistas' }];
    for (const { x, label } of choices) {
      doc.lineWidth(1).strokeColor('black').circle(x, rowY + 4.5, 5).stroke();
      doc.font('Helvetica').fontSize(9).text(label, x + 9, rowY, { lineBreak: false });
    }
    instrY = rowY + 18;
  }
  const instrText =
    'Lee con calma cada pregunta y responde sin prisa. No hay tiempo límite. En opción múltiple o verdadero/falso rellena un solo círculo.';
  doc.font('Helvetica').fontSize(8.5);
  const instrHeight = doc.heightOfString(instrText, { width: CONTENT_WIDTH - 18 }) + 12;
  doc
    .lineWidth(1)
    .dash(4, { space: 3 })
    .roundedRect(PAGE_MARGIN, instrY, CONTENT_WIDTH, instrHeight, 6)
    .stroke()
    .undash();
  doc.fillColor('black').text(instrText, PAGE_MARGIN + 9, instrY + 6, { width: CONTENT_WIDTH - 18 });

  doc.y = instrY + instrHeight + 10;
}

function drawQuestionCard(doc, question) {
  const x = PAGE_MARGIN;
  const y = doc.y;
  const innerWidth = CONTENT_WIDTH - 20;
  const cardHeight = measureQuestionHeight(doc, question, CONTENT_WIDTH);

  doc.lineWidth(1).strokeColor('black').roundedRect(x, y, CONTENT_WIDTH, cardHeight, 6).stroke();

  let cursorY = y + 9;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(
    `${question.position}. ${question.prompt}`,
    x + 10,
    cursorY,
    { width: innerWidth },
  );
  cursorY = doc.y + 6;

  if (question.questionType === 'multiple_choice') {
    doc.font('Helvetica').fontSize(9.5);
    for (const opt of question.options) {
      const circleCenterX = x + 19;
      const circleCenterY = cursorY + 5.5;
      doc.lineWidth(1).strokeColor('black').circle(circleCenterX, circleCenterY, 6.5).stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).text(opt.label, circleCenterX - 2.7, circleCenterY - 3.6, { lineBreak: false });
      doc.font('Helvetica').fontSize(9.5).text(opt.text, x + 32, cursorY, { width: innerWidth - 24 });
      cursorY = Math.max(cursorY + 17, doc.y + 3.5);
    }
  } else if (question.questionType === 'true_false') {
    const items = [
      { key: 'V', label: 'Verdadero', offset: 0 },
      { key: 'F', label: 'Falso', offset: 140 },
    ];
    for (const item of items) {
      const cx = x + 19 + item.offset;
      const cy = cursorY + 6;
      doc.lineWidth(1).strokeColor('black').circle(cx, cy, 7).stroke();
      doc.font('Helvetica-Bold').fontSize(8).text(item.key, cx - 2.8, cy - 3.8, { lineBreak: false });
      doc.font('Helvetica').fontSize(9.5).text(item.label, cx + 13, cursorY + 0.5, { lineBreak: false });
    }
    cursorY += 22;
  } else {
    doc.font('Helvetica').fontSize(9.5).text(
      'Respuesta: ____________________________________________________________',
      x + 10,
      cursorY + 3,
      { width: innerWidth },
    );
    cursorY += 24;
  }

  doc.y = y + cardHeight + 7;
  doc.x = PAGE_MARGIN;
}

/**
 * Genera el buffer PDF Carta blanco y negro de un cuestionario (sin respuestas).
 *
 * @param {object} quiz DTO de detalle del cuestionario.
 * @param {{ groupLabel?: string | null, supportField?: boolean }} [options] `supportField` agrega la casilla general de apoyo (Modo Papel).
 * @returns {Promise<Buffer>}
 */
export function renderQuizPdf(quiz, { groupLabel = null, supportField = false } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: PAGE_MARGIN,
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
      drawHeader(doc, quiz, groupLabel, supportField);

      for (const question of quiz.questions) {
        const needed = measureQuestionHeight(doc, question, CONTENT_WIDTH);
        if (doc.y + needed > BOTTOM_Y) {
          doc.addPage();
          doc.font('Helvetica-Bold').fontSize(10.5).fillColor('black').text(
            `${quiz.title} (continuación)`,
            PAGE_MARGIN,
            PAGE_MARGIN,
            { width: CONTENT_WIDTH },
          );
          doc.lineWidth(1).moveTo(PAGE_MARGIN, doc.y + 4).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y + 4).stroke();
          doc.y += 12;
        }
        drawQuestionCard(doc, question);
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        const savedBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc.lineWidth(0.75).strokeColor('black').moveTo(PAGE_MARGIN, FOOTER_LINE_Y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, FOOTER_LINE_Y).stroke();
        doc.font('Helvetica').fontSize(8.5).fillColor('black').text(
          `Axi · ${quiz.skill.name} · ${quiz.grade}.º grado · Hoja imprimible sin respuestas`,
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
