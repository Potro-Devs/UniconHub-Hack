/**
 * Módulo groups — Dominio de la importación de alumnos desde Excel (.xlsx) o CSV.
 * Funciones puras sin I/O: convierten filas de una hoja en la lista "Apellidos, Nombres" que
 * valida y guarda el alta por lista (`parseBulkInput`), así la importación reutiliza sus reglas.
 *
 * Formato esperado (el de las listas de control escolar): Apellido paterno | Apellido materno | Nombre(s).
 * Si hay encabezados se usan para ubicar las columnas; si no, se toma ese orden.
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { MAX_BULK_LINES, parseBulkStudentList } from './groups.domain.js';

export const MAX_IMPORT_BYTES = 60 * 1024;
export const IMPORT_EXTENSIONS = Object.freeze(['xlsx', 'csv']);

const invalid = (message, details) => new DomainError('VALIDATION_ERROR', message, details);
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Cuerpo `{ fileName, contentBase64 }`. Devuelve `{ kind: 'xlsx' | 'csv', buffer }`. */
export function parseImportInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.fileName !== 'string' || typeof body.contentBase64 !== 'string' || !body.contentBase64) {
    throw invalid('Elige un archivo de Excel (.xlsx) o CSV con la lista de alumnos.');
  }
  const match = /\.([a-z0-9]+)$/i.exec(body.fileName.trim());
  const extension = match?.[1].toLowerCase();
  if (!extension || !IMPORT_EXTENSIONS.includes(extension)) {
    throw invalid('Guarda la lista como Excel (.xlsx) o CSV (.csv) e inténtalo de nuevo.');
  }
  const buffer = Buffer.from(body.contentBase64, 'base64');
  if (buffer.length === 0) throw invalid('El archivo está vacío.');
  if (buffer.length > MAX_IMPORT_BYTES) throw invalid('El archivo es muy grande. Usa una hoja solo con la lista del grupo.');
  return { kind: extension, buffer };
}

/** Texto de un CSV en UTF-8 (con o sin BOM) o, si no lo es, en Latin-1 (Excel en Windows). */
export function decodeCsvBuffer(buffer) {
  const utf8 = buffer.toString('utf8').replace(/^﻿/, '');
  return utf8.includes('�') ? buffer.toString('latin1') : utf8;
}

/** CSV con separador `,`, `;` o tabulador (se detecta en el primer renglón) y comillas dobles. */
export function parseCsv(text) {
  const firstLine = String(text).split(/\r?\n/).find((line) => line.trim()) ?? '';
  const count = (ch) => firstLine.split(ch).length - 1;
  const delimiter = [';', '\t', ','].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Columnas según los encabezados. `single` = una sola columna con el nombre completo
 * ("Nombre completo", "Alumno"), que se separa como "Paterno Materno Nombre(s)".
 */
function headerColumns(cells) {
  const folded = cells.map(fold);
  const isSurname = (c) => c.includes('apellido') || c.includes('paterno') || c.includes('materno');
  const isName = (c) => (c.includes('nombre') || c.includes('alumno')) && !isSurname(c);
  if (!folded.some((c) => isSurname(c) || isName(c))) return null;
  const surnames = folded.map((c, i) => (isSurname(c) ? i : -1)).filter((i) => i >= 0);
  const nameIndex = folded.findIndex(isName);
  if (surnames.length === 0) return { single: nameIndex >= 0 ? nameIndex : 0 };
  const paternoIdx = folded.findIndex((c) => c.includes('paterno'));
  const maternoIdx = folded.findIndex((c) => c.includes('materno'));
  const paterno = paternoIdx >= 0 ? paternoIdx : surnames[0];
  const materno = maternoIdx >= 0 ? maternoIdx : surnames.find((i) => i !== paterno) ?? -1;
  // Nombre: su encabezado o, si falta, la primera columna con texto que no sea de apellidos.
  const nombre = nameIndex >= 0 ? nameIndex
    : folded.findIndex((c, i) => c && i !== paterno && i !== materno);
  return { paterno, materno, nombre };
}

/** "Paterno Materno Nombre(s)" en una sola celda → apellidos y nombres. */
function splitSingleCell(text) {
  if (text.includes(',')) return text;
  const words = text.split(' ');
  if (words.length < 2) return text;
  const surnameCount = words.length >= 3 ? 2 : 1;
  return `${words.slice(0, surnameCount).join(' ')}, ${words.slice(surnameCount).join(' ')}`;
}

/**
 * Filas de la hoja → lista "Apellidos, Nombres" (un alumno por renglón) para el alta por lista.
 *
 * @param {Array<Array<unknown>>} rows Celdas por fila, tal como vienen del archivo.
 * @returns {{ text: string, studentCount: number, invalidRows: Array<{ row: number, text: string }>, headerDetected: boolean }}
 */
export function rowsToStudentList(rows) {
  const entries = rows.map((cells, index) => ({ row: index + 1, cells: (cells ?? []).map(clean) }))
    .filter((entry) => entry.cells.some(Boolean));
  if (entries.length === 0) throw invalid('No encontramos alumnos en el archivo. Revisa que la lista esté en la primera hoja.');

  const columns = headerColumns(entries[0].cells);
  const dataRows = columns ? entries.slice(1) : entries;
  if (dataRows.length === 0) throw invalid('El archivo solo trae encabezados. Agrega la lista de alumnos debajo.');
  if (dataRows.length > MAX_BULK_LINES) {
    throw invalid(`El archivo tiene ${dataRows.length} alumnos; el máximo es ${MAX_BULK_LINES} por carga.`,
      { maxLines: MAX_BULK_LINES, lineCount: dataRows.length });
  }

  const lines = dataRows.map(({ cells }) => {
    const filled = cells.filter(Boolean);
    if (columns?.single !== undefined) return splitSingleCell(cells[columns.single] || filled.join(' '));
    if (columns) {
      if (columns.nombre < 0) return filled.join(' ');
      const lastNames = [cells[columns.paterno], columns.materno >= 0 ? cells[columns.materno] : ''].filter(Boolean).join(' ');
      const firstNames = cells[columns.nombre] ?? '';
      return lastNames && firstNames ? `${lastNames}, ${firstNames}` : filled.join(' ');
    }
    if (filled.length >= 3) return `${filled[0]} ${filled[1]}, ${filled.slice(2).join(' ')}`;
    if (filled.length === 2) return `${filled[0]}, ${filled[1]}`;
    return splitSingleCell(filled[0] ?? '');
  });

  const { students, invalidLines } = parseBulkStudentList(lines.join('\n'));
  return {
    text: lines.join('\n'),
    studentCount: students.length,
    invalidRows: invalidLines.map((l) => ({ row: dataRows[l.line - 1].row, text: dataRows[l.line - 1].cells.filter(Boolean).join(' · ') })),
    headerDetected: Boolean(columns),
  };
}
