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
- **Director demo** `direccion@axi.demo` / contraseña `AxiDemo2026` (botón *Entrar como Directivo*). Su menú tiene **Panel de la escuela** (pestañas Resumen, Campos formativos, Habilidades, Grupos y Errores típicos; prioridades del mes y fecha del próximo Consejo Técnico según el calendario SEP; **Exportar PDF** tamaño Carta en blanco y negro; solo promedios) y **Docentes** (avance del diagnóstico por docente), ambos con datos reales; **Promover grupos** y **Traslados** siguen siendo vistas de ejemplo (Roadmap). Cada grupo se evalúa solo en las habilidades de su grado (fracciones desde 3.º, multiplicación desde 2.º).
- **Importar alumnos desde Excel o CSV:** en el detalle del grupo, *Importar desde Excel o CSV* lee un `.xlsx` o `.csv` (apellido paterno, apellido materno, nombre(s); con o sin encabezados), llena la lista automáticamente y la docente la revisa y guarda.
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

> **Estado actual del sistema:** Auth, grupos, temario, asignaciones y Analytics usan la API (ver `docs/api-contract.md`). El mapa y el perfil individual consultan SQLite con el grupo activo y muestran cortes reales del historial; distinguen dominio autónomo y “Logrado con apoyo”. Carga los datos ficticios de demostración con `npm run seed`. **El ejercicio del alumno usa datos reales:** el inicio del alumno lista sus pruebas (`/api/v1/diagnostics`), y al contestar una en pantalla (pistas pedidas al servidor, retroalimentación neutra) se registra el corte de dominio y el mapa del docente cambia. El seed incluye una **práctica abierta de Multiplicación para 3.º A** para recorrer ese ciclo (en una base ya sembrada, `npm run seed` la agrega). El temario y su cobertura se cargan para el grupo activo; sus estados y notas se guardan, y el panel asigna pruebas reales a todo el grupo o a alumnos específicos. En pantalla muestra el código del grupo; en papel abre `/docente/papel/:id` para descargar y capturar hojas. El portal consulta su grupo, progreso y logros reales; la captura actualiza el mismo historial que ve el docente. Solo las vistas del Roadmap de escuela, promoción y traslados conservan datos de ejemplo.
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

### Modo Papel: imprimir, aplicar y capturar

Para grupos sin dispositivos para todos. El flujo completo vive en `/api/v1/paper` (contrato en [docs/api-contract.md](docs/api-contract.md)):

1. **Asignar en papel** (`POST /assessments/groups/:groupId/assignments` con `modality: "paper"`): cada alumno queda con la pantalla bloqueada para esa prueba, así no puede contestarla también en pantalla.
2. **Imprimir** la hoja genérica (`GET /assignments/:id/pdf`) y las tarjetas de pistas (`GET /assignments/:id/hints-pdf`). Las dos son tamaño Carta, en blanco y negro, sin datos del alumno ni respuestas. Las tarjetas traen una pista por nivel, para recortarlas y entregar una a la vez.
3. **Capturar** hoja por hoja (`POST /assignments/:id/capture/:studentId` con `{ answers, supportUsed }` o `{ absent: true }` si faltó). `supportUsed` es la casilla **"Apoyo durante la prueba"** del encabezado de la hoja; si se quiere más detalle, `hintLevels` indica por reactivo la tarjeta más alta que usó (0 a 3). Cada captura guarda las respuestas y el error típico de cada distractor, y actualiza el dominio por habilidad con la misma regla que en pantalla. El resultado aparece en el **Mapa del grupo**.
4. **Avance** (`GET /assignments/:id/capture-status`): cuántas hojas van capturadas y cuántas faltan.

Si la docente marca **"Usó tarjetas de pistas"** en la hoja, todos los aciertos de esa hoja cuentan como **"Logrado con apoyo"**, separados del dominio autónomo, igual que en pantalla. Es una regla conservadora: si el alumno usó una tarjeta en un solo reactivo, la autonomía de esa hoja queda subestimada, nunca inflada. Las tarjetas recortables recuerdan marcar la casilla. La prueba en papel de los datos demo es *Fracciones · prueba 1* de 3.º A (45 alumnos). Desde **Papel** (`/docente/papel`) se consultan las pruebas del grupo activo, se descargan los dos PDF y se captura un alumno a la vez. La captura pide solo la casilla general de apoyo. **Faltó y continuar** deja la hoja pendiente; **Revisar pendientes** permite volver a ella sin perder su borrador de esta pasada. Los avisos de duplicidad y de actualización del avance no reenvían hojas ya guardadas.

### Juegos de práctica del alumno

Después de entrar como alumno, abre **Juegos** o **Explorar juegos** en el inicio. La sección incluye tres juegos manipulables: pintar fracciones, formar grupos iguales y construir números por valor posicional. Cada partida contiene tres retos, materiales adaptados al grado del grupo y pistas graduadas. Se puede ajustar una construcción y volver a comprobarla sin penalización.

Debajo aparecen **3 juegos con patrocinio educativo (demostración)**: *Corrige el cuaderno*, *Reto de cálculo mental* y *Completa la figura*. Muestran "Este juego lo hace posible Marca patrocinadora de ejemplo · Demostración, sin convenio real". Para mostrar marcas y logos en una demo, ver **Marcas de demostración** en Despliegue con Docker.

Los juegos son práctica libre: **no modifican evaluaciones, dominio ni historial**, y su avance solo permanece mientras la pantalla está abierta. No tienen cronómetros, vidas ni rankings. Funcionan por toque o teclado, sin exigir arrastrar. Las animaciones respetan el control de movimiento y la preferencia del sistema. El material de ejemplo está **por validar con docente de primaria**.

### Progreso y logros del alumno

`GET /api/v1/diagnostics/students/:studentId/progress` (solo el propio alumno) devuelve su dominio por habilidad, con porcentaje y etiqueta (p. ej. "63.83 % · Logrado") y tendencia, junto con sus logros redactados para él ("Subiste de nivel", "Mejoraste"). Incluye las habilidades de su grado y las que ya tienen historial de grados anteriores. Los niveles se calculan en el servidor con la misma regla que ve el docente en el perfil. Nunca compara con otros alumnos ni expone el folio interno. **Mi progreso** (`/alumno/resumen`) y **Mis logros** (`/alumno/logros`) consultan esta API al entrar. El progreso principal describe autonomía; el apoyo y la tendencia se muestran aparte, sin calcular niveles en el cliente. **Mis clases** muestra un único grupo y obtiene docente y código desde `/auth/me`, también en el primer acceso.

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

### Aprendemos en equipo e idiomas

Entra como docente y abre **En equipo**. Elige una habilidad para ver los equipos formados automáticamente con los resultados del grupo. Revisa la propuesta y usa **Guardar equipos y preparar material**. Si necesitas modificarla, abre **Ajustar equipos**. Cada compañero guía acompaña hasta dos compañeros; quienes necesitan atención docente quedan en su mesa. Las tarjetas de equipo se descargan como PDF Carta en blanco y negro, con pasos, pistas y espacios para responder, sin nombres. La guía docente privada puede incluir los nombres de quienes reciben atención docente; consérvala dentro de la escuela.

Después de la práctica, registra cuántos de tres reactivos resolvió cada alumno sin ayuda. Esta demostración orienta futuros equipos y **no cambia el dominio ni el historial oficial**. Los materiales están **por validar con docente de primaria**.

El selector **Español / Náhuatl / Maya** está disponible desde el acceso y en los espacios de alumno, docente y dirección. Guarda únicamente la preferencia de idioma en este dispositivo. La cobertura es parcial: traduce algunos controles y elementos de navegación, conserva el español como apoyo y usa español cuando falta una traducción. No traduce reactivos, opciones ni pistas. Las traducciones preliminares de náhuatl central y maya yucateco están por validar con hablantes de la comunidad.

## Despliegue con Docker

Un solo contenedor sirve la API (`/api/v1`) y el frontend compilado en el mismo origen. La base SQLite vive en el volumen `axi-data`, así que los datos sobreviven a reinicios y actualizaciones de la imagen.

```bash
# Linux/macOS (o Git Bash en Windows)
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build -d
```

Abre http://localhost:3000. El servidor **no arranca** sin un `JWT_SECRET` de al menos 32 caracteres que no sea un valor de ejemplo.

| Variable | Valor en `docker-compose.yml` | Para qué sirve |
| --- | --- | --- |
| `JWT_SECRET` | obligatoria | Firma las sesiones. Guárdala: si cambia, todas las sesiones se cierran. |
| `SEED_DEMO` | `true` | Carga los datos ficticios de demo al arrancar. No borra lo que ya existe. |
| `ENABLE_QUICK_LOGIN` | `true` | Muestra los botones "Entrar como Docente / Directivo / Alumno". |
| `PORT` | `3000` | Puerto publicado en el equipo. |
| `CORS_ORIGIN` | `http://localhost:3000` | Origen permitido si la API se usa desde otro dominio. |

- **Con una escuela real:** usa `SEED_DEMO=false` y `ENABLE_QUICK_LOGIN=false`. Los datos demo son ficticios y los accesos rápidos no piden contraseña.
- **Empezar de cero:** `docker compose down -v` borra el volumen, **con todos sus datos**.
- **Marcas de demostración (opcional, solo demo):** los nombres y logos de los juegos patrocinados se leen de la carpeta `./demo-sponsors` **del servidor**. Esa carpeta no se sube al repositorio ni entra en la imagen: `docker-compose.yml` la monta como volumen de solo lectura en `/demo-sponsors`.
  1. En el servidor, junto a `docker-compose.yml`: `mkdir demo-sponsors`.
  2. Copia ahí los logos (`.png`, `.jpg`, `.webp` o `.svg`, nombres simples como `cuadernos.png`) y un `patrocinadores.json` con la forma de [docs/demo-sponsors.example.json](docs/demo-sponsors.example.json): por juego (`grammar_fix`, `mental_math`, `symmetry`), el `name` y el archivo `logo`.
  3. `docker compose up -d` (o `docker compose restart`). Los cambios se leen al arrancar; el registro del contenedor avisa si un logo no existe o si el archivo tiene errores.
  - La leyenda "Demostración · sin convenio real" se muestra siempre. Sin carpeta, o con la carpeta vacía, se ve "Marca patrocinadora de ejemplo".
  - Solo se publican los logos listados en `patrocinadores.json`, en `/api/v1/demo-sponsors/<archivo>`.
  - Usa solo logos que el equipo tenga permiso de mostrar.
  - En desarrollo: `DEMO_SPONSORS_DIR=../demo-sponsors` en `.env`. La ruta relativa se toma desde `backend/`.
- **Respaldo:** detén el contenedor antes de copiar (SQLite usa modo WAL y una copia en caliente puede quedar incompleta): `docker compose stop && docker compose cp axi:/data/axi.db ./respaldo-axi.db && docker compose start`.

### Pitch animado para grabación

Con el frontend iniciado, abre **http://localhost:5173/pitch**. Es una presentación React pública de **2 minutos y 48 segundos** y once escenas, del equipo **PotroDevs** (Raúl Treviño Licona, Lizbeth Ocampo Blanco y Osvaldo Estrada Lara). Funciona sin iniciar sesión. La portada anima a Axi como logo del sistema y presenta al equipo. Seis escenas son **recorridos guiados por capturas reales del prototipo** (docente, alumno, modo papel, Aprendemos en equipo, lenguas y dirección): cada una parte de un problema real, una cámara recorre y amplía la captura, un foco con cursor señala cada parte y a la izquierda se explica cómo Axi lo resuelve. Las capturas usan datos ficticios del seed demo y están en `frontend/src/features/pitch/assets/screens/`; las zonas señaladas se definen en `pitch.tours.js`. Todas las animaciones se calculan con el reloj de la presentación, así que pausar o saltar entre escenas las deja en el punto correcto. El botón **Sonido** (tecla M) activa una banda sonora original: música que pasa de tono menor en el problema a mayor en la solución y a un cierre triunfal, y efectos sincronizados con las transiciones, el cursor, el confeti y la frase final. Todo se sintetiza en el navegador con Web Audio, sin archivos ni música de terceros, y está apagado por defecto.

Reproduce o pausa la presentación, salta entre escenas y ajusta la posición desde la barra de avance. Usa pantalla completa y modo limpio para grabar el escenario; las notas del presentador contienen el discurso de cada escena. La animación está pensada para narración humana y grabación de pantalla; no genera un archivo de video por sí sola. Respeta la preferencia de movimiento reducido y pausa al ocultar la pestaña.

El [guion con tiempos](docs/pitch-guion.md) contiene 331 palabras. Las estadísticas se atribuyen a PISA 2022 y describen estudiantes de 15 años. El progreso mostrado es ilustrativo; la validación con docentes y las pruebas en escuelas se presentan como siguientes pasos.

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
