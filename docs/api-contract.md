# Contrato de API REST (`/api/v1`)

> Estado: **Health**, **Auth**, **Groups**, **Curriculum**, **Assessments**, **Diagnostics** y **Analytics** implementados. El resto de los módulos está planificado.

Todas las respuestas siguen el formato estándar:
- Éxito: `{ "data": ..., "meta": ... }`
- Error: `{ "error": { "code": "...", "message": "...", "details"?: ... } }`

### Errores comunes

| Estado | `code` | Cuándo |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` | Cuerpo incompleto, con formato inválido o JSON mal formado |
| 401 | `AUTH_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `SESSION_INVALID` | Falta el token, es inválido o expiró, o el usuario ya no existe |
| 403 | `FORBIDDEN` | El rol de la sesión no puede usar el endpoint |
| 404 | `NOT_FOUND`, `GROUP_NOT_FOUND`, `STUDENT_NOT_FOUND`, `CONTENT_NOT_FOUND`, `ASSIGNMENT_NOT_FOUND`, `QUESTION_NOT_FOUND` | La ruta no existe, o el recurso no existe o no es accesible para la sesión |
| 409 | `SCREEN_LOCKED`, `ALREADY_COMPLETED`, `ALREADY_ANSWERED`, `GROUP_ALREADY_EXISTS`, `GROUP_HAS_HISTORY` | Prueba bloqueada en pantalla (papel), ya terminada o reactivo ya contestado; grupo duplicado; cambio de grado/ciclo en un grupo con historial |
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
| `POST /quick-login/director` | — | Igual que `/login` (director demo, solo lectura de su escuela) | 403 `QUICK_LOGIN_DISABLED`, 404 `DEMO_DATA_MISSING` |
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
| `POST /:groupId/students/import-preview` | teacher | `{ fileName, contentBase64 }` (`.xlsx` o `.csv`, máx. 60 KB) | `{ text, studentCount, invalidRows: [{ row, text }], headerDetected }`: lista "Apellidos, Nombres" lista para `POST /bulk`. **No guarda alumnos.** Columnas: apellido paterno, apellido materno, nombre(s); con encabezados se ubican por nombre; CSV con `,` `;` o tabulador, UTF-8 o Latin-1. | 400 (formato, archivo dañado o vacío, más de 60 alumnos), 401, 403, 404 |
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

## Paper Mode (`/api/v1/paper`)

> **Estado:** `capture-status` implementado. `pdf`, `hints-pdf` y `capture` responden `501 NOT_IMPLEMENTED` hasta implementarse. La lógica pura ya existe en `paper-mode.domain.js` (`buildPaperCapture`, `summarizeCaptureStatus`). Cada endpoint se puede implementar por separado (ruta → service → repository → prueba).

Todos exigen sesión de personal escolar. **Alumno → 403 en todo.** Ninguna respuesta incluye nombres ni `internal_folio`: el frontend cruza `studentId` con `GET /groups/:groupId/students`.

| Método y ruta | Roles | Cuerpo | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `GET /assignments/:assignmentId/pdf` | teacher, director | — | `application/pdf` (hoja genérica) | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND`, 409 `NOT_PAPER_ASSIGNMENT` |
| `GET /assignments/:assignmentId/hints-pdf` | teacher, director | — | `application/pdf` (tarjetas de pistas) | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND`, 409 `NOT_PAPER_ASSIGNMENT` |
| `GET /assignments/:assignmentId/capture-status` | teacher, director | — | `CaptureStatus` | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND`, 409 `NOT_PAPER_ASSIGNMENT` |
| `POST /assignments/:assignmentId/capture/:studentId` | teacher | `{ answers, absent? }` | `CaptureResult` | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND` / `STUDENT_NOT_FOUND`, 409 `NOT_PAPER_ASSIGNMENT` / `ALREADY_CAPTURED`, 422 `ASSIGNMENT_CLOSED` |

- **Autorización:** igual que `assessments`. Docente: solo asignaciones de sus grupos. Director: solo lectura de su escuela; `POST` → 403. Asignación inexistente **o ajena** → 404 con el mismo cuerpo. Una asignación `screen` → 409 `NOT_PAPER_ASSIGNMENT`.
- **PDF de la hoja (`pdf`):** tamaño Carta, blanco y negro, alto contraste. **Genérica**: sin nombre, folio ni datos prellenados del alumno; solo líneas en blanco para "Nombre" y "Fecha". Reactivos en orden `position`, opciones con su `label` (A, B, C…) para marcar. Nunca indica la opción correcta. Puede reutilizar el estilo de `assessments.pdf.js`.
- **PDF de pistas (`hints-pdf`):** Carta, B/N, una tarjeta recortable por reactivo con sus 3 niveles de pista (AGENTS.md §4.6), identificada por número de reactivo. Ninguna tarjeta muestra la respuesta correcta.
- `CaptureStatus`: `{ assignmentId, total, captured, pending, targets: [{ studentId, status, isScreenLocked }] }`. `total` / `captured` / `pending` salen de `summarizeCaptureStatus`. `targets` va en el orden de la lista del grupo (apellidos, nombres).
- **Captura (`POST`)**, una hoja por alumno:
  - `answers`: objeto `{ [questionId]: optionId | null }`. `null` o un reactivo ausente se registran como `unanswered`. Un `questionId` que no es de la prueba → 400 `UNKNOWN_QUESTION`; un `optionId` que no es de ese reactivo → 400 `UNKNOWN_OPTION` (ambos lanzados por el dominio).
  - `absent: true`: el alumno faltó. No se guardan respuestas y el destinatario sigue `pending` (bloqueado), así que se puede capturar después. Responde 200 con `captured: false`.
  - El alumno debe ser destinatario de la asignación; si no → 404 `STUDENT_NOT_FOUND`.
  - Ya capturado (`completed_paper`) → 409 `ALREADY_CAPTURED`. Corregir una captura queda fuera del MVP.
  - En papel no se registra el uso de tarjetas de pistas: `maxHintLevelUsed = 0`, así que nunca hay `achieved_with_support`.
  - **Transaccional:** en una sola transacción guarda `student_responses` (con `source = 'paper'`), pasa el destinatario a `status = 'completed_paper'` con `is_screen_locked = 1` y `completed_at`, y genera el corte en `skill_mastery_history` con la misma regla que `diagnostics/complete` (solo habilidades con al menos 3 reactivos contestados). Reutiliza esa lógica en vez de duplicarla.
- `CaptureResult`: `{ assignmentId, studentId, captured, status, completedAt, summary, skills }` con `summary` y `skills` en el mismo formato que `CompletionResult` de diagnostics. No incluye `celebrations`, porque el alumno no está frente a la pantalla. Con `absent: true`: `{ assignmentId, studentId, captured: false, status: "pending" }`.

## Diagnostics (`/api/v1/diagnostics`)

Todos los endpoints exigen sesión de **alumno** (`role === 'student'`). **Docente o director → 403 en todo.** Nunca expone `isCorrect`, `errorTag`, `errorExplanation` ni `internal_folio`.

| Método y ruta | Roles | Cuerpo | Respuesta `data` | Errores |
| --- | --- | --- | --- | --- |
| `GET /students/:studentId/assignments` | student | — | `[StudentAssignment]` (más recientes primero) · `meta: { count }` | 400, 401, 403, 404 `STUDENT_NOT_FOUND` |
| `GET /assignments/:assignmentId/start` | student | — | `{ assignment, questions: [StartQuestion] }` | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND`, 409 `SCREEN_LOCKED` / `ALREADY_COMPLETED`, 422 `ASSIGNMENT_CLOSED` |
| `POST /assignments/:assignmentId/questions/:questionId/hints` | student | `{ level }` (`1..3`) | `{ questionId, level, hint, remainingHints }` | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND` / `QUESTION_NOT_FOUND`, 409 `SCREEN_LOCKED` / `ALREADY_COMPLETED` / `ALREADY_ANSWERED`, 422 `ASSIGNMENT_CLOSED` / `INVALID_HINT_SEQUENCE` |
| `POST /assignments/:assignmentId/answer` | student | `{ questionId, selectedOptionId }` | `AnswerResult` | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND`, 409 `SCREEN_LOCKED` / `ALREADY_COMPLETED` / `ALREADY_ANSWERED`, 422 `ASSIGNMENT_CLOSED` |
| `POST /assignments/:assignmentId/complete` | student | — | `CompletionResult` | 400, 401, 403, 404 `ASSIGNMENT_NOT_FOUND`, 409 `SCREEN_LOCKED` / `ALREADY_COMPLETED`, 422 `ASSIGNMENT_CLOSED` / `NOTHING_ANSWERED` |

- `StudentAssignment`: `{ id, title, modality, assignmentStatus, status, isScreenLocked, createdAt, startedAt, completedAt, questionCount, answeredCount, skills: [{ code, name, questionCount }] }`. `answeredCount` excluye reactivos marcados como `unanswered`.
- `StartQuestion`: `{ id, position, skill: { code, name }, stem, hints: [...], options: [{ id, label, text }], answered, selectedOptionId, maxHintLevelUsed }`. Al abrir por primera vez (`pending`), pasa a `in_progress` con `startedAt`. Inicialmente `hints` es `[]`; solo incluye las pistas ya solicitadas en el servidor al reanudar.
- **Pistas controladas en servidor (`hints`):** el alumno pide las pistas en orden estricto (`1 → 2 → 3`). Pedir un nivel distinto a `nivelActual + 1` responde `422 INVALID_HINT_SEQUENCE`.
- `AnswerResult`: `{ questionId, selectedOptionId, maxHintLevelUsed, feedback, answeredCount, questionCount }`. Nunca expone si la respuesta fue correcta (`isCorrect` ni `outcomeStatus`); el servidor ignora cualquier `maxHintLevelUsed` enviado por el cliente y usa el registrado al pedir pistas. `feedback` es siempre `"Respuesta guardada."`.
- `CompletionResult`: `{ assignmentId, status: "completed_screen", completedAt, summary: { total, correctAutonomous, achievedWithSupport, incorrect, unanswered, autonomousPercentage, supportedPercentage }, skills: [{ code, name, total, correctAutonomous, achievedWithSupport, incorrect, unanswered, autonomousPercentage, supportedPercentage, masteryRecorded, masteryPercentage, masteryLevel, masteryLabel, message }], celebrations: [{ code, size, skillCode, skillName }] }`.
- **Autorización y aislamiento:** el alumno solo accede a su propio `studentId`, estando `active` en el `groupId` de su token y sobre asignaciones de ese grupo donde sea destinatario. Cualquier otro caso responde 404 (`STUDENT_NOT_FOUND` o `ASSIGNMENT_NOT_FOUND`).
- **Bloqueo pantalla vs. papel (AGENTS.md §4.9):** si la prueba es `paper`, tiene `is_screen_locked = 1` o `status = 'completed_paper'`, `start`, `hints`, `answer` y `complete` responden `409 SCREEN_LOCKED`. Si ya terminó (`completed_screen`), responden `409 ALREADY_COMPLETED`.
- **Cierre transaccional (`complete`):** exige al menos una respuesta (`422 NOTHING_ANSWERED`), marca reactivos omitidos como `unanswered` (el peso de reactivos sin contestar en el corte queda por validar con docente), registra un solo `block_completed` por prueba y solo genera corte inmutable en `skill_mastery_history` (`masteryRecorded: true`) para habilidades con al menos 3 reactivos contestados.

## Módulos

- **Health:** `GET /api/v1/health`
- **Auth (`/api/v1/auth`):** ver la sección anterior.
- **Groups (`/api/v1/groups`):** ver la sección anterior.
- **Curriculum (`/api/v1/curriculum`):** ver la sección anterior.
- **Assessments (`/api/v1/assessments`):** ver la sección anterior.
- **Paper Mode (`/api/v1/paper`):** ver la sección anterior (`capture-status` listo; el resto responde 501).
- **Diagnostics (`/api/v1/diagnostics`):** ver la sección anterior.
- **Analytics (`/api/v1/analytics`):** `GET /school` y `GET /school/export.pdf` (solo director), `GET /groups/:groupId`, `GET /groups/:groupId/students/:studentId` (ver contrato siguiente).
- **Games (`/api/v1/games`):** catálogo y práctica manipulativa del alumno (ver contrato al final).
- **Interventions (`/api/v1/interventions`):** ciclo actividad aplicada → nueva prueba (ver contrato al final).

## Analytics de solo lectura (`/api/v1/analytics`)

Ambas rutas requieren sesión docente o director. El docente solo consulta sus grupos;
el director consulta grupos de su escuela. Sin sesión: 401; alumno: 403; grupo
inexistente o ajeno: 404 `GROUP_NOT_FOUND`. Id inválido: 400 `VALIDATION_ERROR`.
El perfil exige matrícula activa en el grupo: alumno inexistente o ajeno responde
404 `STUDENT_NOT_FOUND`. Nunca se devuelve `internal_folio`.

- `GET /school` (**solo director**; docente o alumno: 403): panel de la escuela de la sesión con los
  grupos del ciclo escolar más reciente. Solo agregados: **nunca** nombres, folios ni ids de alumnos.
  `{ data: { school, summary, fields, skills, groups, priorities, typicalErrors }, meta }`.
  - `school`: `{ id, name, schoolYear }`.
  - `summary`: `{ groupCount, teacherCount, studentCount, evaluatedStudentCount, evidencePercentage, needsSupportCount, needsSupportPercentage, coveragePercentage, latestRecordedAt }`.
  - `fields`: los 4 campos formativos del Plan de Estudio 2022 de la SEP, en orden oficial:
    `{ code, name, assessed, skills: [{ code, name }], average, level, label, evaluatedCount, needsSupportCount, distribution }`.
    Un campo sin habilidades evaluadas en Axi trae `assessed: false` y `average: null` (nunca 0 %).
    El dominio por campo de cada alumno es el promedio de sus habilidades evaluadas en ese campo.
  - Cada grupo solo usa las habilidades del programa de su grado y los cortes de ese grado
    (`SKILL_GRADE_RANGE` en `curriculum.domain.js`: fracciones de 3.º a 6.º, multiplicación de 2.º a 6.º).
  - `skills`: `{ code, name, average, level, label, evaluatedCount, needsSupportCount, grades }` de toda la escuela (`grades`: "3.º a 6.º").
  - `teachers`: `{ name, groups: ["3.º A"], studentCount, evaluatedStudentCount, needsSupportCount, evidencePercentage }` (sin correos).
  - `groups`: `{ id, name, grade, section, schoolYear, teacherName, studentCount, evaluatedStudentCount, evidencePercentage, needsSupportCount, needsSupportPercentage, fields, skills, prioritySkill, coveragePercentage }`.
  - `priorities`: prioridades del mes, máximo 3 y resumidas: `{ type, title, detail, action, groupIds, skillCode? }`.
    Orden por `type`: `evidence` (< 50 % con diagnóstico), `skill` (habilidad con menor dominio de la escuela),
    `group_support` (grupos con ≥ 50 % de alumnos que necesitan apoyo, en un solo elemento), `coverage` (< 25 % del temario visto).
  - `cte`: próxima sesión ordinaria del Consejo Técnico Escolar `{ date, label, month, daysUntil, source }`.
    `source: 'calendar'` usa fechas cargadas a mano (`CTE_SESSIONS`; 2026-2027 tomadas de notas de prensa sobre el calendario SEP,
    por verificar en el DOF: último viernes del mes, sin diciembre ni abril);
    `source: 'rule'` estima el último viernes del mes (sin diciembre, julio ni agosto) cuando el ciclo no está cargado. `null` si no hay ciclo.
  - `typicalErrors`: hasta 5 `{ skillCode, skillName, errorTag, explanation, studentCount, groupCount }`;
    `studentCount` son alumnos distintos por habilidad y etiqueta. No se reportan etiquetas con menos de 3 alumnos.
  - Nota: la interfaz del director solo usa este endpoint, pero la API conserva su lectura de
    `/groups`, `/analytics/groups/*`, `/curriculum`, `/assessments` e `/interventions` de su escuela (pendiente de restringir).
- `GET /school/export.pdf` (**solo director**): el panel en PDF Carta, blanco y negro (`application/pdf`,
  `panel-escuela-<ciclo>.pdf`): indicadores, próximo CTE, prioridades del mes, campos formativos, habilidades,
  resumen por grupo, errores típicos y metodología. Solo agregados; sin datos de alumnos.
- `GET /groups/:groupId`: `{ data: { group, skills, students, summary }, meta }`.
- `GET /groups/:groupId/students/:studentId`: `{ data: { group, student, skills, history, recommendedActivity, typicalErrors }, meta }`.
- `group`: `{ id, grade, section, schoolYear }`.
- `student`: `{ id, name, initials, avatarColor }`; cada elemento de `students`
  agrega `skills` con las cinco habilidades del catálogo.
- Habilidad de alumno: `{ code, name, masteryPercentage, level, label,
  autonomousPercentage, supportedPercentage, recordedAt, grade }`. `masteryPercentage`
  es el último corte longitudinal inmutable (ponderación lineal de porcentajes
  autónomos). `autonomousPercentage` y `supportedPercentage` son los resultados
  separados de esa última sesión; `grade` identifica el grado de ese corte.
  Sin evidencia: porcentajes, `level`, fecha y `grade` en `null`,
  `label: "Sin evaluar"`. Cero es una medición válida.
  `autonomyTrend` compara las dos sesiones más recientes de la habilidad (pueden
  ser de grados distintos): `{ trend, label, delta, previousAutonomous,
  latestAutonomous, previousSupported, latestSupported, fromSupport }`.
  `trend` es `toward_autonomy` si el acierto autónomo sube 10 puntos o más,
  `more_support` si baja 10 o más y `steady` en otro caso. `fromSupport` indica
  que además bajó el porcentaje logrado con apoyo. Con una sola sesión: `null`.
- Habilidad de grupo: `{ code, name, average, level, label, evaluatedCount,
  needsSupportCount, gradeCounts }`. `gradeCounts` indica cuántos cortes más
  recientes provienen de cada grado; el mapa y el perfil señalan los cortes de
  grados distintos al grupo actual. Promedio solo sobre alumnos activos
  evaluados, sin convertir datos faltantes en cero. La escala se aplica al
  promedio redondeado a dos decimales, igual que al dominio de cada alumno.
- `summary`: `{ studentCount, needsSupportCount, weakestSkill, coverage,
  recommendedActivity, typicalErrors, autonomyProgress, nextStep }`.
  `autonomyProgress`: `{ threshold, comparedStudentCount,
  towardAutonomyStudentCount, fromSupportStudentCount, highlight, skills }`,
  donde `skills` es `[{ code, name, comparedCount, towardAutonomyCount,
  steadyCount, moreSupportCount, fromSupportCount }]` y `highlight` es la
  habilidad con más alumnos `fromSupport` (`{ skillCode, skillName,
  studentCount }`) o `null`. `nextStep` ("Qué hago mañana"): `{ skillCode,
  skillName, average, label, error, activity }` para la habilidad de menor
  promedio; `error` es el error típico de esa habilidad con más alumnos
  distintos (`{ errorTag, explanation, studentCount }`) o `null`; `activity` es
  `recommendedActivity`. `null` si no hay habilidad evaluada. `needsSupportCount` cuenta alumnos
  únicos con alguna habilidad en `needs_support`. `weakestSkill` es la habilidad
  evaluada con menor promedio, o `null`. No hay rankings entre alumnos.
- `coverage`: `{ total, pending, in_progress, seen, coveragePercentage }`, sobre
  contenidos del grado: cobertura = contenidos vistos / total; no significa
  contenidos evaluados.
- `recommendedActivity`: `{ id, title, description, durationMinutes, grouping,
  materials, targetErrorTag }` del catálogo para la habilidad de menor promedio
  y el grado actual, priorizando el error observado más frecuente. `null` si
  no hay habilidad evaluada o actividad compatible. Es una sugerencia, no una
  asignación. `meta.contentReview: "por validar con docente"` identifica el
  contenido pedagógico de ejemplo.
- `typicalErrors`: `[{ skillCode, errorTag, explanation, count, studentCount }]`
  (`count` respuestas, `studentCount` alumnos distintos), respuestas
  incorrectas reales de aplicaciones terminadas del grupo actual, alumnos
  activos y escuela autorizada; el perfil filtra además al alumno. Una fila por
  `(skillCode, errorTag)`: `explanation` es una explicación representativa
  (puede variar por reactivo) y cada alumno cuenta una sola vez. Orden: más
  alumnos distintos, luego más respuestas, habilidad y etiqueta. Las respuestas
  de sesiones en progreso no se cuentan. `nextStep.error` y la actividad
  sugerida usan el mismo error: el de más alumnos de la habilidad prioritaria.
- `history`: `[{ id, skillCode, skillName, grade, schoolYear, sessionIndex,
  sessionPercentage, autonomousPercentage, supportedPercentage,
  masteryPercentage, level, label, recordedAt }]`. Incluye cortes de grados
  anteriores de la misma escuela, por fecha ascendente e id. Cortes sin
  asignación conservan `schoolYear: null`; no se inventa un ciclo. Fechas UTC
  de SQLite. Analytics no modifica ningún corte ni recalcula respuestas.

### Selección, distribución y exportación de Analytics

`GET /analytics/groups/:groupId` y sus descargas aceptan únicamente estos
parámetros de consulta opcionales:

- `skillCode`: uno de los códigos del catálogo, por ejemplo `fractions`.
- `supportOnly`: texto `true` o `false` (por defecto `false`).

Parámetros desconocidos, repetidos, vacíos, arreglos, objetos, habilidades
inexistentes o booleanos distintos de `true`/`false` responden 400
`VALIDATION_ERROR`. No se envían búsquedas de nombres en la URL. Primero se
valida acceso al grupo; un grupo ajeno sigue respondiendo 404.

El resultado agrega `selection: { skillCode: string | null, supportOnly: boolean,
studentCount: number }`. `studentCount` representa el número de alumnos de la
selección. `supportOnly=true` filtra `data.students` a quienes tienen nivel
`needs_support` en la habilidad elegida; sin `skillCode`, en al menos una
habilidad. Elegir solo una habilidad sin `supportOnly` conserva a todos los
alumnos. Cada alumno conserva sus habilidades para que el cliente pueda cambiar
la visualización sin inventar métricas.

`data.skills` y `data.summary` siempre representan el **grupo completo**,
independientemente del filtro. Cada habilidad de grupo agrega:

- `distribution: { needs_support, in_progress, achieved, mastered, not_evaluated }`:
  conteos de alumnos activos; la suma coincide con `summary.studentCount`.
- `evidencePercentage`: porcentaje de alumnos evaluados sobre el total de
  alumnos activos, redondeado a dos decimales; grupo vacío devuelve `0`.

`summary` agrega `evaluatedStudentCount` (al menos una habilidad evaluada),
`notEvaluatedStudentCount` y `latestRecordedAt` (fecha UTC del corte más reciente
de los alumnos activos, o `null`). Una medición de 0% sí cuenta como evidencia.

| Endpoint | Respuesta |
| --- | --- |
| `GET /analytics/groups/:groupId/export.xlsx` | Excel nativo: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `GET /analytics/groups/:groupId/export.pdf` | PDF Carta, blanco y negro: `application/pdf` |

Las descargas usan los mismos filtros, validación y autorización (docente propio
o director de la escuela); alumno recibe 403. Se devuelven con
`Content-Disposition: attachment`, nombre `diagnostico-grupo-ID.xlsx` o `.pdf`
y `Cache-Control: no-store`. Los errores mantienen JSON estándar; no se generan
archivos antes de validar acceso y filtros. No se guardan reportes en disco.

Excel incluye hojas `Resumen` (métricas globales, cobertura y distribución),
`Resultados` (alumnos filtrados × habilidad elegida o todas) y `Metodología`.
Los porcentajes son números entre 0 y 1 con formato porcentual; sin evidencia,
las celdas numéricas están vacías y el nivel dice `Sin evaluar`. Los nombres se
escriben como texto, nunca como fórmulas. Resultados tiene filtro de columnas y
fila de encabezados congelada.

PDF incluye resumen global, alcance de la selección, detalle con porcentaje y
nivel escrito, resultados autónomos y con apoyo separados de la última sesión,
y metodología. Incluye paginación y encabezados repetidos. Ambos formatos
identifican grupo, ciclo, selección, fecha de generación en Ciudad de México,
uso escolar privado y aviso de contenido pedagógico por validar con docente.
No contienen folios internos ni datos de otros grupos o escuelas.

## Juegos de práctica (`/api/v1/games`)

Todas las rutas requieren sesión de alumno. Sin sesión: 401; docente o director:
403 `FORBIDDEN`. Cada petición vuelve a consultar el grupo de la escuela de la
sesión y la matrícula activa del alumno. Una matrícula retirada, terminada o un
grupo de otra escuela responde 403 `STUDENT_ACCESS_REVOKED`; no basta un token
todavía vigente. El grado se obtiene siempre del grupo, nunca del cliente.

| Método y ruta | `data` |
| --- | --- |
| `GET /games` | `{ games: Game[], grade, practiceOnly: true, contentReview }` |
| `GET /games/:gameCode` | `{ game: Game, grade, rounds: Round[3], practiceOnly: true, contentReview }` |
| `POST /games/:gameCode/check` | `{ correct: boolean, feedback: string, explanation: string }` |

Las rutas anteriores se expresan bajo `/api/v1`. `contentReview` vale
`"por validar con docente"`. `Game` es `{ code, title, skillCode, description }`.
Los códigos disponibles son `fractions`, `multiplication`, `place_value`.
Código inexistente: 404 `GAME_NOT_FOUND`. Los tres retos de cada juego son
deterministas para cada grado de 1.º a 6.º; constituyen ejemplos de práctica y
no una declaración de alineación curricular SEP validada.

`Round` es `{ id, prompt, instruction, hints: [string, string, string], material }`.
Los ids son `GAMECODE-1`, `GAMECODE-2`, `GAMECODE-3`. Las pistas progresan desde
observación hasta un ejemplo con otros datos; no entregan la solución del reto.

- `fractions`: `material: { denominator, targetNumerator }`. El alumno construye
  una representación de la fracción pintando partes iguales. `answer` es un
  número entero entre 0 y `denominator`, que representa las partes pintadas.
- `multiplication`: `material: { groups, perGroup, totalCounters }`.
  `totalCounters = groups * perGroup`. El alumno reparte contadores entre
  recipientes. `answer` es un arreglo de longitud `groups`, con enteros entre
  0 y `totalCounters`; cada entrada representa un recipiente. Es correcto si
  todos contienen `perGroup` contadores.
- `place_value`: `material: { targetNumber, places }`. Para grados 1.º y 2.º,
  `places = ["tens", "units"]`; para 3.º a 6.º,
  `places = ["hundreds", "tens", "units"]`. `answer` es un objeto con
  exactamente esas claves y valores enteros entre 0 y 9. Se verifica el valor
  `hundreds * 100 + tens * 10 + units`, con centenas ausentes equivalentes a 0.

El cuerpo de `check` debe tener **exactamente** `{ roundId, answer }`.
Un cuerpo no objeto, propiedades extra (incluidos `grade` o datos de otra
persona), reto desconocido o de otro juego, tipos incorrectos, claves faltantes
y valores fuera de límites responden 400 `VALIDATION_ERROR`. No se convierten
cadenas numéricas a números. Una construcción válida que no corresponde al
objetivo responde 200 con `correct: false`, retroalimentación neutra y una
orientación sin entregar la respuesta.

Estos juegos son exclusivamente práctica: no escriben respuestas, dominio,
historial, logros ni asignaciones. No tienen temporizadores, vidas, castigos,
clasificaciones entre alumnos ni guardado del progreso de juego.

## Ciclo de acompañamiento (`/api/v1/interventions`)

Registra que el docente aplicó una actividad del catálogo y compara a **los
mismos alumnos** antes y después. No guarda datos de alumnos: el antes y el
después se calculan desde `student_responses` de pruebas terminadas del grupo,
solo con alumnos de matrícula activa.

| Método y ruta | Acceso | `data` |
| --- | --- | --- |
| `GET /groups/:groupId` | docente dueño o director de la escuela | `{ interventions: Intervention[] }` (más reciente primero) |
| `POST /groups/:groupId` | solo docente dueño (201) | `Intervention` |

El cuerpo de `POST` es exactamente `{ activityId, note? }`: `activityId` entero
positivo de una actividad cuyo rango de grados incluye el grado del grupo;
`note` texto opcional de hasta 300 caracteres (vacío se guarda como `null`).
Claves extra o tipos incorrectos: 400 `VALIDATION_ERROR`. Actividad de otro
grado o inexistente: 404 `ACTIVITY_NOT_FOUND`. Sin sesión: 401; alumno: 403;
director en `POST`: 403; grupo ajeno: 404 `GROUP_NOT_FOUND`.

`Intervention` es `{ id, appliedAt, note, activity: { id, title,
durationMinutes, grouping }, skillCode, skillName, targetErrorTag,
errorExplanation, outcome }`. `outcome` es `{ status, baselineCount,
reevaluatedCount, overcameCount, stillWithErrorCount, awaitingCount }`:

- Antes y después se comparan por **prueba completa** (destinatario terminado), no por
  respuesta: una prueba es "antes" si empezó antes de registrar la actividad y "después"
  si empezó después, así una prueba en curso nunca se parte. Solo cuentan pruebas con
  reactivos de la habilidad que permitían mostrar `targetErrorTag` (misma regla en ambos lados).
- `baselineCount`: alumnos cuya prueba "antes" más reciente mostró `targetErrorTag` (o
  cualquier respuesta incorrecta de la habilidad si la actividad no tiene etiqueta).
- `reevaluatedCount`: de ellos, quienes tienen una prueba "después"; se usa la más
  reciente: `stillWithErrorCount` volvió a mostrar el error en ella y `overcameCount`
  ya no. `awaitingCount` aún no presenta nueva prueba y no se cuenta como avance ni
  como pendiente de mejora.
- `status`: `awaiting_retest` si nadie del grupo base ha sido reevaluado;
  `measured` en otro caso.

## Aprendemos en equipo (`/api/v1/tutoring`)

La interfaz usa «compañero guía» y «equipos». Los nombres de rutas y campos (`tutor`, `tutee`) se conservan para mantener la compatibilidad de la API.

Requiere sesión. El docente consulta y modifica únicamente sus grupos; dirección
consulta los de su escuela. Sin sesión: 401; alumno: 403; dirección al escribir:
403; grupo ajeno o inexistente: 404 `GROUP_NOT_FOUND`. Solo se incluyen alumnos
con matrícula activa. Las respuestas no exponen folios internos.

| Método y ruta | `data` |
| --- | --- |
| `GET /groups/:groupId/proposal?skillCode=multiplication` | `{ group, skill, skills, maxPerTutor, pairs, teacherTable, availableTutors, tutors }` |
| `GET /groups/:groupId/sessions` | `{ group, sessions, network }` |
| `POST /groups/:groupId/sessions` | Sesión guardada, con sus parejas (201) |
| `PATCH /groups/:groupId/pairs/:pairId/demonstration` | `{ id, demonstration, demonstratedAt }` |
| `GET /groups/:groupId/sessions/:sessionId/cards.pdf` | Tarjetas para repartir, `application/pdf` |
| `GET /groups/:groupId/sessions/:sessionId/key.pdf` | Clave y mesa docente, `application/pdf` |

La propuesta usa la habilidad solicitada o prioriza una con tutores disponibles
y más alumnos por acompañar. Puede enseñar quien tiene dominio autónomo
`mastered` o una última demostración de 3/3 en esa habilidad. Reciben tutoría
quienes están en `needs_support` o `in_progress` y aún no demostraron 3/3.
Se prefiere un tutor que haya mostrado antes el mismo error típico; cada tutor
acompaña como máximo a dos alumnos y el resto queda en la mesa docente. Esta
propuesta es privada para el personal escolar y no constituye un ranking.

`POST` acepta exactamente `{ skillCode, note?, pairs: [{ tutorId, tuteeId }] }`.
`tutorId` es un entero positivo o `null` (mesa docente); `tuteeId`, entero positivo.
Admite entre 1 y 80 parejas y una nota de hasta 300 caracteres. Rechaza
autoparejas, tutorados repetidos, un alumno como tutor y tutorado en la misma
sesión o más de dos compañeros por tutor. Cuerpo inválido: 400
`VALIDATION_ERROR`; alumno inactivo o ajeno al grupo: 404 `STUDENT_NOT_FOUND`;
tutor sin evidencia suficiente: 422 `TUTOR_NOT_READY`. La creación es atómica.

`PATCH` acepta exactamente `{ correct: 0 | 1 | 2 | 3 }`, los aciertos sin ayuda
en tres reactivos. `demonstration` contiene `{ code, label, correct, total: 3 }`:
3/3 es `ready_to_teach` ("Ya puede enseñarlo"), 2/3 es `progressing` ("Va
avanzando") y 0–1/3 es `keep_practicing` ("Seguimos practicando juntos").
Se puede corregir una captura; la demostración de la sesión más reciente determina
si puede enseñar, aunque se corrija una sesión anterior después. Una pareja ajena al
grupo o con tutorado retirado responde 404
`PAIR_NOT_FOUND`. Estas capturas nunca modifican `skill_mastery_history`,
respuestas de evaluaciones ni logros oficiales.
Para imprimir cualquiera de los PDF o registrar una demostración se necesitan
al menos cuatro reactivos de la habilidad en el grado del grupo: uno de práctica y
tres distintos para la demostración. Si no
hay suficientes, responde 422 `INSUFFICIENT_DEMONSTRATION_QUESTIONS` y no guarda
aciertos ni habilita nuevos tutores.

`network` incluye cantidades por habilidad, errores trabajados y alumnos que
pueden enseñar, sin comparar posiciones. Las consultas agregan
`meta.contentReview`: guiones y frases por validar con docente de primaria.
El idioma de la interfaz es una preferencia local del dispositivo. No se almacena
la lengua del alumno en este servicio ni se usa para formar equipos.

Los PDF son Carta, blanco y negro, con `Content-Disposition: attachment` y
`Cache-Control: no-store`. Las tarjetas contienen práctica, tres pistas y
demostración; no imprimen la clave ni nombres de alumnos. La guía docente privada
puede mostrar los nombres de estudiantes asignados a la mesa docente; ningún PDF
incluye folios internos. Una sesión inexistente o de otro grupo responde 404
`SESSION_NOT_FOUND`.
