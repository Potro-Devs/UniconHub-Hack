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

const DEV_JWT_SECRET = 'dev_jwt_secret_change_me';
const PLACEHOLDER_SECRETS = new Set([DEV_JWT_SECRET, 'change_me']);
const MIN_PRODUCTION_SECRET_LENGTH = 32;

function parseBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

/**
 * Construye y valida la configuración. En producción exige un `JWT_SECRET` propio y robusto,
 * y deja desactivados los accesos rápidos de demo salvo que se activen explícitamente.
 *
 * @param {NodeJS.ProcessEnv} source
 */
export function loadConfig(source = process.env) {
  const nodeEnv = source.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const jwtSecret = source.JWT_SECRET || DEV_JWT_SECRET;

  if (isProduction && (PLACEHOLDER_SECRETS.has(jwtSecret) || jwtSecret.length < MIN_PRODUCTION_SECRET_LENGTH)) {
    throw new Error(
      `JWT_SECRET debe definirse en producción con al menos ${MIN_PRODUCTION_SECRET_LENGTH} caracteres y no puede ser un valor de ejemplo.`,
    );
  }

  return {
    port: Number(source.PORT || 3000),
    sqliteDbPath: resolveDbPath(source.SQLITE_DB_PATH || './data/axi.db'),
    jwtSecret,
    corsOrigin: source.CORS_ORIGIN || 'http://localhost:5173',
    nodeEnv,
    auth: {
      teacherTokenTtl: source.TEACHER_TOKEN_TTL || '8h',
      studentTokenTtl: source.STUDENT_TOKEN_TTL || '2h',
      // Accesos rápidos "Entrar como Docente / Directivo / Alumno" (solo demo).
      quickLoginEnabled: parseBoolean(source.ENABLE_QUICK_LOGIN, !isProduction),
      quickLoginTeacherEmail: source.QUICK_LOGIN_TEACHER_EMAIL || 'docente@axi.demo',
      quickLoginDirectorEmail: source.QUICK_LOGIN_DIRECTOR_EMAIL || 'direccion@axi.demo',
      // Intentos permitidos por IP en el login del personal.
      rateLimit: {
        windowMs: Number(source.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
        max: Number(source.AUTH_RATE_LIMIT_MAX || 20),
      },
      // Acceso del alumno por IP: un salón entero suele compartir la misma IP (45 alumnos × varios
      // pasos), así que el límite es amplio. El código de grupo tiene 6 caracteres (31⁶ combinaciones).
      studentJoinRateLimit: {
        windowMs: Number(source.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
        max: Number(source.AUTH_STUDENT_JOIN_MAX || 600),
      },
      // Intentos de imagen secreta por alumno (no por IP): frena que alguien adivine la de otro.
      secretAttemptsPerStudent: {
        windowMs: Number(source.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
        max: Number(source.AUTH_SECRET_ATTEMPTS_MAX || 8),
      },
    },
  };
}

/**
 * Variables de entorno configuradas para el servidor API.
 */
export const env = loadConfig();
