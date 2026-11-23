import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();

/**
 * Variables de entorno configuradas para el servidor API.
 */
export const env = {
  port: Number(process.env.PORT || 3000),
  sqliteDbPath: process.env.SQLITE_DB_PATH || './data/axi.db',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
};
