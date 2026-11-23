# AGENTS.md — Guía de Desarrollo Agéntico para Axi

Este documento es la fuente de verdad técnica para el desarrollo asistido por agentes y el trabajo colaborativo del repositorio. Todo agente o colaborador debe seguir estrictamente estas convenciones de arquitectura, dominio pedagógico, diseño responsivo y flujo de Git.

---

## 1. Visión del Sistema y Pilares Pedagógicos

**Axi** es una plataforma web responsiva (Desktop y Mobile-First) de diagnóstico educativo longitudinal para escuelas primarias en México (1.º a 6.º grado). Su propósito es identificar qué sabe cada estudiante, detectar **por qué se equivoca** (error típico conceptual) y preservar su **historial longitudinal portable** al cambiar de grado o docente.

> **Nota de marca:** `"Axi"` es el nombre provisional de la plataforma y de la mascota guía. Toda referencia visual o textual al nombre/marca en el frontend debe centralizarse en `frontend/src/config/brand.js` para permitir su sustitución inmediata sin refactorizar componentes.

### Pilares Obligatorios
1. **Diagnóstico del error típico:** Cada opción incorrecta representa un distractor pedagógico etiquetado (`error_tag` y explicación conceptual) para orientar la intervención docente.
2. **Historial longitudinal portable y privado:** El seguimiento entre grados se une mediante un folio interno único (`internal_folio`). **Nunca se solicita ni almacena CURP.** Los nombres reales solo son visibles en contextos autenticados de la escuela.
3. **Operación híbrida real (Pantalla + Modo Papel):** Evaluaciones digitales en pantalla y hojas genéricas impresas en **PDF tamaño Carta, blanco y negro**, con captura móvil alumno por alumno sin scroll horizontal.
4. **Alineación curricular SEP:** Jerarquía `Fase -> Grado (1.º a 6.º) -> Campo Formativo -> Contenido -> PDA -> Habilidad -> Reactivos`.
5. **Motivación centrada en el progreso propio:** Pistas graduadas en 3 niveles y celebraciones breves no punitivas. Prohibidos rankings entre alumnos, vidas, castigos o temporizadores.

---

## 2. Stack Tecnológico y Configuración Base

- **Frontend:** React + Vite + React Router (`frontend/`)
- **Backend:** Node.js + Express (API REST bajo `/api/v1`) (`backend/`)
- **Base de datos:** SQLite (`backend/`)
  - Configuración obligatoria de conexión:
    - `PRAGMA foreign_keys = ON;`
    - `PRAGMA journal_mode = WAL;`
    - `PRAGMA busy_timeout = 5000;`
- **Generación de PDF en servidor:** PDFKit (`application/pdf`, tamaño Carta, blanco y negro, alto contraste).
- **Despliegue previsto:** Local/Red local en desarrollo (un mismo origen/puerto en producción compilando `frontend/dist` servido desde Node.js) y contenedores con volumen persistente (`SQLITE_DB_PATH`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`).

---

## 3. Alcance MVP vs. Roadmap

### Dentro del MVP
- **Cobertura curricular:** Grados **1.º a 6.º** con temario base y **5 habilidades clave transversales**:
  1. `fractions` — Fracciones
  2. `multiplication` — Multiplicaciones
  3. `place_value` — Valor posicional
  4. `problem_solving` — Resolución de problemas
  5. `reading_comprehension` — Comprensión lectora
- **Acceso y autenticación:**
  - Login docente con correo electrónico + contraseña.
  - **Dos botones de acceso rápido debajo del login** para pruebas/demo: *Entrar como Docente* y *Entrar como Alumno*.
  - Acceso estándar del alumno mediante código de grupo (6 caracteres) y selección de tarjeta/avatar.
- **Gestión escolar básica:** Alta/edición de grupos, alta individual o masiva (lista pegada) de alumnos, generación automática de `internal_folio` y avatar por defecto.
- **Temario y asignación:** Marcado de avance (`pending`, `in_progress`, `seen`) y asignación de pruebas (todo el grupo o alumnos específicos) en modalidad `screen` o `paper`.
- **Motor de evaluación (Alumno):** Un reactivo a la vez, opciones táctiles grandes, hasta 3 pistas por reactivo, retroalimentación neutra y diferenciación entre acierto autónomo y **"Logrado con apoyo"**.
- **Modo Papel:** PDF genérico B/N tamaño Carta (sin datos prellenados del alumno), PDF de tarjetas de pistas, captura rápida móvil alumno × reactivo sin scroll horizontal y bloqueo automático de pantalla al asignar/capturar en papel.
- **Analítica docente:** Mapa del grupo (`alumno × habilidad`), habilidad más débil, conteo de alumnos en apoyo, cobertura de temario, actividad sugerida y perfil individual con historial multigrado.
- **Datos Seed:** Docente demo, escuela demo, grupo de **45 alumnos ficticios** con distribución realista, al menos un alumno con historial de **2 grados anteriores**, reactivos calibrados para 1.º a 6.º en las 5 habilidades y catálogo de actividades.

### Puntos de Extensión (Roadmap futuro — no sobre-ingenierizar en MVP)
- Rol Administrativo/Director (alta de docentes, promoción masiva de ciclos, traslados entre escuelas por código o QR).
- Eje 2: IA para pistas dinámicas y resúmenes explicativos basados solo en métricas calculadas (**prohibido enviar nombres reales o `internal_folio` a APIs de IA externas**).
- Eje 3: Módulo de comprensión lectora profunda.
- Lectura OMR por cámara, colección extendida de insignias y personalización completa de mascota.

---

## 4. Reglas de Negocio Obligatorias (Capa de Dominio)

Todas las reglas matemáticas y pedagógicas deben vivir como **funciones puras sin I/O** dentro de `*.domain.js` en el backend:

1. **Mínimo de reactivos por habilidad:**
   - Constante `MIN_QUESTIONS_PER_SKILL = 3`.
   - Bloquear la creación o asignación de cualquier prueba si alguna habilidad incluida tiene 1 o 2 reactivos.
2. **Clasificación de respuestas (`outcome_status`):**
   - `correct_autonomous`: opción correcta con `max_hint_level_used === 0`.
   - `achieved_with_support` (**"Logrado con apoyo"**): opción correcta con `max_hint_level_used >= 1`. Se registra, calcula y muestra **aparte** del dominio autónomo.
   - `incorrect`: distractor seleccionado, registrando el `error_tag` asociado.
   - `unanswered`: reactivo dejado sin respuesta (ej. captura en papel).
3. **Escala de niveles de dominio (intervalos estrictos de 25%):**
   - `0.00% – 24.99%` → `needs_support` (**Necesita apoyo**)
   - `25.00% – 49.99%` → `in_progress` (**En proceso**)
   - `50.00% – 74.99%` → `achieved` (**Logrado**)
   - `75.00% – 100.00%` → `mastered` (**Dominado**)
4. **Lenguaje y accesibilidad visual:**
   - El color **nunca** es el único indicador del nivel: siempre mostrar `% + Etiqueta`.
   - Prohibido usar términos punitivos o estigmatizantes (`"reprobado"`, `"malo"`, `"deficiente"`, `"bajo"`).
5. **Promedio ponderado evolutivo:**
   - Para sesiones cronológicas $1 \dots n$ de una misma habilidad con porcentaje $P_i$ y peso lineal $w_i = i$:
     $$\text{Dominio Actual} = \frac{\sum_{i=1}^{n} w_i \cdot P_i}{\sum_{i=1}^{n} w_i}$$
   - Cada corte deja registro inmutable en `skill_mastery_history`.
6. **Sistema de pistas (3 niveles):**
   - Nivel 1: orienta qué observar o preguntar. Nivel 2: acerca un paso operativo/conceptual. Nivel 3: muestra un ejemplo parecido con otros datos.
   - **Restricción estricta:** ninguna pista puede revelar la respuesta correcta.
7. **Logros y restricciones de UX en animaciones:**
   - Disparadores: fin de bloque (`small`), subir de nivel (`medium`), mejora respecto a evaluación previa o alcanzar `mastered` (`large`), y mensaje constructivo cuando no hay subida.
   - Animaciones: duración máxima **3 segundos**, botón visible para **saltar animación**, **sonido apagado por defecto** y respeto obligatorio de `prefers-reduced-motion`.
8. **Identificación y desambiguación de alumnos:**
   - Al crear un alumno, asignar un color aleatorio de paleta accesible + 2 letras en mayúsculas (inicial del primer nombre + inicial del primer apellido) junto al nombre completo.
9. **Bloqueo anti-duplicidad Pantalla vs. Papel:**
   - Si una prueba se asigna en modalidad `paper` o si ya fue capturada en papel para el alumno, debe activarse `is_screen_locked = 1` (`status = 'completed_paper'`) e impedir que se abra o conteste en el portal del alumno (`409 Conflict`).

---

## 5. Arquitectura Modular y Estructura de Carpetas

El repositorio es un monorepo modular diseñado para trabajo paralelo sin conflictos entre módulos verticales.

```text
/
├── AGENTS.md
├── README.md
├── package.json
├── .env.example
├── docs/
│   └── api-contract.md
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/               # env.js, database.js
│   │   ├── shared/               # errors/, middleware/, utils/
│   │   ├── db/                   # migrations/, seed.js
│   │   └── modules/              # auth, groups, curriculum, assessments, diagnostics, paper-mode, analytics
│   └── tests/
└── frontend/
    ├── package.json
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── config/brand.js       # Nombre de marca, paleta accesible y textos base
        ├── shared/               # api/, components/, data/, hooks/, state/, styles/
        └── features/             # mascot, auth, teacher-dashboard, groups, curriculum,
                                  # assessments, paper-mode, group-map, student-profile,
                                  # student-portal, school-admin
```

### Reglas de Capas (Backend)
Cada módulo en `backend/src/modules/<modulo>/` respeta dependencias unidireccionales:
`routes -> controller -> service -> domain / repository`
- **`<modulo>.routes.js` / `<modulo>.controller.js`:** Capa de presentación HTTP; nunca contiene SQL ni lógica de dominio.
- **`<modulo>.service.js`:** Orquestación de casos de uso y transacciones.
- **`<modulo>.domain.js`:** Funciones puras de negocio, validaciones y fórmulas (sin I/O).
- **`<modulo>.repository.js`:** Única capa autorizada para ejecutar SQL parametrizado contra SQLite.

### Regla de Desacoplamiento de la Mascota (Frontend)
- La mascota vive aislada en `frontend/src/features/mascot/` (`assets/`, `mascot.config.js`, `Mascot.jsx`, `index.js`).
- **Ninguna vista o feature puede importar imágenes de la mascota directamente ni incrustar SVG propios de la mascota.** Todas deben importar `<Mascot />` desde `@/features/mascot` usando props estandarizadas (`state`/`mood`, `color`, `size`, `animated`) con fallback seguro si faltan variantes gráficas.

### Principios Mobile-First y Responsivos
- Diseño base para pantallas estrechas (`360px–480px`), expandiendo con breakpoints estándar (`640px`, `768px`, `1024px`).
- **Cero scroll horizontal** en celular en vistas clave (Mapa del grupo en tarjetas en móvil, Captura rápida alumno por alumno vertical).
- Zonas táctiles mínimas de **44×44 px** (ideal 48–56 px en móvil).

---

## 6. Modelo de Datos y Contratos API (`/api/v1`)

- **Tablas SQLite principales:** `schools`, `users`, `groups`, `students`, `group_enrollments`, `skills`, `curriculum_contents`, `group_curriculum_progress`, `questions`, `question_options`, `assignments`, `assignment_questions`, `assignment_targets`, `student_responses`, `skill_mastery_history`, `student_achievements`, `recommended_activities`.
- **Prefijos REST bajo `/api/v1`:**
  - `/auth` (login, quick-login docente/alumno, student-join)
  - `/groups` (CRUD grupos, alumnos individual/bulk, avatar)
  - `/curriculum` (temario por grupo, estado/notas, cobertura)
  - `/assessments` (banco de reactivos, asignaciones validando `>= 3` por habilidad)
  - `/paper` (PDF prueba B/N Carta, PDF pistas, capture-status, captura alumno por alumno)
  - `/diagnostics` (pruebas disponibles alumno, start con check `409`, answer, complete)
  - `/analytics` (mapa del grupo `alumno × habilidad`, perfil longitudinal del alumno)
- **Formato estándar de respuesta:** `{ "data": ..., "meta": ... }` o `{ "error": { "code": "...", "message": "..." } }`.

---

## 7. Estándar de Desarrollo en Git (Obligatorio)

Todo desarrollo en este repositorio debe apegarse estrictamente a las siguientes reglas de Git:

### 7.1 Ramas con Prefijo
- **Queda prohibido trabajar o hacer commits directamente sobre `main`.**
- Para cualquier tarea, mejora o corrección, crea siempre una rama nueva desde `main` utilizando un prefijo descriptivo seguido de kebab-case:
  - `feat/<descripcion-corta>` — Nueva funcionalidad o módulo (ej. `feat/paper-mode-pdf`, `feat/student-hints`)
  - `fix/<descripcion-corta>` — Corrección de errores (ej. `fix/weighted-average`, `fix/screen-lock-check`)
  - `chore/<descripcion-corta>` — Configuración, dependencias, tooling o mantenimiento (ej. `chore/project-setup`)
  - `docs/<descripcion-corta>` — Documentación y contratos (ej. `docs/api-contract`)
  - `refactor/<descripcion-corta>` — Refactorización sin cambio funcional (ej. `refactor/analytics-domain`)
  - `test/<descripcion-corta>` — Pruebas unitarias o de integración (ej. `test/diagnostics-rules`)
  - `style/<descripcion-corta>` — Estilos, diseño responsivo y formato (ej. `style/mobile-capture-grid`)

### 7.2 Commits Claros y Concisos
- Todos los commits deben usar prefijos estilo Conventional Commits coherentes con el tipo de cambio (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`).
- **Mensajes cortos, claros y concisos** (máximo ~72 caracteres en el asunto, modo imperativo, sin descripciones largas ni redundantes):
  - Correcto: `feat: add weighted mastery domain rules`
  - Correcto: `fix: lock screen test after paper capture`
  - Incorrecto: `feat: Se agregaron muchas cosas del backend y también arreglé unos detalles en varias pantallas del frontend`
- Mantén commits atómicos por módulo vertical para evitar conflictos en archivos compartidos (`App.jsx`, `app.js`, `shared/`).

---

# Agentes del proyecto

Subagentes de Claude Code definidos en `.claude/agents/`:

- **`arquitectura`** — Decide estructura, puntos de extensión y despliegue respetando la pila actual (sin migrar a otra); no implementa.
- **`backend`** — Implementa modelo de datos, reglas de diagnóstico, autenticación, seguridad y seed.
- **`ui-ux`** — Diseña flujos, accesibilidad y tono para docente y alumno; no escribe código.
- **`frontend`** — Construye las pantallas responsivas y accesibles con estilos en tokens.
- **`auditor`** — Revisa calidad, seguridad, privacidad, README y apego a este documento; no modifica archivos.
- **`experto-educacion`** — Evalúa el MVP con una rúbrica pedagógica para el contexto de primarias en México; no modifica archivos.

## Flujo de trabajo

1. **`arquitectura`** define la base técnica y **`backend`** la implementa.
2. **`ui-ux`** diseña los flujos y **`frontend`** los construye.
3. **`auditor`** revisa antes de cada integración a `main`.
4. **`experto-educacion`** evalúa el MVP antes de grabar el video y antes de entregar.

## Reglas de uso de subagentes

- Antes de cualquier decisión técnica grande, consulta al agente `arquitectura`.
- Tras terminar una funcionalidad o antes de un commit importante, pasa por el agente `auditor`.
- Para pantallas, diseña con `ui-ux` y construye con `frontend`; para datos y lógica, usa `backend`.
- Antes de grabar el video y antes de entregar, evalúa con `experto-educacion`.
