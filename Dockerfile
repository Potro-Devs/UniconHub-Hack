# Axi — imagen de producción: un solo proceso Node sirve la API (/api/v1) y el frontend compilado.
# Node >= 22.13 (node:sqlite, ver backend/package.json).

# 1) Compila el frontend. Sin VITE_API_URL, la app llama a /api/v1 del mismo origen.
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Solo dependencias de producción del backend.
FROM node:22-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# 3) Imagen final.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    SQLITE_DB_PATH=/data/axi.db
WORKDIR /app
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/
COPY backend/src ./backend/src
COPY --from=frontend /app/frontend/dist ./frontend/dist

# La base SQLite vive en un volumen para que sobreviva a reinicios y actualizaciones.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null || exit 1

# SEED_DEMO=true carga los datos ficticios de demo (idempotente: no borra lo existente).
CMD ["sh", "-c", "if [ \"$SEED_DEMO\" = \"true\" ]; then node src/db/seed.js; fi; exec node src/server.js"]
