# Contrato de API REST (`/api/v1`)

> Estado: **Health** y **Auth** implementados. El resto de los módulos está planificado.

Todas las respuestas siguen el formato estándar:
- Éxito: `{ "data": ..., "meta": ... }`
- Error: `{ "error": { "code": "...", "message": "...", "details"?: ... } }`

### Errores comunes

| Estado | `code` | Cuándo |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` | Cuerpo incompleto, con formato inválido o JSON mal formado |
| 401 | `AUTH_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `SESSION_INVALID` | Falta el token, es inválido o expiró, o el usuario ya no existe |
| 403 | `FORBIDDEN` | El rol de la sesión no puede usar el endpoint |
| 404 | `NOT_FOUND` | La ruta no existe |
| 409 | `SCREEN_LOCKED`, `ALREADY_COMPLETED` | Prueba bloqueada en pantalla (papel) o ya terminada |
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

## Módulos

- **Health:** `GET /api/v1/health`
- **Auth (`/api/v1/auth`):** ver la sección anterior.
- **Groups (`/api/v1/groups`):** `GET /`, `POST /`, `GET /:groupId/students`, `POST /:groupId/students`, `POST /:groupId/students/bulk`, `PATCH /students/:studentId/avatar`
- **Curriculum (`/api/v1/curriculum`):** `GET /groups/:groupId`, `PATCH /groups/:groupId/contents/:contentId`, `GET /groups/:groupId/coverage`
- **Assessments (`/api/v1/assessments`):** `GET /questions`, `GET /groups/:groupId/assignments`, `POST /groups/:groupId/assignments`
- **Paper Mode (`/api/v1/paper`):** `GET /assignments/:assignmentId/pdf`, `GET /assignments/:assignmentId/hints-pdf`, `GET /assignments/:assignmentId/capture-status`, `POST /assignments/:assignmentId/capture/:studentId`
- **Diagnostics (`/api/v1/diagnostics`):** `GET /students/:studentId/assignments`, `GET /assignments/:assignmentId/start`, `POST /assignments/:assignmentId/answer`, `POST /assignments/:assignmentId/complete`
- **Analytics (`/api/v1/analytics`):** `GET /groups/:groupId/map`, `GET /students/:studentId/profile`
