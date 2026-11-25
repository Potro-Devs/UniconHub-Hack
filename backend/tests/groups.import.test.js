/**
 * Importación de alumnos desde Excel (.xlsx) o CSV: el archivo se convierte en la lista
 * "Apellidos, Nombres" (paterno, materno, nombre) que luego se guarda con el alta por lista.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import ExcelJS from 'exceljs';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { decodeCsvBuffer, parseCsv, rowsToStudentList } from '../src/modules/groups/groups.import.domain.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

async function xlsxBase64(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lista');
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
}

describe('importación: filas → lista de alumnos', () => {
  test('con encabezados ubica paterno, materno y nombre aunque cambie el orden', () => {
    const result = rowsToStudentList([
      ['Nombre(s)', 'Apellido Paterno', 'Apellido Materno'],
      ['Sofía', 'Ramírez', 'López'],
      ['Ana Paula', 'Cruz', 'Pérez'],
    ]);
    assert.equal(result.headerDetected, true);
    assert.equal(result.text, 'Ramírez López, Sofía\nCruz Pérez, Ana Paula');
    assert.equal(result.studentCount, 2);
    assert.deepEqual(result.invalidRows, []);
  });

  test('sin encabezados toma el orden paterno, materno, nombre; materno puede faltar', () => {
    const result = rowsToStudentList([['Ramírez', 'López', 'Sofía'], ['Díaz', '', 'Santiago'], ['Juárez Santiago Luis']]);
    assert.equal(result.headerDetected, false);
    assert.equal(result.text, 'Ramírez López, Sofía\nDíaz, Santiago\nJuárez Santiago, Luis');
    assert.equal(result.studentCount, 3);
  });

  test('marca filas sin nombre válido con su número de fila del archivo', () => {
    const result = rowsToStudentList([['Apellido paterno', 'Apellido materno', 'Nombre'], ['Ramírez', 'López', 'Sofía'], ['123', '', '###']]);
    assert.equal(result.studentCount, 1);
    assert.equal(result.invalidRows.length, 1);
    assert.equal(result.invalidRows[0].row, 3);
  });

  test('archivo vacío o con demasiados alumnos responde con un mensaje claro', () => {
    assert.throws(() => rowsToStudentList([[''], []]), /No encontramos alumnos/);
    const many = Array.from({ length: 61 }, () => ['Ramírez', 'López', 'Luis']);
    assert.throws(() => rowsToStudentList(many), /máximo es 60/);
  });

  test('CSV con ; o , comillas y acentos en Latin-1 (Excel en Windows)', () => {
    const latin1 = Buffer.from('Apellido paterno;Apellido materno;Nombre\nRamírez;López;Sofía\n"Núñez";"Peña";"José María"\n', 'latin1');
    const result = rowsToStudentList(parseCsv(decodeCsvBuffer(latin1)));
    assert.equal(result.text, 'Ramírez López, Sofía\nNúñez Peña, José María');
    const utf8 = Buffer.from('﻿Paterno,Materno,Nombre\r\nCruz,Pérez,"Ana, Paula"\r\n', 'utf8');
    assert.deepEqual(parseCsv(decodeCsvBuffer(utf8))[1], ['Cruz', 'Pérez', 'Ana, Paula']);
  });
});

describe('POST /api/v1/groups/:groupId/students/import-preview', () => {
  let db;
  let api;
  let ids;
  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);
    const school = insert("INSERT INTO schools (name) VALUES ('Escuela ficticia')");
    const teacher = insert("INSERT INTO users (school_id,email,password_hash,full_name,role) VALUES (?,'t@imp.test','x','Persona ficticia','teacher')", school);
    const other = insert("INSERT INTO users (school_id,email,password_hash,full_name,role) VALUES (?,'o@imp.test','x','Persona ficticia','teacher')", school);
    const group = insert("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'A','2026-2027','IMPT3A')", school, teacher);
    ids = { school, teacher, other, group };
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
  });
  after(async () => { await api.close(); db.close(); });
  const as = (sub, role = 'teacher') => tokenFor({ sub: String(sub), role, schoolId: ids.school });
  const url = () => `/api/v1/groups/${ids.group}/students/import-preview`;

  test('lee un .xlsx y devuelve la lista sin guardar alumnos', async () => {
    const contentBase64 = await xlsxBase64([['Apellido paterno', 'Apellido materno', 'Nombre(s)'], ['Ramírez', 'López', 'Sofía'], ['Díaz', '', 'Santiago']]);
    const res = await api.call('POST', url(), { token: as(ids.teacher), body: { fileName: 'lista 3A.xlsx', contentBase64 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.text, 'Ramírez López, Sofía\nDíaz, Santiago');
    assert.equal(res.body.data.studentCount, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM students').get().n, 0, 'la vista previa no guarda');

    const saved = await api.call('POST', `/api/v1/groups/${ids.group}/students/bulk`, { token: as(ids.teacher), body: { text: res.body.data.text } });
    assert.equal(saved.status, 201);
    assert.deepEqual(saved.body.data.created.map((s) => s.lastNames), ['Ramírez López', 'Díaz']);
  });

  test('lee un .csv', async () => {
    const contentBase64 = Buffer.from('Cruz,Pérez,Ana Paula\n').toString('base64');
    const res = await api.call('POST', url(), { token: as(ids.teacher), body: { fileName: 'lista.csv', contentBase64 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.text, 'Cruz Pérez, Ana Paula');
  });

  test('rechaza otros formatos, archivos dañados, grupos ajenos y otros roles', async () => {
    const bad = await api.call('POST', url(), { token: as(ids.teacher), body: { fileName: 'lista.xls', contentBase64: 'AAAA' } });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error.message, /\.xlsx/);
    const broken = await api.call('POST', url(), { token: as(ids.teacher), body: { fileName: 'lista.xlsx', contentBase64: Buffer.from('no es excel').toString('base64') } });
    assert.equal(broken.status, 400);
    const foreign = await api.call('POST', url(), { token: as(ids.other), body: { fileName: 'lista.csv', contentBase64: Buffer.from('A,B,C').toString('base64') } });
    assert.equal(foreign.status, 404);
    const director = await api.call('POST', url(), { token: as(ids.teacher, 'director'), body: { fileName: 'lista.csv', contentBase64: 'QQ==' } });
    assert.equal(director.status, 403);
  });
});
