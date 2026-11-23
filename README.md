# Axi

Monorepo del sistema de diagnóstico educativo longitudinal **Axi** (`backend/` en Node.js + Express y `frontend/` en React + Vite).

---

## Requisitos previos

- **Node.js `>= 22.13.0`** (requerido por el módulo nativo `node:sqlite` del backend sin el flag `--experimental-sqlite`)
- **npm** (incluido con Node.js)

---

## Instalación

Desde la raíz del repositorio, instala las dependencias de ambos proyectos:

```bash
npm run install:all
```

Si prefieres instalarlas por separado:

```bash
npm --prefix backend install
npm --prefix frontend install
```

---

## Variables de entorno (opcional en desarrollo)

Copia el archivo de ejemplo en la raíz si necesitas personalizar la configuración:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Variables incluidas en `.env.example`:

| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto del servidor backend |
| `SQLITE_DB_PATH` | `./data/axi.db` | Ruta del archivo SQLite |
| `JWT_SECRET` | `change_me` | Clave para firma de tokens |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido por CORS |
| `VITE_API_URL` | `http://localhost:3000/api/v1` | URL base de la API para el frontend |

Si no creas `.env`, el backend toma valores por defecto (`PORT=3000` y `CORS_ORIGIN=http://localhost:5173`).

Las rutas relativas de `SQLITE_DB_PATH` se resuelven desde `backend/`, así que por defecto la base queda en `backend/data/axi.db`. La carpeta se crea automáticamente.

---

## Base de datos (SQLite)

El backend usa `node:sqlite` (sin dependencias extra) con `foreign_keys = ON`, `journal_mode = WAL` y `busy_timeout = 5000`.

- Las migraciones viven en `backend/src/db/migrations/*.sql` y se aplican **automáticamente al iniciar el backend**.
- Para aplicarlas manualmente:
  ```bash
  npm run migrate
  ```
- Para empezar desde cero, detén el backend y borra `backend/data/axi.db*`.

---

## Levantar el sistema en desarrollo

### Opción 1: En dos terminales (recomendada)

- **Terminal 1 — Backend (puerto `3000`, modo `--watch`):**
  ```bash
  npm run dev:backend
  ```
- **Terminal 2 — Frontend (puerto `5173`, Vite):**
  ```bash
  npm run dev:frontend
  ```

### Opción 2: En un solo comando

```bash
npm run dev
```

*(Ejecuta backend y frontend en paralelo mediante `npx concurrently`).*

---

## URLs de acceso y verificación

- **Aplicación web (Frontend):** http://localhost:5173
  - Vite redirige automáticamente las peticiones a `/api` hacia `http://localhost:3000`.
- **Health check (Backend):** http://localhost:3000/api/v1/health
  - Respuesta esperada (`200 OK`):
    ```json
    {
      "data": { "status": "ok", "service": "axi-backend" },
      "meta": { "version": "v1" }
    }
    ```

> **Estado actual del sistema:** El backend crea el esquema SQLite al iniciar, pero por ahora solo expone `GET /api/v1/health` (sin servir estáticos ni endpoints de módulos todavía). La interfaz del frontend funciona de forma autónoma con datos semilla locales en `frontend/src/shared/data/seedData.js`.

---

## Otros scripts disponibles

- **Compilar frontend a producción (`frontend/dist/`):**
  ```bash
  npm run build:frontend
  ```
- **Previsualizar el build del frontend:**
  ```bash
  npm --prefix frontend run preview
  ```
- **Pruebas del backend:**
  ```bash
  npm test
  ```
- **Iniciar backend sin watch:**
  ```bash
  npm --prefix backend start
  ```

---

## Estructura del repositorio

```text
/
├── AGENTS.md           # Guía técnica, arquitectura de capas y estándar Git
├── package.json        # Scripts globales del monorepo
├── .env.example        # Plantilla de variables de entorno
├── docs/               # Contratos y documentación técnica
├── backend/            # API REST (Express, node:sqlite, PDFKit)
└── frontend/           # SPA modular (React 18, Vite 6, React Router)
```

Consulta `AGENTS.md` para conocer las reglas de arquitectura por módulo y el flujo de trabajo en Git (prohibido trabajar directo en `main`; usar ramas con prefijo y commits estilo Conventional Commits).
