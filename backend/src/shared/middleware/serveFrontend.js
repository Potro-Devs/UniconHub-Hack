import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { notFoundHandler } from './errorHandler.js';

const frontendDist = fileURLToPath(new URL('../../../../frontend/dist/', import.meta.url));

/** Serve the compiled app on the API origin, preserving API and asset 404s. */
export function installFrontend(app) {
  const indexFile = path.join(frontendDist, 'index.html');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  if (existsSync(indexFile)) {
    app.use(express.static(frontendDist, {
      index: false,
      setHeaders: (res, filePath) => {
        if (path.basename(filePath) === 'index.html') res.setHeader('Cache-Control', 'no-cache');
      },
    }));
    app.get('*', (req, res, next) => {
      if (!req.accepts('html') || path.extname(req.path)) return next();
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexFile, { cacheControl: false }, (error) => {
        if (error) next(error);
      });
    });
  }
  app.use(notFoundHandler);
}
