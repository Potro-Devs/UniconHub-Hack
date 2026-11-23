import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Se carga primero el `.env` de la raíz del monorepo y después el de `backend/` (si existe).
// Las rutas se resuelven desde este archivo para no depender del directorio de trabajo.
dotenv.config({ path: path.resolve(BACKEND_ROOT, '..', '.env') });
dotenv.config({ path: path.resolve(BACKEND_ROOT, '.env') });

/**
 * Resuelve la ruta del archivo SQLite. Las rutas relativas se toman desde `backend/`;
 * `:memory:` se respeta tal cual (útil en pruebas).
 */
function resolveDbPath(value) {
  if (value === ':memory:' || path.isAbsolute(value)) return value;
  return path.resolve(BACKEND_ROOT, value);
}

/**
 * Variables de entorno configuradas para el servidor API.
 */
export const env = {
  port: Number(process.env.PORT || 3000),
  sqliteDbPath: resolveDbPath(process.env.SQLITE_DB_PATH || './data/axi.db'),
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
};
