/**
 * Demo: deja abierta la ventana de "imagen secreta" del grupo demo, para que al entrar por código
 * (Entrar → código MAPA3A → tarjeta) el alumno pueda elegir su imagen y se vea el flujo completo.
 * En una escuela real la docente la abre solo en clase ("Hoy configuramos imágenes").
 */
import { DEMO } from './demo.data.js';

/**
 * Fin del ciclo escolar 2026–2027 (UTC). Fecha fija para que el seed sea reproducible
 * (seed.determinism.test compara dos bases tabla por tabla).
 */
export const DEMO_SECRET_WINDOW_UNTIL = '2027-07-16 00:00:00';

/** Abre la ventana del grupo demo si aún no tiene una fecha. Devuelve true si la abrió. */
export function openDemoSecretWindow(db) {
  const group = db.prepare('SELECT id, secret_setup_until FROM groups WHERE join_code = ?').get(DEMO.currentGroup.joinCode);
  if (!group || group.secret_setup_until) return false;
  db.prepare('UPDATE groups SET secret_setup_until = ? WHERE id = ?').run(DEMO_SECRET_WINDOW_UNTIL, group.id);
  return true;
}
