/** Material privado de aprendizaje en equipo. PDF Carta, tinta negra, sin folios ni claves en las hojas de alumnos. */
import PDFDocument from 'pdfkit';

const LEFT = 44;
const WIDTH = 524;
const BOTTOM = 724;
const font = (doc, size = 11, bold = false) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor('black');
const groupName = (group) => `${group.grade}.º ${group.section}  |  Ciclo ${group.schoolYear}`;
const optionsLine = (question) => question.options.map((option) => `${option.label}) ${option.text}`).join('     ');
const pageContexts = new WeakMap();

function layout(doc) {
  const ensure = (height) => {
    if (doc.y + height <= BOTTOM) return;
    doc.addPage();
    const context = pageContexts.get(doc);
    if (context) header(doc, context.group, context.session, { ...context.options, label: `${context.options.label} - Continuación` });
  };
  const text = (value, { size = 11, bold = false, gap = 7 } = {}) => {
    font(doc, size, bold);
    ensure(doc.heightOfString(value, { width: WIDTH }) + gap);
    doc.text(value, LEFT, doc.y, { width: WIDTH, lineGap: 2 });
    doc.y += gap;
  };
  const box = (title, body, { size = 11, space = 0, numbered = null } = {}) => {
    const inset = numbered === null ? 14 : 48;
    const innerWidth = WIDTH - inset - 14;
    font(doc, 11, true);
    const titleHeight = doc.heightOfString(title, { width: innerWidth, lineGap: 2 });
    font(doc, size);
    const bodyHeight = doc.heightOfString(body, { width: innerWidth, lineGap: 2 });
    const height = Math.max(50, titleHeight + bodyHeight + space + 28);
    ensure(height + 10);
    const top = doc.y;
    doc.save().lineWidth(0.8).strokeColor('black').roundedRect(LEFT, top, WIDTH, height, 8).stroke().restore();
    if (numbered !== null) {
      doc.save().lineWidth(1).circle(LEFT + 24, top + 26, 12).stroke().restore();
      font(doc, 11, true).text(String(numbered), LEFT + 12, top + 21, { width: 24, align: 'center', lineBreak: false });
    }
    font(doc, 11, true).text(title, LEFT + inset, top + 12, { width: innerWidth, lineGap: 2 });
    font(doc, size).text(body, LEFT + inset, top + 17 + titleHeight, { width: innerWidth, lineGap: 2 });
    if (space) {
      const start = top + 24 + titleHeight + bodyHeight;
      for (let y = start + 16; y < top + height - 10; y += 20) {
        doc.save().lineWidth(0.35).strokeColor('black').moveTo(LEFT + inset, y).lineTo(LEFT + WIDTH - 14, y).stroke().restore();
      }
    }
    doc.y = top + height + 10;
  };
  return { text, box };
}

function header(doc, group, session, { label, title, privateCopy = false }) {
  pageContexts.set(doc, { group, session, options: { label, title, privateCopy } });
  const { text } = layout(doc);
  text(privateCopy ? 'SOLO PARA DOCENTES - NO REPARTIR' : 'APRENDEMOS EN EQUIPO', { size: 9, bold: true, gap: 10 });
  text(title, { size: 23, bold: true, gap: 4 });
  text(`${session.skillName}  |  ${label}`, { size: 11, bold: true, gap: 7 });
  text(`${groupName(group)}  |  Sesión ${session.id}`, { size: 9, gap: 12 });
  const y = doc.y;
  doc.save().lineWidth(1.5).moveTo(LEFT, y).lineTo(LEFT + WIDTH, y).stroke().restore();
  doc.y = y + 15;
}

function footer(doc, privateCopy = false) {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i += 1) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.save().lineWidth(0.5).moveTo(LEFT, 744).lineTo(LEFT + WIDTH, 744).stroke().restore();
    font(doc, 8).text(privateCopy ? 'Uso exclusivo docente. Contiene datos de menores.' : 'Uso escolar privado. Material por validar con docente.', LEFT, 753, { width: WIDTH - 95, lineBreak: false });
    font(doc, 8).text(`Página ${i + 1} de ${pages.count}`, LEFT + WIDTH - 90, 753, { width: 90, align: 'right', lineBreak: false });
  }
}

function render(title, draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: LEFT, bufferPages: true, info: { Title: title, Author: 'Plataforma educativa' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try { draw(doc); doc.end(); } catch (error) { doc.destroy(); reject(error); }
  });
}

function identity(doc, card, students = null) {
  const { text } = layout(doc);
  if (students) text(`Vamos a practicar: ${students.join(', ')}`, { size: 11, bold: true, gap: 12 });
  else {
    text(`Compañero guía: ${card.tutor.name}`, { size: 11, bold: true, gap: 4 });
    text(`Vamos a practicar: ${card.tutee.name}`, { size: 11, bold: true, gap: 12 });
  }
}

function guide(doc, card, frames = [], rules = []) {
  const { text, box } = layout(doc);
  text('1. Escuchamos y preguntamos', { size: 13, bold: true, gap: 6 });
  text(rules.length ? `${rules[0]} Usa una pista a la vez y espera antes de continuar.` : 'Pregunta cómo lo pensó. Da tiempo para responder y usa las pistas en orden.', { size: 10, gap: 11 });
  if (card.tutorOvercameError) text('Cuenta qué te ayudó a aprender. Tu experiencia puede ayudar a tu compañero.', { size: 10, gap: 8 });
  text('2. Práctica guiada', { size: 13, bold: true, gap: 7 });
  if (card.practice) {
    box(card.practice.stem, optionsLine(card.practice), { size: 12 });
    for (const step of card.script.steps) box(`Pista ${step.level} - ${step.instruction}`, step.text, { size: 11, numbered: step.level });
  }
  if (frames.length && doc.y < 630) {
    text('Preguntas para conversar', { size: 12, bold: true, gap: 5 });
    text(frames.slice(0, 2).join('\n'), { size: 10, gap: 8 });
  }
  if (doc.y < 690) text('Después, guarda esta hoja. La siguiente se resuelve sin pistas.', { size: 10, bold: true, gap: 4 });
}

function demonstration(doc, card, demonstrationItems) {
  const { text, box } = layout(doc);
  text('Resuelve a tu ritmo, sin pistas ni ayuda. Puedes dibujar o escribir cómo lo pensaste.', { size: 11, gap: 8 });
  // El banco de lectura repite el mismo pasaje en cada reactivo: se imprime una vez,
  // conservando su texto completo, para dejar espacio de trabajo junto a las preguntas.
  const parts = card.demonstration.map((question) => question.stem.split('\n\n'));
  const sharedPassage = parts.length > 0 && parts.every((part) => part.length >= 3
    && part.slice(0, -1).join('\n\n') === parts[0].slice(0, -1).join('\n\n'));
  if (sharedPassage) box('Lee este texto', parts[0].slice(0, -1).join('\n\n'), { size: 11 });
  card.demonstration.forEach((question, index) => {
    box(sharedPassage ? parts[index].at(-1) : question.stem, `${optionsLine(question)}\nRespuesta: ______`,
      { size: sharedPassage ? 11 : 12, space: sharedPassage ? 0 : 40, numbered: index + 1 });
  });
  text(`Registro docente - aciertos sin ayuda: ${Array.from({ length: demonstrationItems + 1 }, (_, n) => n).join('   ')}. Cada intento nos ayuda a saber qué practicar.`, { size: 9, gap: 4 });
}

/** Dos hojas por equipo: acompañamiento y demostración individual, sin clave de respuestas. */
export function renderTutorCardsPdf({ group, session, cards, frames, rules, demonstrationItems }) {
  return render('Aprendemos en equipo - hojas para compañeros', (doc) => {
    const peers = cards.filter((card) => card.tutor);
    if (!peers.length) {
      header(doc, group, session, { title: 'Aprendemos en equipo', label: 'Organización de la sesión' });
      layout(doc).box('Hoy practicamos con el docente', 'El material de esta sesión está en la guía docente. No hay hojas de compañeros para repartir.');
    }
    peers.forEach((card, index) => {
      if (index > 0) doc.addPage();
      header(doc, group, session, { title: 'Aprendemos en equipo', label: 'Hoja 1 - Para conversar y practicar' });
      identity(doc, card);
      guide(doc, card, frames, rules);
      doc.addPage();
      header(doc, group, session, { title: 'Ahora lo intento', label: 'Hoja 2 - Demostración individual' });
      layout(doc).text(`Nombre: ${card.tutee.name}`, { size: 11, bold: true, gap: 12 });
      demonstration(doc, card, demonstrationItems);
    });
    footer(doc);
  });
}

/** Clave y material de la mesa docente en un documento separado y privado. */
export function renderTeacherKeyPdf({ group, session, cards }) {
  return render('Aprendemos en equipo - guía docente privada', (doc) => {
    header(doc, group, session, { title: 'Guía docente', label: 'Aprendemos en equipo', privateCopy: true });
    const { text, box } = layout(doc);
    text('Revisa la demostración individual y registra los aciertos en la pantalla de equipos. Esta evidencia no modifica el dominio oficial.', { size: 11, gap: 14 });
    text('Clave de la demostración', { size: 14, bold: true, gap: 8 });
    const seen = new Set();
    const questions = cards.flatMap((card) => card.demonstration).filter((question) => !seen.has(question.id) && seen.add(question.id));
    if (!questions.length) text('Sin reactivos de demostración.');
    questions.forEach((question) => {
      const parts = question.stem.split('\n\n');
      text(`${parts.length >= 3 ? parts.at(-1) : question.stem} - Respuesta: ${question.correctLabel ?? 'sin clave'}`, { size: 11, gap: 7 });
    });
    doc.y += 8;
    text('Mesa docente', { size: 14, bold: true, gap: 8 });
    const teacherRows = cards.filter((card) => !card.tutor);
    if (!teacherRows.length) text('Todos los alumnos de esta sesión practican con un compañero guía.');
    else {
      text('En las páginas siguientes encontrarás la práctica, las pistas y la demostración para acompañar a estos alumnos.', { size: 11, gap: 10 });
      teacherRows.forEach((card) => text(`${card.tutee.name}${card.tutorInactive ? ' (su compañero guía ya no está en el grupo)' : ''}`, { size: 11, gap: 5 }));
    }
    box('Al registrar', 'Anota solo los aciertos resueltos sin ayuda (0 a 3). Si cambia una captura, se toma la demostración registrada más recientemente.', { size: 10 });
    const materials = new Map();
    for (const card of teacherRows) {
      const key = JSON.stringify([card.errorTag, card.practice?.id, card.demonstration.map((question) => question.id)]);
      if (!materials.has(key)) materials.set(key, { card, students: [] });
      materials.get(key).students.push(card.tutee.name);
    }
    for (const { card, students } of materials.values()) {
      doc.addPage();
      header(doc, group, session, { title: 'Material para la mesa docente', label: 'Práctica guiada', privateCopy: true });
      identity(doc, card, students);
      if (card.explanation) layout(doc).text(`Confusión a trabajar: ${card.explanation}`, { size: 10, gap: 12 });
      guide(doc, card);
      doc.addPage();
      header(doc, group, session, { title: 'Material para la mesa docente', label: 'Demostración individual', privateCopy: true });
      identity(doc, card, students);
      demonstration(doc, card, 3);
    }
    footer(doc, true);
  });
}
