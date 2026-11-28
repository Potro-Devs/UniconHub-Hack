-- Imagen secreta del alumno (plan de acción fase 2, punto 4.2).
-- Evita que un alumno entre por error con la tarjeta de otro: después de elegir su tarjeta,
-- toca su imagen secreta. Se guarda solo el HMAC, nunca las imágenes elegidas.
ALTER TABLE students ADD COLUMN secret_hash TEXT;
ALTER TABLE students ADD COLUMN secret_set_at TEXT;

-- Ventana que abre la docente ("Hoy configuramos imágenes"): mientras esté abierta, un alumno
-- sin imagen puede elegirla. Fuera de ella, debe pedir ayuda a su maestra.
ALTER TABLE groups ADD COLUMN secret_setup_until TEXT;
