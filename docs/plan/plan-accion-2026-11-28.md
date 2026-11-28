# Plan de acción — Axi, fase 2 (28 de noviembre de 2026, presencial)

**Equipo:** Raúl, Osvaldo y lizocbla, en paralelo, cada quien con Claude.
**Modelo de negocio acordado:** híbrido, entrando por **zona escolar**. Escuelas públicas gratis (paga la zona, el estado o una fundación); escuelas privadas con licencia por alumno.
**Jerarquía:** Plataforma → Zona (supervisor) → Escuela (director) → Docentes → Grupos → Alumnos (sin cuenta).

---

## 1. Reparto

| | **Raúl** — Cuentas y jerarquía | **Osvaldo** — Escaneo de hojas | **lizocbla** — Alumnos y reactivos |
| --- | --- | --- | --- |
| Qué | Zona, supervisor, registro de docentes con código de escuela + aprobación, contraseñas, panel del supervisor | Hoja de respuestas escaneable + lectura con la cámara del celular en Captura rápida | Editar y dar de baja alumnos, imagen secreta, gráficos en los reactivos, AGENTS.md |
| Rama | `feat/accounts-zones` | `feat/paper-omr-scan` | `feat/students-edit`, `feat/student-secret-image`, `feat/question-visuals` |
| Migración | **007** | **009** (solo si la necesita) | **008** (imagen secreta) y **010** (gráficos) |
| Primera entrega | Contrato de API de cuentas (≤ 1 h) | **PDF de la hoja de respuestas para imprimir (≤ 2 h)** | Contrato de editar/baja + imagen secreta (≤ 1 h) |

> **Regla para no chocar:** cada quien escribe primero su **contrato** en `docs/api-contract.md` (en su propia sección) y lo sube en un PR `docs:` de una sola revisión. Así los otros pueden programar contra él sin esperar.

---

## 2. Raúl — Cuentas reales, zona y supervisor

### 2.1 Datos (migración `007_accounts_zones.sql`)
- **Tabla `zones`:** `id`, `name`, `code` (clave de zona, única), `created_at`.
- **`schools`:** agregar `zone_id` (FK opcional) y `join_code` (código de escuela para que los docentes se registren: único, se puede cambiar).
- **`users`:**
  - `role` acepta `'supervisor'`.
  - Agregar `status` (`pending` / `active` / `disabled`), `zone_id` (para el supervisor), `approved_by`, `approved_at` y `password_changed_at`.
  - `school_id` pasa a ser opcional, con la regla: supervisor → `zone_id` obligatorio; los demás roles → `school_id` obligatorio.
  - ⚠️ SQLite **no permite cambiar un `CHECK`**: hay que reconstruir la tabla, como en la migración `006` (crear la nueva tabla, copiar los datos y renombrarla).
- **Tabla `user_access_codes`:** códigos de un solo uso para **restablecer contraseña**: `user_id`, `code_hash`, `expires_at`, `used_at`, `created_by`.

### 2.2 Flujos (API + pantallas)
1. **El docente se registra** con el código de escuela, su correo y su contraseña → queda `pending`. Mientras está pendiente **no ve nada** (403 en todo, salvo su estado).
2. **El director aprueba o rechaza** desde "Docentes", que deja de ser maqueta. Rechazar desactiva la cuenta, no la borra.
3. **Desactivar a un docente:** no puede entrar, pero sus grupos y el historial de los alumnos **se quedan en la escuela**.
4. **Restablecer contraseña:** el director genera un código de un solo uso (vence en 72 h) y lo entrega en persona. El docente lo usa para crear una contraseña nueva. **Nadie ve contraseñas.**
5. **Cambiar mi contraseña** (cualquier usuario con sesión).
6. **El director ve y cambia el código de la escuela.**
7. **Panel del supervisor:** el mismo panel del director (`/analytics/school`), sumando las escuelas de su zona. Sin datos de alumnos, solo agregados. Reutilizar `analytics.school.domain.js`.
8. **Escuela y director:** se crean con **seed o script** para la entrega. El alta desde el supervisor queda para después.

### 2.3 Demo
- **Seed:** 1 zona, 1 supervisor y 2 o 3 escuelas con director. Uno de los docentes demo debe quedar `pending`, para mostrar la aprobación en vivo.
- **Botón "Entrar como Supervisor"** junto a los demás accesos rápidos.

### 2.4 Cuidado con
- **Rate limit** en registro y restablecimiento, igual que en el login.
- **Los códigos** se guardan **cifrados (hash)**, nunca en texto plano.
- **AGENTS.md:** pasar por el agente `arquitectura` antes de la migración, por ser una decisión técnica grande.

---

## 3. Osvaldo — Hoja escaneable y captura con la cámara

> En AGENTS.md esto estaba en el **Roadmap** ("Lectura OMR por cámara"). Ahora pasa al alcance; lizocbla actualiza AGENTS.md.

### 3.1 Primero: la hoja de respuestas (para imprimir y probar el mismo día)
La hoja actual **no se puede escanear**: los reactivos van en tarjetas de tamaño variable y no hay marcas de referencia. Se agrega una **hoja de respuestas** al PDF de papel (`GET /paper/assignments/:id/pdf`), en una página propia:
- **4 marcas negras** (cuadros) en las esquinas, para corregir la inclinación de la foto.
- **Cuadrícula de burbujas fija:** una fila por reactivo, con columnas A, B, C y D.
- **Burbuja "Usó tarjetas de pistas"**, la misma casilla general que ya existe.
- **Código de la prueba** impreso (por ejemplo `P-123`), para detectar si escanean la hoja de otra prueba.
- **Sigue siendo genérica:** sin nombre ni folio del alumno (AGENTS.md §1.3), en blanco y negro, tamaño Carta.
- **Las posiciones** (en milímetros o proporciones) salen de **una sola fuente**: un endpoint `GET /paper/assignments/:id/omr-layout`, que usan el PDF y el escáner.

### 3.2 Después: escanear con el celular (dentro de Captura rápida)
1. La docente elige al alumno (como hoy) y toca **"Escanear hoja"**.
2. Se abre la cámara (`getUserMedia`, cámara trasera) con un **marco guía** donde se alinea la hoja.
3. Se toma la foto → se buscan las 4 marcas cerca de las esquinas del marco → se **corrige la perspectiva** → se mide qué tan oscura está cada burbuja.
4. **Las respuestas leídas solo llenan el formulario de Captura rápida.** La docente las **revisa y confirma**. Nunca se guarda en automático. Las burbujas dudosas (dos marcadas, o tenues) se resaltan para revisarlas.
5. Al confirmar se usa el `POST /paper/.../capture/:studentId` que ya existe. **No hace falta otro endpoint para guardar.**

**Recomendación técnica:** procesar todo **en el navegador** con `<canvas>`, sin OpenCV (pesa ~8 MB). Con el marco guía, basta con buscar las marcas en 4 zonas pequeñas. La foto **no se sube ni se guarda**, porque es la hoja de un menor.

### 3.3 Criterios
- [ ] Imprimir la hoja de *Fracciones · prueba 1*, llenarla a mano y escanearla en un celular real: ≥ 95 % de burbujas leídas bien con buena luz.
- [ ] Hoja chueca (±10°) o con sombra: el escáner avisa ("Acerca la hoja al marco") en lugar de leer mal.
- [ ] Sin cámara o sin permiso: Captura rápida sigue funcionando a mano.
- [ ] 360 px sin scroll horizontal y botones de 44 px.

---

## 4. lizocbla — Alumnos, reactivos y documentación

### 4.1 Editar y dar de baja alumnos (sin migración: usa columnas que ya existen)
- `PATCH /groups/:groupId/students/:studentId` → corregir nombres y apellidos (las iniciales se recalculan).
- **Dar de baja:** usar `group_enrollments.status = 'withdrawn'` + `ended_at`, que ya existen. **Nunca borrar**, para conservar el historial.
- **Borrar** solo alumnos creados por error **y sin ninguna respuesta, corte ni logro**. Si tiene datos → 409 con mensaje claro.
- En la pantalla del grupo: botones "Editar" y "Dar de baja" por alumno, con confirmación.

### 4.2 Imagen secreta del alumno (migración `008_student_secret_image.sql`)
- **`students`:** `secret_hash` y `secret_set_at`. **`groups`:** `secret_setup_until`, la ventana que abre la docente.
- **Flujo:** código del grupo → tarjeta → "¿Eres Sofía R.?" → imagen secreta → entra.
  - **1.º y 2.º:** una imagen de 9; **3.º a 6.º:** dos imágenes en orden.
  - **Primera vez:** el alumno la elige, **solo si la docente abrió la ventana** ("Hoy configuramos imágenes"). Fuera de la ventana: "Pídele ayuda a tu maestra".
  - **Si se equivoca:** mensaje amable; después de 3 intentos, "Pídele ayuda a tu maestra". **Sin bloqueos ni castigos.**
  - **La docente** puede restablecer la imagen de cualquier alumno.
- ⚠️ **Toca `auth`,** igual que Raúl. **Acuerden:** lizocbla solo toca la parte del alumno (`student-join/select`); Raúl, la del personal escolar. Integrar primero lo de Raúl.

### 4.3 Gráficos en los reactivos (rama aparte, `feat/question-visuals`)
- Columna `questions.visual` (JSON, migración `010_question_visuals.sql`), por ejemplo `{ "type": "fraction_circle", "theme": "pizza", "parts": 8, "shaded": 3 }`. El generador del banco la llena donde aplica (ver `docs/api-contract.md`).
- **Pantalla del alumno:** componente de solo lectura a partir de `FractionMaterial`, `GroupMaterial` y `PlaceMaterial` de los juegos.
- **PDF en blanco y negro:** el mismo dibujo, para que pantalla y papel sean comparables.
- **Accesibilidad:** descripción para lectores de pantalla.
- **Cuidado:** no mostrar el dibujo en reactivos donde delate la respuesta.

### 4.4 Documentación y coordinación
- **AGENTS.md:** mover del Roadmap al alcance el supervisor y la zona, las cuentas reales y el OMR por cámara. Actualizar la jerarquía y los roles.
- **Diagramas:** casos de uso y entidad-relación (ver `docs/diagramas/`).
- **Integración:** revisar e integrar los PR, en este orden: contratos → Raúl (migración 007) → lizocbla (008 y 010) → Osvaldo.

---

## 5. Archivos compartidos (dónde pueden chocar)

| Archivo | Regla |
| --- | --- |
| Migraciones | Números reservados: **007 Raúl, 008 y 010 lizocbla, 009 Osvaldo**. Nadie edita migraciones ya integradas. |
| `backend/src/app.js` | Cada quien agrega **solo su línea** de router. |
| `backend/src/db/seed.js` | Cada quien crea **su propio archivo** en `db/seed/` y agrega una sola línea en `seed.js`. |
| `frontend/src/App.jsx` | Cada quien agrega **solo sus rutas**, en un bloque con comentario. |
| `AppShellLayout.jsx` | **Raúl** (menú del supervisor). Los demás no lo tocan. |
| `auth.service.js` | Raúl, personal escolar; lizocbla, alumno. **Integrar primero Raúl.** |
| `docs/api-contract.md` | Cada quien, **su sección**. |

---

## 6. Horario sugerido

| Hora | Qué |
| --- | --- |
| 09:00–09:30 | Repasar este plan y los diagramas; confirmar contratos y números de migración |
| 09:30–10:30 | **Contratos de API** (un PR `docs:` cada quien) · Osvaldo empieza la hoja de respuestas |
| 10:30–13:30 | Backend + pruebas de cada parte · **~12:00: imprimir la hoja de respuestas** |
| 13:30–14:30 | Comida |
| 14:30–17:30 | Pantallas + pruebas · **probar el escaneo con la hoja impresa en celulares reales** |
| 17:30–18:30 | Integrar a `main` en orden · `npm run seed:reset` · prueba de punta a punta |
| 18:30–19:00 | Agentes `tester` → `auditor` → `experto-educacion` · lista de pendientes |

**Definición de "terminado"** (AGENTS.md): pruebas automatizadas, 360 px sin scroll horizontal, botones de 44 px, "% + etiqueta", sin lenguaje punitivo, contrato actualizado y PR revisado por otra persona.

---

## 7. Fuera de alcance (Roadmap)
- Alta de escuelas y directores desde el supervisor (por ahora, seed o script).
- Envío de invitaciones por correo (por ahora, código de escuela + aprobación).
- Promoción de grupos al siguiente ciclo y traslados entre escuelas.
- Selector para docentes con 2 o más grupos en celular (pendiente del PR #42; importante para **escuelas multigrado**).
