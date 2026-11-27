/**
 * Plantilla compartida de hojas imprimibles (Carta, blanco y negro): diseño "Aventura con Axi".
 * Marco punteado, cabecera tipo boleto con Axi, insignias de pregunta y pie rayado.
 * La usan el cuestionario (assessments) y las tarjetas de pistas (paper-mode).
 */

export const M = 36; // margen
export const CW = 612 - M * 2; // 540 pt de ancho útil en Carta (612x792)
export const CONTENT_BOTTOM = 716;
export const INK = 'black';
export const PAPER = 'white';
export const CARD_RADIUS = 12;

/**
 * Axi en vectores blanco y negro. Geometría de frontend/src/features/mascot/Mascot.jsx (marco 200x200).
 * Moods: feliz | pista | celebra | calma.
 */
export function drawAxi(doc, cx, cy, size, mood = 'feliz') {
  const k = size / 200;
  doc.save().translate(cx - 100 * k, cy - 100 * k).scale(k);
  doc.lineWidth(4).strokeColor(INK);

  const ell = (x, y, rx, ry, deg = 0, fill = PAPER) => {
    doc.save().translate(x, y).rotate(deg).ellipse(0, 0, rx, ry);
    if (fill) doc.fillAndStroke(fill, INK);
    else doc.stroke(INK);
    doc.restore();
  };
  const dot = (x, y, r, color) => doc.circle(x, y, r).fill(color);
  const bar = (x, y, w, deg, tipLeft) => {
    const h = 18;
    doc.save().translate(x, y).rotate(deg).roundedRect(-w / 2, -h / 2, w, h, h / 2).fillAndStroke(PAPER, INK);
    doc.roundedRect(tipLeft ? -w / 2 : w / 2 - 14, -h / 2, 14, h, h / 2).fill(INK);
    doc.restore();
  };
  const hatch = (x, y, rx, ry) => {
    doc.save().ellipse(x, y, rx, ry).clip().lineWidth(0.8);
    for (let i = -rx - ry; i < rx + ry; i += 3) doc.moveTo(x + i, y - ry).lineTo(x + i + 2 * ry, y + ry).stroke(INK);
    doc.restore();
  };

  const armsUp = mood === 'celebra';

  // Cola, patas, branquias (detrás de la cabeza)
  ell(151, 162, 31, 12, -22);
  ell(78, 183, 12, 7);
  ell(122, 183, 12, 7);
  bar(32, 55, 56, 28, true);
  bar(29, 88, 58, 0, true);
  bar(32, 121, 56, -28, true);
  bar(168, 55, 56, -28, false);
  bar(171, 88, 58, 0, false);
  bar(168, 121, 56, 28, false);

  // Cuerpo, panza y brazos (bajos)
  ell(100, 157, 40, 29);
  ell(100, 162, 24, 18, 0, null);
  if (!armsUp) {
    ell(61, 154, 13, 8, 35);
    ell(139, 154, 13, 8, -35);
  }

  // Cabeza, manchas y mejillas rayadas
  ell(100, 95, 66, 55);
  for (const [x, y] of [[92.5, 53.5], [103.5, 47.5], [114.5, 54.5]]) dot(x, y, 3.5, INK);
  ell(62, 116, 12, 6.5);
  ell(138, 116, 12, 6.5);
  hatch(62, 116, 12, 6.5);
  hatch(138, 116, 12, 6.5);

  // Ojos
  const openEyes = mood === 'feliz' || mood === 'pista';
  for (const x of [80, 120]) {
    if (openEyes) {
      ell(x, 92.5, 11, 12.5, 0, INK);
      dot(x - 3, 88, 3.4, PAPER);
      dot(x + 4, 97, 1.8, PAPER);
    } else if (mood === 'celebra') {
      doc.lineWidth(4).moveTo(x - 12, 96).quadraticCurveTo(x, 80, x + 12, 96).stroke(INK);
    } else {
      doc.lineWidth(4).moveTo(x - 11, 90).quadraticCurveTo(x, 102, x + 11, 90).stroke(INK);
    }
  }

  // Boca
  doc.lineWidth(4);
  if (mood === 'celebra') {
    doc.moveTo(84, 106).lineTo(116, 106).quadraticCurveTo(114, 126, 100, 126).quadraticCurveTo(86, 126, 84, 106).fill(INK);
  } else if (mood === 'pista') {
    doc.lineWidth(3.5).circle(100, 116, 5).stroke(INK);
  } else if (mood === 'calma') {
    doc.moveTo(91, 112).quadraticCurveTo(100, 118, 109, 112).stroke(INK);
  } else {
    doc.moveTo(88, 110).quadraticCurveTo(100, 124, 112, 110).stroke(INK);
  }

  // Brazos arriba (celebra) y foco de idea (pista)
  if (armsUp) {
    ell(36, 130, 16, 8.5, -40);
    ell(164, 130, 16, 8.5, 40);
  }
  if (mood === 'pista') {
    ell(177, 22, 13, 13, 0, PAPER);
    doc.save().rect(171, 34, 12, 6).fillAndStroke(PAPER, INK).restore();
  }

  doc.restore();
}

/** Cabecera tipo boleto con Axi a la derecha. Devuelve la Y donde termina. */
export function drawTicketHeader(doc, { heading, title, detail, mood = 'celebra' }) {
  const line = { width: 350, lineBreak: false, ellipsis: true };
  doc.lineWidth(2.5).roundedRect(M, M + 4, 380, 74, 14).stroke(INK);
  doc.lineWidth(0.8).roundedRect(M + 5, M + 9, 370, 64, 10).stroke(INK);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(19).text(heading, M + 18, M + 16, line);
  doc.font('Helvetica').fontSize(10.5).text(title, M + 18, M + 42, line);
  if (detail) doc.fontSize(9).text(detail, M + 18, M + 60, line);
  drawAxi(doc, M + CW - 50, M + 52, 100, mood);
  return M + 78;
}

/** Recuadro punteado redondeado con texto (instrucciones). Devuelve la Y donde termina. */
export function drawNoteBox(doc, text, y) {
  doc.font('Helvetica').fontSize(8.5);
  const h = doc.heightOfString(text, { width: CW - 22 }) + 12;
  doc.lineWidth(1).dash(4, { space: 3 }).roundedRect(M, y, CW, h, CARD_RADIUS).stroke(INK).undash();
  doc.fillColor(INK).text(text, M + 11, y + 6, { width: CW - 22 });
  return y + h;
}

/** Insignia negra tipo pestaña ("Pregunta 1"); se ancla sobre el borde superior de una tarjeta en `y`. */
export function drawBadge(doc, label, y) {
  doc.font('Helvetica-Bold').fontSize(8.5);
  const w = Math.max(76, doc.widthOfString(label) + 22);
  doc.roundedRect(M + 14, y - 10, w, 18, 9).fill(INK);
  doc.fillColor(PAPER).text(label, M + 14, y - 6.5, { width: w, align: 'center', lineBreak: false });
  doc.fillColor(INK);
}

/** Cabecera de páginas 2 en adelante. Devuelve la Y donde empieza el contenido. */
export function drawContinuation(doc, title) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text(`${title} (continuación)`, M, M, {
    width: CW,
    lineBreak: false,
    ellipsis: true,
  });
  doc.lineWidth(1).moveTo(M, M + 16).lineTo(M + CW, M + 16).stroke(INK);
  return M + 28;
}

/** Marco punteado y pie rayado con "Hoja i de n" en todas las páginas (requiere `bufferPages`). */
export function drawPageChrome(doc, footer) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.lineWidth(1.6).dash(8, { space: 5 }).roundedRect(24, 24, 564, 744, 16).stroke(INK).undash();
    doc.save().rect(M, 728, CW, 28).clip().lineWidth(0.7);
    for (let x = M - 28; x < M + CW; x += 6) doc.moveTo(x, 756).lineTo(x + 28, 728).stroke(INK);
    doc.restore();
    doc.lineWidth(1.2).rect(M, 728, CW, 28).stroke(INK);
    doc.rect(M + 8, 734, 340, 16).fill(PAPER).rect(M + CW - 98, 734, 90, 16).fill(PAPER);
    doc.fillColor(INK).font('Helvetica').fontSize(8.5).text(footer, M + 12, 738.5, { width: 330, lineBreak: false, ellipsis: true });
    doc.text(`Hoja ${i - range.start + 1} de ${range.count}`, M + CW - 98, 738.5, { width: 90, align: 'center', lineBreak: false });

    doc.page.margins.bottom = savedBottom;
  }
}
