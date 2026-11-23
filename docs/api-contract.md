# Contrato de API REST (`/api/v1`)

> Estado: Estructura inicial de endpoints planificados (sin implementación todavía).

Todas las respuestas siguen el formato estándar:
- Éxito: `{ "data": ..., "meta": ... }`
- Error: `{ "error": { "code": "...", "message": "..." } }`

## Módulos

- **Health:** `GET /api/v1/health`
- **Auth (`/api/v1/auth`):** `POST /login`, `POST /quick-login/teacher`, `POST /quick-login/student`, `POST /student-join`
- **Groups (`/api/v1/groups`):** `GET /`, `POST /`, `GET /:groupId/students`, `POST /:groupId/students`, `POST /:groupId/students/bulk`, `PATCH /students/:studentId/avatar`
- **Curriculum (`/api/v1/curriculum`):** `GET /groups/:groupId`, `PATCH /groups/:groupId/contents/:contentId`, `GET /groups/:groupId/coverage`
- **Assessments (`/api/v1/assessments`):** `GET /questions`, `GET /groups/:groupId/assignments`, `POST /groups/:groupId/assignments`
- **Paper Mode (`/api/v1/paper`):** `GET /assignments/:assignmentId/pdf`, `GET /assignments/:assignmentId/hints-pdf`, `GET /assignments/:assignmentId/capture-status`, `POST /assignments/:assignmentId/capture/:studentId`
- **Diagnostics (`/api/v1/diagnostics`):** `GET /students/:studentId/assignments`, `GET /assignments/:assignmentId/start`, `POST /assignments/:assignmentId/answer`, `POST /assignments/:assignmentId/complete`
- **Analytics (`/api/v1/analytics`):** `GET /groups/:groupId/map`, `GET /students/:studentId/profile`
