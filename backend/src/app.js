import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

/**
 * Endpoint base de verificación de salud del servicio.
 */
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    data: { status: 'ok', service: 'axi-backend' },
    meta: { version: 'v1' },
  });
});

export default app;
