/**
 * Lectura de archivos de la importación de alumnos (adaptador de exceljs). Recibe bytes ya
 * validados y devuelve filas de texto; no escribe datos.
 */
import ExcelJS from 'exceljs';
import { DomainError } from '../../shared/errors/DomainError.js';
import { decodeCsvBuffer, parseCsv } from './groups.import.domain.js';

function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    if (value instanceof Date) return '';
    return '';
  }
  return String(value);
}

/** Filas de la primera hoja de un .xlsx o de un .csv. */
export async function readSpreadsheetRows(kind, buffer) {
  if (kind === 'csv') return parseCsv(decodeCsvBuffer(buffer));
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new DomainError('VALIDATION_ERROR', 'No pudimos abrir el archivo. Guárdalo como Excel (.xlsx) e inténtalo de nuevo.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(values.map(cellText));
  });
  return rows;
}
