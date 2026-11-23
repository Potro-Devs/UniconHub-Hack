import { createApp } from './app.js';
import { closeDatabase, getDatabase } from './config/database.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';

/**
 * Punto de entrada del servidor HTTP de Axi.
 * Abre SQLite y aplica las migraciones pendientes antes de aceptar peticiones.
 */
const db = getDatabase();
const applied = runMigrations(db);
if (applied.length) {
  console.log(`Migraciones aplicadas: ${applied.join(', ')}`);
}

if (env.auth.quickLoginEnabled) {
  console.log('Acceso rápido de demostración activo (ENABLE_QUICK_LOGIN).');
}

const server = createApp({ db }).listen(env.port, () => {
  console.log(`Axi API listening on http://localhost:${env.port}`);
});

const shutdown = () => {
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
