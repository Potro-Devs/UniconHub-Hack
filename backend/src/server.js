import app from './app.js';
import { env } from './config/env.js';

/**
 * Punto de entrada del servidor HTTP de Axi.
 */
app.listen(env.port, () => {
  console.log(`Axi API listening on http://localhost:${env.port}`);
});
