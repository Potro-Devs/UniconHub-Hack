import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';

/**
 * PRAGMAs obligatorios para cada conexión (AGENTS.md §2).
 */
export const REQUIRED_PRAGMAS = [
  'PRAGMA foreign_keys = ON;',
  'PRAGMA journal_mode = WAL;',
  'PRAGMA busy_timeout = 5000;',
];

/**
 * Abre una conexión SQLite con `node:sqlite` y aplica los PRAGMAs obligatorios.
 * Crea la carpeta del archivo si todavía no existe.
 *
 * @param {string} [filename] Ruta del archivo o `:memory:`.
 * @returns {DatabaseSync}
 */
export function openDatabase(filename = env.sqliteDbPath) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  for (const pragma of REQUIRED_PRAGMAS) {
    db.exec(pragma);
  }
  return db;
}

let sharedDb = null;

/**
 * Conexión compartida del proceso (la usan los repositorios).
 */
export function getDatabase() {
  if (!sharedDb) {
    sharedDb = openDatabase();
  }
  return sharedDb;
}

/**
 * Cierra la conexión compartida, si está abierta.
 */
export function closeDatabase() {
  if (sharedDb) {
    sharedDb.close();
    sharedDb = null;
  }
}

/**
 * Ejecuta `fn` dentro de una transacción; hace ROLLBACK si lanza un error.
 *
 * @template T
 * @param {DatabaseSync} db
 * @param {() => T} fn
 * @returns {T}
 */
export function withTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
