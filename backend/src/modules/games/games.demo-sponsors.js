/**
 * Marcas de demostración para los juegos patrocinados, configuradas **en el servidor** (no en el repo).
 *
 * Si `DEMO_SPONSORS_DIR` apunta a una carpeta con `patrocinadores.json` y los logos, esos nombres y
 * logos reemplazan a "Marca patrocinadora de ejemplo". Los logos no se suben a git ni a la imagen
 * de Docker: viven en el servidor donde se despliega (volumen). Sin carpeta, todo sigue igual.
 * La leyenda "Demostración · sin convenio real" se mantiene siempre (`demo: true`).
 *
 * Formato de `patrocinadores.json`:
 *   { "grammar_fix": { "name": "Marca A", "logo": "marca-a.png" }, "mental_math": { ... }, "symmetry": { ... } }
 */
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { parseDemoSponsorsConfig } from './games.sponsored.domain.js';

export const DEMO_SPONSORS_FILE = 'patrocinadores.json';
export const DEMO_SPONSORS_URL = '/api/v1/demo-sponsors';
const EMPTY = Object.freeze({ dir: null, overrides: new Map() });

/** Lee la carpeta una sola vez al arrancar. Cualquier problema se registra y se ignora. */
export function loadDemoSponsors(dir, logger = console) {
  if (!dir) return EMPTY;
  try {
    const files = new Set(fs.readdirSync(dir));
    if (!files.has(DEMO_SPONSORS_FILE)) return EMPTY;
    const raw = JSON.parse(fs.readFileSync(path.join(dir, DEMO_SPONSORS_FILE), 'utf8'));
    const { overrides, warnings } = parseDemoSponsorsConfig(raw, files);
    for (const warning of warnings) logger.warn?.(`[demo-sponsors] ${warning}`);
    if (overrides.size) logger.info?.(`[demo-sponsors] ${overrides.size} juego(s) con marca de demostración.`);
    return { dir, overrides };
  } catch (error) {
    logger.warn?.(`[demo-sponsors] No se pudo leer ${dir}: ${error.message}. Se usa la marca de ejemplo.`);
    return EMPTY;
  }
}

/** URL pública del logo de un juego (o null). */
export const demoSponsorLogoUrl = (logo) => (logo ? `${DEMO_SPONSORS_URL}/${encodeURIComponent(logo)}` : null);

/**
 * Sirve **solo** los logos que aparecen en `patrocinadores.json` (nunca otros archivos de la carpeta).
 * Encabezados defensivos: un SVG abierto directamente no puede ejecutar scripts en este origen.
 */
export function createDemoSponsorAssetsRouter({ dir, overrides }) {
  const allowed = new Set([...overrides.values()].map((entry) => entry.logo));
  const router = Router();
  router.get('/:file', (req, res, next) => {
    const { file } = req.params;
    if (!dir || !allowed.has(file)) return next();
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'Cache-Control': 'public, max-age=300',
    });
    return res.sendFile(path.join(dir, file), (error) => { if (error) next(); });
  });
  return router;
}
