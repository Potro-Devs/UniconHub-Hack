/** Renderizadores de archivos. Reciben DTO autorizados; no consultan ni escriben datos. */
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const percent = (value) => value == null ? 'Sin evaluar' : `${value.toFixed(2)}%`;
const percentageFraction = (value) => value == null ? null : Math.round(value * 100) / 10000;
const groupName = (data) => `${data.group.grade}.º ${data.group.section} · ${data.group.schoolYear}`;
const selectedSkills = (data) => data.skills.filter((skill) => !data.selection.skillCode || skill.code === data.selection.skillCode);
const selectionName = (data) => `${selectedSkills(data).map((skill) => skill.name).join(', ')}; ${data.selection.supportOnly ? 'Solo Necesita apoyo' : 'Todos los alumnos'}`;
const gradeCountsLabel = (gradeCounts) => Object.entries(gradeCounts || {})
  .filter(([, count]) => count > 0)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([grade, count]) => `${grade}.º (${count})`)
  .join(', ') || 'Sin evaluar';
const gradeLabel = (grade) => grade == null ? 'Sin evaluar' : `${grade}.º`;
const PRIVACY_NOTICE = 'Contiene datos personales de menores. Uso escolar privado; no compartir fuera de la escuela.';
const generatedAt = () => new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date());

const METHODOLOGY = [
  'Resumen y gráficas: grupo completo. Resultados: alumnos de la selección y habilidades elegidas.',
  'Dominio actual: último corte longitudinal inmutable, promedio ponderado de sesiones autónomas con pesos 1, 2, ..., n.',
  'Autónomo y Logrado con apoyo de última sesión se presentan separados. Los aciertos con pistas no se suman al dominio autónomo.',
  'Necesita apoyo: 0-24.99%; En proceso: 25-49.99%; Logrado: 50-74.99%; Dominado: 75-100%.',
  'Sin evaluar significa ausencia de evidencia; no equivale a 0%. Los promedios excluyen alumnos sin evidencia.',
  'Evidencia por habilidad = alumnos evaluados / alumnos activos del grupo. La distribución incluye Sin evaluar.',
  'Cobertura curricular = contenidos vistos / total del grado. No representa contenidos evaluados.',
  'El filtro Solo Necesita apoyo usa la habilidad elegida; con todas las habilidades incluye a quien necesita apoyo en al menos una.',
  'Última evidencia corresponde al corte más reciente de alumnos activos. Las fechas de cortes se muestran en UTC.',
  'Contenido pedagógico del catálogo: por validar con docente. Reporte para uso escolar privado.',
  'Los grados de corte se muestran por habilidad y alumno; pueden corresponder a grados anteriores.',
];

function styleSheet(sheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.properties.defaultRowHeight = 24;
  sheet.eachRow((row, number) => {
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF18203A' } };
      cell.alignment = { vertical: 'top', wrapText: true };
      if (number === 1) {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF283750' } };
      }
    });
  });
  sheet.pageSetup = { paperSize: 1, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

export async function renderAnalyticsXlsx(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Plataforma de diagnóstico educativo';
  workbook.created = new Date();
  const summary = workbook.addWorksheet('Resumen');
  summary.columns = [{ width: 38 }, { width: 26 }, ...Array.from({ length: 9 }, () => ({ width: 19 }))];
  summary.addRow([PRIVACY_NOTICE]);
  summary.mergeCells('A1:K1');
  summary.getRow(1).height = 36;
  summary.addRow(['Reporte del grupo completo', 'Valor']);
  summary.addRow(['Grupo y ciclo', groupName(data)]);
  summary.addRow(['Generado (Ciudad de México)', generatedAt()]);
  summary.addRow(['Selección del detalle', selectionName(data)]);
  summary.mergeCells('B5:J5');
  summary.getRow(5).height = 48;
  summary.addRow(['Alumnos activos', data.summary.studentCount]);
  summary.addRow(['Con evidencia en alguna habilidad', data.summary.evaluatedStudentCount]);
  summary.addRow(['Sin evidencia', data.summary.notEvaluatedStudentCount]);
  summary.addRow(['Necesitan apoyo en alguna habilidad', data.summary.needsSupportCount]);
  summary.addRow(['Alumnos de la selección', data.selection.studentCount]);
  summary.addRow(['Última evidencia (UTC)', data.summary.latestRecordedAt ?? 'Sin evidencia']);
  summary.addRow(['Contenidos vistos / total', `${data.summary.coverage.seen} / ${data.summary.coverage.total}`]);
  summary.addRow(['Cobertura curricular', percentageFraction(data.summary.coverage.coveragePercentage)]);
  summary.getCell('B13').numFmt = '0.00%';
  summary.addRow([]);
  const header = summary.addRow(['Habilidad', 'Dominio promedio', 'Grados de los cortes', 'Nivel', 'Evaluados', 'Evidencia', 'Necesita apoyo', 'En proceso', 'Logrado', 'Dominado', 'Sin evaluar']);
  header.height = 36;
  data.skills.forEach((skill) => {
    const row = summary.addRow([skill.name, percentageFraction(skill.average),
      gradeCountsLabel(skill.gradeCounts), skill.label, skill.evaluatedCount, percentageFraction(skill.evidencePercentage),
      skill.distribution.needs_support, skill.distribution.in_progress, skill.distribution.achieved,
      skill.distribution.mastered, skill.distribution.not_evaluated]);
    row.getCell(2).numFmt = '0.00%'; row.getCell(6).numFmt = '0.00%'; row.height = 36;
  });
  const results = workbook.addWorksheet('Resultados');
  results.columns = [
    { header: 'Alumno', width: 34 }, { header: 'Iniciales', width: 12 }, { header: 'Habilidad', width: 30 },
    { header: 'Grado del corte', width: 16 }, { header: 'Dominio actual autónomo', width: 20 }, { header: 'Nivel', width: 23 },
    { header: 'Autónomo última sesión', width: 22 }, { header: 'Logrado con apoyo última sesión', width: 25 },
    { header: 'Fecha del corte (UTC)', width: 23 },
  ];
  for (const student of data.students) {
    for (const skill of student.skills.filter((entry) => !data.selection.skillCode || entry.code === data.selection.skillCode)) {
      const row = results.addRow([String(student.name), String(student.initials), skill.name, gradeLabel(skill.grade),
        percentageFraction(skill.masteryPercentage), skill.label,
        percentageFraction(skill.autonomousPercentage), percentageFraction(skill.supportedPercentage),
        skill.recordedAt ?? 'Sin evaluar']);
      [5, 7, 8].forEach((column) => { row.getCell(column).numFmt = '0.00%'; });
      row.height = Math.max(34, Math.ceil(student.name.length / 28) * 15);
    }
  }
  results.autoFilter = { from: 'A1', to: `I${Math.max(1, results.rowCount)}` };
  results.getRow(1).height = 44;
  const method = workbook.addWorksheet('Metodología');
  method.columns = [{ width: 32 }, { width: 105 }];
  method.addRow(['Metodología y alcance', 'Descripción']);
  method.addRow(['Grupo', groupName(data)]);
  method.addRow(['Selección', selectionName(data)]);
  method.getRow(3).height = 44;
  METHODOLOGY.forEach((text, index) => { method.addRow([`Nota ${index + 1}`, text]).height = 44; });
  [summary, results, method].forEach(styleSheet);
  header.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF283750' } };
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Carta, blanco y negro, cabeceras repetidas; celdas con altura según contenido. */
export function renderAnalyticsPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 42, bufferPages: true,
      info: { Title: 'Reporte de diagnóstico del grupo', Author: 'Plataforma educativa' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const width = 528;
    const bottom = 726;
    const heading = (title) => {
      doc.font('Helvetica-Bold').fontSize(17).fillColor('black').text(title, 42, 42, { width });
      doc.moveDown(0.3).font('Helvetica').fontSize(10).text(groupName(data), { width });
      doc.moveDown(0.6);
    };
    const newPage = (title) => { doc.addPage(); heading(title); };
    const paragraph = (text, size = 10) => {
      doc.font('Helvetica').fontSize(size);
      const height = doc.heightOfString(text, { width });
      if (doc.y + height > bottom) newPage('Reporte del grupo - continuación');
      doc.font('Helvetica').fontSize(size).text(text, 42, doc.y, { width });
      doc.moveDown(0.45);
    };
    const rowHeight = (values, widths, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      return Math.max(24, ...values.map((value, index) =>
        doc.heightOfString(String(value), { width: widths[index] - 12 }) + 12));
    };
    const tableRow = (values, widths, bold = false) => {
      const height = rowHeight(values, widths, bold);
      let x = 42;
      const y = doc.y;
      values.forEach((value, index) => {
        doc.lineWidth(0.5).strokeColor('black').rect(x, y, widths[index], height).stroke();
        doc.fillColor('black').text(String(value), x + 6, y + 6, { width: widths[index] - 12 });
        x += widths[index];
      });
      doc.y = y + height;
      doc.x = 42;
    };
    try {
      heading('Diagnóstico del grupo');
      paragraph(`${PRIVACY_NOTICE} Generado: ${generatedAt()} (Ciudad de México).`);
      paragraph(`Resumen del grupo completo: ${data.summary.studentCount} alumnos activos; ${data.summary.evaluatedStudentCount} con evidencia; ${data.summary.notEvaluatedStudentCount} sin evidencia; ${data.summary.needsSupportCount} necesitan apoyo en alguna habilidad.`);
      paragraph(`Última evidencia (UTC): ${data.summary.latestRecordedAt ?? 'Sin evidencia'}. Cobertura curricular: ${data.summary.coverage.seen} de ${data.summary.coverage.total} contenidos vistos (${percent(data.summary.coverage.coveragePercentage)}).`);
      const summaryWidths = [146, 104, 104, 92, 82];
      tableRow(['Habilidad', 'Dominio promedio', 'Grados de los cortes', 'Con evidencia', 'Sin evaluar'], summaryWidths, true);
      data.skills.forEach((skill) => tableRow([skill.name, skill.average == null ? 'Sin evaluar' : `${percent(skill.average)} · ${skill.label}`,
        gradeCountsLabel(skill.gradeCounts), `${skill.evaluatedCount} alumnos\n${percent(skill.evidencePercentage)}`, skill.distribution.not_evaluated], summaryWidths));
      doc.moveDown(0.7);
      paragraph(`Selección del detalle: ${selectionName(data)}. ${data.selection.studentCount} de ${data.summary.studentCount} alumnos.`);
      paragraph('El dominio actual mide autonomía longitudinal. Los aciertos con pistas se muestran por separado en la última sesión. Sin evaluar no equivale a 0%.');
      paragraph('Contenido pedagógico de ejemplo: por validar con docente.');
      newPage('Resultados de la selección');
      paragraph(`${data.selection.studentCount} alumnos. ${selectionName(data)}.`);
      const detailWidths = [144, 84, 112, 90, 98];
      const detailHeader = ['Habilidad', 'Grado\ndel corte', 'Dominio actual\n% y nivel', 'Autónomo\núltima sesión', 'Con apoyo\núltima sesión'];
      const tableHeader = () => tableRow(detailHeader, detailWidths, true);
      const detailValues = (skill) => [skill.name, gradeLabel(skill.grade),
        skill.masteryPercentage == null ? 'Sin evaluar' : `${percent(skill.masteryPercentage)} · ${skill.label}`,
        percent(skill.autonomousPercentage), percent(skill.supportedPercentage)];
      if (!data.students.length) paragraph('No hay alumnos que coincidan con esta selección.');
      for (const student of data.students) {
        const skills = student.skills.filter((skill) => !data.selection.skillCode || skill.code === data.selection.skillCode);
        const name = `${student.initials} · ${student.name}`;
        doc.font('Helvetica-Bold').fontSize(11);
        const titleHeight = doc.heightOfString(name, { width });
        const firstRowHeight = skills.length ? rowHeight(detailValues(skills[0]), detailWidths) : 0;
        if (doc.y + titleHeight + rowHeight(detailHeader, detailWidths, true) + firstRowHeight + 10 > bottom) newPage('Resultados - continuación');
        doc.font('Helvetica-Bold').fontSize(11).text(name, 42, doc.y, { width });
        doc.moveDown(0.35);
        tableHeader();
        for (const skill of skills) {
          const values = detailValues(skill);
          if (doc.y + rowHeight(values, detailWidths) > bottom) {
            newPage('Resultados - continuación');
            paragraph(`${name} (continuación)`, 11);
            tableHeader();
          }
          tableRow(values, detailWidths);
        }
        doc.moveDown(0.8);
      }
      newPage('Metodología y alcance');
      METHODOLOGY.forEach((text) => paragraph(text));
      const pages = doc.bufferedPageRange();
      for (let index = pages.start; index < pages.start + pages.count; index += 1) {
        doc.switchToPage(index);
        doc.font('Helvetica').fontSize(8).text(`Uso escolar privado · Página ${index + 1} de ${pages.count}`, 42, 734, { width, lineBreak: false, align: 'right' });
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
