import { env } from './env.js';

/**
 * Stub de configuración de SQLite usando el módulo nativo `node:sqlite` (`DatabaseSync`).
 * PRAGMAs requeridos al abrir la conexión real:
 * - PRAGMA foreign_keys = ON;
 * - PRAGMA journal_mode = WAL;
 * - PRAGMA busy_timeout = 5000;
 */
export function getDatabaseConfig() {
  return {
    filename: env.sqliteDbPath,
    pragmas: [
      'PRAGMA foreign_keys = ON;',
      'PRAGMA journal_mode = WAL;',
      'PRAGMA busy_timeout = 5000;',
    ],
  };
}
