# Contrato de API REST (`/api/v1`)

> Estado: **Health**, **Auth**, **Groups**, **Curriculum** y **Assessments** implementados. El resto de los módulos está planificado.

Todas las respuestas siguen el formato estándar:
- Éxito: `{ "data": ..., "meta": ... }`
- Error: `{ "error": { "code": "...", "message": "...", "details"?: ... } }`

### Errores comunes

| Estado | `code` | Cuándo |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` | Cuerpo incompleto, con formato inválido o JSON mal formado |
| 401 | `AUTH_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `SESSION_INVALID` | Falta el token, es inválido o expiró, o el usuario ya no existe |
| 403 | `FORBIDDEN` | El rol de la sesión no puede usar el endpoint |
| 404 | `NOT_FOUND`, `GROUP_NOT_FOUND`, `STUDENT_NOT_FOUND`, `CONTENT_NOT_FOUND`, `ASSIGNMENT_NOT_FOUND` | La ruta no existe, o el recurso no existe o no es accesible para la sesión |
| 409 | `SCREEN_LOCKED`, `ALREADY_COMPLETED`, `GROUP_ALREADY_EXISTS`, `GROUP_HAS_HISTORY` | Prueba bloqueada en pantalla (papel) o ya terminada; grupo duplicado; cambio de grado/ciclo en un grupo con historial |
| 422 | Otros códigos de `DomainError` | Regla de negocio incumplida (p. ej. `INSUFFICIENT_QUESTIONS_PER_SKILL`) |
| 429 | `TOO_MANY_ATTEMPTS` | Demasiados intentos de login o de acceso de alumno (`details.retryAfterSeconds`) |
| 500 | `INTERNAL_ERROR` | Error inesperado (sin detalles internos) |

### Autenticación

Los endpoints protegidos esperan `Authorization: Bearer <token>`. El token (JWT HS256) solo lleva `sub`, `role` (`teacher`, `director` o `student`), `schoolId` y, para alumnos, `groupId`. **Nunca incluye nombres ni `internal_folio`.** Duración por defecto: 8 h para docentes y 2 h para alumnos.

## Auth (`/api/v1/auth`)

| Método y ruta | Cuerpo | Respuesta `data` | Errores |
| --- | --- | --- | --- |
| `POST /login` | `{ email, password }` | `{ token, expiresAt, user: { id, fullName, email, role, schoolId } }` | 400, 401 `INVALID_CREDENTIALS`, 429 |
| `GET /quick-login` | — | `{ enabled }`: el frontend decide si mostrar los botones de demo | — |
| `POST /quick-login/teacher` | — | Igual que `/login` (docente demo) | 403 `QUICK_LOGIN_DISABLED`, 404 `DEMO_DATA_MISSING` |
| `POST /quick-login/student` | — | `{ token, expiresAt, student, group }` (primer alumno activo del grupo demo) | 403, 404 |
| `POST /student-join` | `{ joinCode }` | `{ group, students: [StudentCard] }` | 400, 404 `GROUP_NOT_FOUND`, 429 |
| `POST /student-join/select` | `{ joinCode, studentId }` | `{ token, expiresAt, student, group }` | 400, 404 `GROUP_NOT_FOUND` / `STUDENT_NOT_IN_GROUP`, 429 |
| `GET /me` *(sesión)* | — | Docente: `{ role, user }` · Alumno: `{ role: 'student', student, group }` | 401 |

- `StudentCard`: `{ id, displayName: "Sofía R.", initials, avatarColor, avatarId }`. Solo el primer nombre y la inicial del apellido, sin el folio interno.
- `group`: `{ id, name: "3.º A", grade, section, schoolYear }`.
- `joinCode` acepta minúsculas y espacios (`" mapa 3a "` → `MAPA3A`).
- Con correo inexistente o contraseña incorrecta, la respuesta es idéntica (mismo código, mensaje y tiempo de respuesta).
- Los accesos rápidos están activos fuera de producción. En producción solo se activan con `ENABLE_QUICK_LOGIN=true`.

## Groups (`/api/v1/groups`)

Todos los endpoints exigen sesión.

| Método y ruta | Roles | Cuerpo | Respuesta `data` | Errores |
| --- | --- | --- | --- | --- |
| `GET /` | teacher, director | — | `[Group]` · `meta: { count }` | 401, 403 |
| `POST /` | teacher | `{ grade, section, schoolYear }` | `Group` (201) | 400, 401, 403, 409 `GROUP_ALREADY_EXISTS` |
| `GET /:groupId` | teacher, director | — | `Group` | 400, 401, 403, 404 `GROUP_NOT_FOUND` |
| `PATCH /:groupId` | teacher | `{ grade?, section?, schoolYear? }` (al menos uno) | `Group` | 400, 401, 403, 404, 409 `GROUP_ALREADY_EXISTS` / `GROUP_HAS_HISTORY` |
| `GET /:groupId/students` | teacher, director | — | `[Student]` (solo inscritos activos) · `meta: { count }` | 400, 401, 403, 404 |
| `POST /:groupId/students` | teacher | `{ firstNames, lastNames }` | `Student` (201) | 400, 401, 403, 404 |
| `POST /:groupId/students/bulk` | teacher | `{ text }` (un alumno por línea) | `{ created: [Student] }` (201) · `meta: { createdCount }` | 400 (`details.invalidLines` si hay líneas inválidas), 401, 403, 404 |
| `PATCH /students/:studentId/avatar` | teacher, student | `{ avatarId?, avatarColor? }` (al menos uno) | `Student` | 400, 401, 403, 404 `STUDENT_NOT_FOUND` |

- `Group`: `{ id, name: "3.º A", grade, section, schoolYear, phase, joinCode, teacherId, studentCount }`. `phase` se calcula del grado (3: 1.º–2.º, 4: 3.º–4.º, 5: 5.º–6.º); `studentCount` cuenta inscripciones activas.
- `Student`: `{ id, firstNames, lastNames, initials, avatarColor, avatarId }`. Nombre completo porque es un contexto autenticado de la escuela. **Nunca incluye `internal_folio`.**
- **Autorización:**
  - `teacher`: solo grupos con `teacher_id` = su id (y de su escuela), y alumnos con inscripción `active` en ellos.
  - `director`: **solo lectura** de los grupos y alumnos de su escuela; cualquier escritura → 403.
  - `student`: solo `PATCH /students/:studentId/avatar` con su propio id y estando activo en el grupo de su token; el resto → 403.
  - Un grupo o alumno inexistente **o ajeno** responde 404 con el mismo cuerpo (no se revela qué ids existen).
- **Validación** (`400 VALIDATION_ERROR`):
  - Ids de ruta: enteros positivos.
  - `grade`: entero 1–6 (acepta `"3"`). `section`: 1 o 2 letras A–Z, se guarda en mayúsculas. `schoolYear`: `AAAA-AAAA` con años consecutivos (2000–2100).
  - `firstNames` / `lastNames`: se normalizan (`"  ana PAULA "` → `"Ana Paula"`, partículas `de la` en minúscula); deben empezar con letra, solo letras (con acentos), espacio, guion, apóstrofo o punto; máximo 80 caracteres cada uno.
  - `avatarId`: `rosa`, `azul`, `amarillo`, `lila` (variantes de la mascota del frontend) o `null` para quitarlo. `avatarColor`: un color de la paleta accesible `AVATAR_PALETTE` (no distingue mayúsculas).
- **Alta de alumnos:** genera iniciales (primer nombre + primer apellido), color aleatorio de la paleta y `internal_folio` único (reintenta si choca), e inscribe al alumno como `active`.
- **Carga masiva:**
  - Acepta viñetas, numeración, líneas vacías y el formato `Apellidos, Nombres`. Sin coma, los dos últimos términos son apellidos.
  - Máximo **60 líneas no vacías** por carga (`details: { maxLines, lineCount }`).
  - **Todo o nada:** si **alguna** línea es inválida, se rechaza el lote completo con 400 `VALIDATION_ERROR` y `details.invalidLines: [{ line, text }]`, sin guardar ningún alumno. La docente corrige la lista y la vuelve a pegar.
  - Si todas son válidas, se crean en **una sola transacción**: si falla un alta, no se guarda ninguna.
- **Grupo duplicado:** misma escuela, grado, sección y ciclo → 409 `GROUP_ALREADY_EXISTS` ("Ese grupo ya está registrado en tu escuela.").
- **Grupo con historial:** si el grupo tiene inscripciones (de cualquier estado: `active`, `completed`, `withdrawn`) o asignaciones, `PATCH` no puede cambiar `grade` ni `schoolYear` → 409 `GROUP_HAS_HISTORY`, para no reescribir el historial longitudinal. Cambiar solo `section` sí se permite (respetando el 409 por duplicado). Enviar el mismo grado o ciclo que ya tiene no cuenta como cambio.
- **Crear grupo:** si el usuario de la sesión ya no existe, dejó de ser `teacher` o cambió de escuela → 401 `SESSION_INVALID`.
- El `joinCode` (6 caracteres, sin 0/O/1/I/L) se genera al crear y no cambia al editar.

## Curriculum (`/api/v1/curriculum`)

Todos los endpoints exigen sesión. El temario de ejemplo del seed está **por validar con docente** (`meta.contentReview`).

| Método y ruta | Roles | Cuerpo | Respuesta `data` | Errores |
| --- | --- | --- | --- | --- |
| `GET /groups/:groupId` | teacher, director | — | `[CurriculumContent]` del grado del grupo, por `sortOrder` · `meta: { count, group: { id, grade, phase }, coverage: Coverage, contentReview }` | 400, 401, 403, 404 `GROUP_NOT_FOUND` |
| `GET /groups/:groupId/coverage` | teacher, director | — | `Coverage` · `meta: { group: { id, grade, phase } }` | 400, 401, 403, 404 `GROUP_NOT_FOUND` |
| `PATCH /groups/:groupId/contents/:contentId` | teacher | `{ status?, notes? }` (al menos uno) | `CurriculumContent` actualizado | 400, 401, 403, 404 `GROUP_NOT_FOUND` / `CONTENT_NOT_FOUND` |

- `CurriculumContent`: `{ id, title, pda, formativeField, formativeFieldName, phase, grade, sortOrder, skill: { code, name } | null, status, notes, updatedAt }`. `formativeField` es el código del esquema (`lenguajes`, `saberes_pensamiento_cientifico`, `etica_naturaleza_sociedades`, `de_lo_humano_comunitario`) y `formativeFieldName` su nombre en el Plan de Estudio 2022. Sin registro de avance: `status: "pending"`, `notes: null`, `updatedAt: null`.
- `Coverage`: `{ total, pending, in_progress, seen, coveragePercentage, bySkill: [{ code, name, total, pending, in_progress, seen, coveragePercentage }] }`. `coveragePercentage` = `seen / total × 100` (2 decimales). `bySkill` solo incluye contenidos con habilidad; los demás cuentan en el total general.
- **Autorización:** igual que Groups. `teacher`: solo sus grupos (lectura y escritura). `director`: solo lectura de su escuela; `PATCH` → 403. `student`: 403 en todo. Grupo ajeno o inexistente → 404 `GROUP_NOT_FOUND`.
- **Validación** (`400 VALIDATION_ERROR`):
  - Ids de ruta: enteros positivos.
  - `status`: `pending`, `in_progress` o `seen`.
  - `notes`: texto de hasta **500 caracteres** (se recortan espacios; vacío se guarda como `null`) o `null` para borrar. Otro tipo (`[]`, `{}`, número) → 400.
  - Cuerpo vacío, sin `status` ni `notes`, o que no es objeto → 400.
- **Contenido:** debe ser del **mismo grado** que el grupo; si es de otro grado o no existe → 404 `CONTENT_NOT_FOUND`.
- **Guardado:** upsert en `group_curriculum_progress` (un registro por grupo y contenido). Un campo ausente conserva su valor; `updated_at` se actualiza en cada `PATCH`.
- Otros campos del cuerpo del PATCH se ignoran.
- `notes` es texto libre de la docente: no debe incluir nombres de alumnos y nunca se envía a servicios de IA externos.

## Assessments (`/api/v1/assessments`)

Todos los endpoints exigen sesión de personal escolar. **Alumno → 403 en todo**: estas respuestas incluyen la opción correcta y los errores típicos; el portal del alumno usa `diagnostics`.

| Método y ruta | Roles | Cuerpo / query | Respuesta `data` | Errores |
| --- | --- | --- | --- | --- |
| `GET /questions` | teacher, director | `?grade=1..6&skill=<código>` (ambos opcionales) | `[Question]` · `meta: { count }` | 400, 401, 403 |
| `GET /groups/:groupId/assignments` | teacher, director | — | `[AssignmentSummary]` (más recientes primero) · `meta: { count }` | 400, 401, 403, 404 `GROUP_NOT_FOUND` |
| `POST /groups/:groupId/assignments` | teacher | `{ title, modality, questionIds \| skills, studentIds? }` | `AssignmentDetail` (201) | 400, 401, 403, 404, 422 `INSUFFICIENT_QUESTIONS_PER_SKILL` / `EMPTY_ASSESSMENT` / `NO_ACTIVE_STUDENTS` |
| `GET /assignments/:assignmentId` | teacher, director | — | `AssignmentDetail` | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND` |

- `Question`: `{ id, grade, skill: { code, name }, contentId, stem, difficulty, hints: [h1, h2, h3], options: [{ label, text, isCorrect, errorTag, errorExplanation }] }`. La opción correcta tiene `errorTag` y `errorExplanation` en `null`. Orden: grado, habilidad, id.
- Códigos de habilidad: `fractions`, `multiplication`, `place_value`, `problem_solving`, `reading_comprehension`.
- `AssignmentSummary`: `{ id, groupId, title, modality, status, createdAt, questionCount, skills: [{ code, name, questionCount }], targetCounts: { total, pending, in_progress, completed_screen, completed_paper } }`. `skills` va en el orden en que aparece cada habilidad en la prueba. `createdAt` es el texto UTC de SQLite (`AAAA-MM-DD HH:MM:SS`).
- `AssignmentDetail`: `AssignmentSummary` + `questions: [{ position, ...Question }]` (en orden `position` 1..n) + `targets: [{ studentId, status, isScreenLocked }]` (sin nombres ni `internal_folio`; el frontend cruza `studentId` con `GET /groups/:groupId/students`).
- **Autorización:** igual que `groups`. Docente: solo sus grupos y las asignaciones de esos grupos. Director: solo lectura de su escuela; `POST` → 403. Grupo o asignación inexistente **o ajeno** → 404 con el mismo cuerpo. En `POST`, el 404 del grupo se responde antes de validar el cuerpo.
- **Crear asignación** (`POST`):
  - `title`: texto de 1 a 120 caracteres (se recortan y compactan espacios).
  - `modality`: `screen` o `paper`.
  - **Exactamente una** forma de elegir reactivos; ambas o ninguna → 400:
    - `questionIds`: arreglo de 1 a 40 enteros positivos (números, no texto), sin repetidos. Se respeta el orden enviado. Todos deben existir y ser del grado del grupo; si no → 400 con `details: { unknownQuestionIds, wrongGradeQuestionIds }`.
    - `skills`: arreglo de códigos sin repetidos. Toma **todos** los reactivos del grado del grupo de esas habilidades, en el orden de `skills` enviado y, dentro de cada una, por id ascendente.
  - `studentIds` (opcional): arreglo de 1 a 100 enteros positivos sin repetidos. Si falta, se asigna a **todos los alumnos activos** del grupo. Si alguno no está activo en el grupo (no existe, dado de baja o de otro grupo) → 400 `VALIDATION_ERROR` con `details.invalidStudentIds` (misma respuesta en los tres casos).
  - **Regla de 3 por habilidad (AGENTS.md §4.1):** si alguna habilidad incluida queda con 1 o 2 reactivos → 422 `INSUFFICIENT_QUESTIONS_PER_SKILL` con `details.insufficient: [{ skill, count, missing }]`. Con `skills`, una habilidad pedida **sin ningún reactivo** en el grado del grupo no se descarta: aparece en `insufficient` con `count: 0, missing: 3` y no se crea nada. `EMPTY_ASSESSMENT` (422) queda como salvaguarda de dominio para una prueba sin reactivos. Máximo 40 reactivos por prueba (400).
  - **Errores 400:** `message` está redactado para la docente, sin nombres técnicos (p. ej. "Elige al menos un reactivo o una habilidad.", "Elige si la prueba será en pantalla o en papel.", "Elige una habilidad válida."). El campo técnico va en `details.field` (o `details.fields`) y, cuando aplica, `details.allowed`, `details.max` / `details.received` o `details.duplicated`.
  - Grupo sin alumnos activos → 422 `NO_ACTIVE_STUDENTS`.
  - Crea `assignments` (`status = 'active'`), `assignment_questions` (`position` 1..n) y `assignment_targets` en **una sola transacción**: si algo falla, no queda nada.
  - Destinatarios: todos `pending`. En `paper` quedan con `isScreenLocked: true` desde el inicio (AGENTS.md §4.9); en `screen`, sin bloqueo.

## Módulos

- **Health:** `GET /api/v1/health`
- **Auth (`/api/v1/auth`):** ver la sección anterior.
- **Groups (`/api/v1/groups`):** ver la sección anterior.
- **Curriculum (`/api/v1/curriculum`):** ver la sección anterior.
- **Assessments (`/api/v1/assessments`):** ver la sección anterior.
- **Paper Mode (`/api/v1/paper`):** `GET /assignments/:assignmentId/pdf`, `GET /assignments/:assignmentId/hints-pdf`, `GET /assignments/:assignmentId/capture-status`, `POST /assignments/:assignmentId/capture/:studentId`
- **Diagnostics (`/api/v1/diagnostics`):** `GET /students/:studentId/assignments`, `GET /assignments/:assignmentId/start`, `POST /assignments/:assignmentId/answer`, `POST /assignments/:assignmentId/complete`
- **Analytics (`/api/v1/analytics`):** `GET /groups/:groupId/map`, `GET /students/:studentId/profile`
