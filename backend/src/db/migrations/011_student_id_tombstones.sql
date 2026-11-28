-- Un id de alumno eliminado nunca se vuelve a usar (revisión de #47, P1).
-- `students.id` es INTEGER PRIMARY KEY sin AUTOINCREMENT: si se elimina el alumno con el id más alto,
-- SQLite le daría ese mismo id al siguiente alumno, y una sesión del alumno eliminado (JWT con
-- `sub` = id) seguiría entrando como el alumno nuevo. Reconstruir `students` con AUTOINCREMENT
-- obligaría a rehacer todas las tablas que la referencian; en su lugar:
-- 1. cada id eliminado queda registrado aquí (lo hace el trigger, sin importar quién borre);
-- 2. el repositorio asigna ids nuevos por encima del mayor id usado o eliminado;
-- 3. red de seguridad: insertar un alumno con un id ya eliminado se rechaza.
CREATE TABLE IF NOT EXISTS deleted_student_ids (
  id         INTEGER PRIMARY KEY,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS students_record_deleted_id
AFTER DELETE ON students
BEGIN
  INSERT OR IGNORE INTO deleted_student_ids (id) VALUES (OLD.id);
END;

CREATE TRIGGER IF NOT EXISTS students_forbid_reused_id
AFTER INSERT ON students
WHEN EXISTS (SELECT 1 FROM deleted_student_ids WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'STUDENT_ID_REUSED');
END;
