import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { notFoundHandler } from './errorHandler.js';

const frontendDist = fileURLToPath(new URL('../../../../frontend/dist/', import.meta.url));

/** Serve the compiled app on the API origin, preserving API and asset 404s. */
export function installFrontend(app) {
  const indexFile = path.join(frontendDist, 'index.html');
  if (existsSync(indexFile)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (!req.accepts('html') || path.extname(req.path)) return next();
      return res.sendFile(indexFile);
    });
  }
  app.use(notFoundHandler);
}
