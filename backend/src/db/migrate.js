import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeDatabase, getDatabase, withTransaction } from '../config/database.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Aplica, en orden alfabético, los archivos `migrations/*.sql` que aún no estén registrados
 * en `schema_migrations`. Cada migración corre en su propia transacción.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {string[]} Nombres de las migraciones aplicadas en esta ejecución.
 */
export function runMigrations(db, migrationsDir = MIGRATIONS_DIR) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name),
  );

  const pending = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql') && !applied.has(file))
    .sort();

  const insert = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    withTransaction(db, () => {
      db.exec(sql);
      insert.run(file);
    });
  }
  return pending;
}

// Uso directo: `npm run migrate`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const appliedNow = runMigrations(getDatabase());
  console.log(
    appliedNow.length
      ? `Migraciones aplicadas: ${appliedNow.join(', ')}`
      : 'La base de datos ya está al día.',
  );
  closeDatabase();
}
