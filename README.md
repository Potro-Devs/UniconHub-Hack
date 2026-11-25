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

### Datos demo

```bash
npm run seed         # carga los datos demo si la base aún no los tiene
npm run seed:reset   # borra la base y la vuelve a crear (detén antes el backend)
# Si tu base se sembró antes de alinear el banco a los grados (reactivos de fracciones en 1.º y 2.º),
# ejecuta seed:reset: el historial es inmutable y no se migra. `npm run seed` lo avisa.
```

El seed es reproducible (semilla fija) y carga:

- **Escuela demo** y la **docente** `docente@axi.demo` / contraseña `AxiDemo2026`.
- **Director demo** `direccion@axi.demo` / contraseña `AxiDemo2026` (botón *Entrar como Directivo*). Su menú tiene **Panel de la escuela** (indicadores generales, campos formativos de la SEP, habilidades, prioridades, errores típicos y resumen por grupo, solo con promedios) y **Docentes** (avance del diagnóstico por docente), ambos con datos reales; **Promover grupos** y **Traslados** siguen siendo vistas de ejemplo (Roadmap). Cada grupo se evalúa solo en las habilidades de su grado (fracciones desde 3.º, multiplicación desde 2.º).
- **6 grupos más del ciclo actual** (1.º A, 2.º A, 3.º B, 4.º A, 5.º A y 6.º A) con otros docentes ficticios (`docente.1a@axi.demo`… misma contraseña) y diagnósticos variados, para que el panel tenga promedios que comparar. En una base ya sembrada, `npm run seed` los agrega sin borrar nada.
- **Grupo 3.º A (ciclo 2026-2027)**, código de acceso `MAPA3A`, con **45 alumnos ficticios**. 40 de ellos vienen de 2.º A y 30 de 1.º A; *Sofía* tiene historial de los 2 grados anteriores.
- **Temario 1.º–6.º** con 27 contenidos clave (solo las habilidades del programa de cada grado) y el avance del temario de 3.º A.
- **108 reactivos** (4 por habilidad y grado, solo en las habilidades del programa de cada grado: fracciones desde 3.º y multiplicación desde 2.º), cada uno con 3 distractores etiquetados por error típico y 3 pistas graduadas. Los niveles se acercan al Programa Sintético del Plan 2022 (p. ej. 4.º multiplica hasta 3 × 2 cifras; 5.º y 6.º usan decimales) y están **por validar con docentes**. Pendiente: problemas con decimales y porcentajes en 5.º y 6.º.
- Diagnósticos en pantalla ya contestados para 4 habilidades. **Fracciones** está asignada **en papel**, pendiente de captura y con la pantalla bloqueada.
- Historial de dominio de 3 ciclos y catálogo de 10 actividades sugeridas.

> Son credenciales solo de demostración. No uses estos datos en un despliegue real.

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

> **Estado actual del sistema:** Auth, grupos, temario, asignaciones y Analytics usan la API (ver `docs/api-contract.md`). El mapa y el perfil individual consultan SQLite con el grupo activo y muestran cortes reales del historial; distinguen dominio autónomo y “Logrado con apoyo”. Carga los datos ficticios de demostración con `npm run seed`. Diagnósticos y modo papel conservan sus integraciones pendientes; completar Analytics no implica completar esos módulos.
>
> La sesión se guarda en `sessionStorage`: se cierra al cerrar la pestaña, pensado para computadoras compartidas en el salón.

---

## Otros scripts disponibles

### Ver el incremento de Analytics en un solo puerto

El **Mapa del grupo** presenta promedios de dominio autónomo, distribución por nivel y evidencia disponible por habilidad. Los indicadores y las gráficas describen el grupo completo; el filtro por habilidad y la opción de mostrar solo alumnos que necesitan apoyo se aplican al detalle y a sus exportaciones.

- **Excel (.xlsx):** resumen del grupo, resultados de la selección y metodología. Los porcentajes son valores numéricos; una celda sin evaluación queda vacía y conserva la etiqueta “Sin evaluar”.
- **PDF:** reporte Carta en blanco y negro, con resumen, filtros, fecha y resultados paginados. “Logrado con apoyo” corresponde a la última sesión y se presenta separado del dominio longitudinal.

Las descargas requieren la sesión del docente o director autorizado, se generan en memoria y no incluyen folios internos. Al descargarlas, contienen nombres de alumnos de la selección: conserva los archivos dentro del contexto escolar autorizado.

```bash
npm run seed
npm run build:frontend
npm --prefix backend start
```

Abre http://localhost:3000, entra como docente y selecciona **Mapa del grupo**. Desde un alumno puedes abrir su perfil con historial de grados anteriores. Express sirve el build y `/api/v1` en el mismo origen; las rutas directas del mapa y del perfil también funcionan al recargar. En Windows puedes usar `npm.cmd` si PowerShell restringe `npm.ps1`.

Este despliegue es local y necesita mantener el servidor activo. Para producción define `NODE_ENV=production`, un `JWT_SECRET` propio de al menos 32 caracteres y una ruta persistente `SQLITE_DB_PATH`; los accesos rápidos se desactivan por defecto. El catálogo y la alineación de los ejemplos están **por validar con docente de primaria**.

### Juegos de práctica del alumno

Después de entrar como alumno, abre **Juegos** o **Explorar juegos** en el inicio. La sección incluye tres juegos manipulables: pintar fracciones, formar grupos iguales y construir números por valor posicional. Cada partida contiene tres retos, materiales adaptados al grado del grupo y pistas graduadas. Se puede ajustar una construcción y volver a comprobarla sin penalización.

Los juegos son práctica libre: **no modifican evaluaciones, dominio ni historial**, y su avance solo permanece mientras la pantalla está abierta. No tienen cronómetros, vidas ni rankings. Funcionan por toque o teclado, sin exigir arrastrar. Las animaciones respetan el control de movimiento y la preferencia del sistema. El material de ejemplo está **por validar con docente de primaria**.

### Acompañamiento docente: qué hago mañana y antes/después

- **Inicio del docente:** la tarjeta **Qué hago mañana** muestra la habilidad prioritaria del grupo, el error típico con más alumnos y la actividad del catálogo para atenderlo (duración, organización y materiales).
- **La apliqué con el grupo:** registra la actividad (nota opcional, sin nombres). En el mapa, **¿Funcionó la actividad?** compara a los mismos alumnos antes y después cuando se aplica una nueva prueba de esa habilidad (mínimo 3 reactivos).
- **Avance hacia la autonomía:** en el mapa y en cada perfil, compara la sesión más reciente con la anterior y muestra quién pasó de necesitar pistas a resolver por su cuenta (umbral de 10 puntos en acierto autónomo).

En los datos demo, Fracciones aún no tiene errores registrados hasta capturar la prueba en papel pendiente; después la tarjeta muestra el error más frecuente.

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
