-- Red de tutores ("todos enseñan algo"): sesiones de tutoría entre pares por habilidad.
-- La demostración del tutorado queda aquí y NO altera skill_mastery_history (dominio oficial).
CREATE TABLE IF NOT EXISTS tutoring_sessions (
  id          INTEGER PRIMARY KEY,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  skill_id    INTEGER NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT CHECK (note IS NULL OR length(note) <= 300),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tutoring_sessions_group ON tutoring_sessions(group_id, created_at);

-- Una fila por tutorado. `tutor_student_id` NULL = lo acompaña la maestra (mesa docente).
CREATE TABLE IF NOT EXISTS tutoring_pairs (
  id                    INTEGER PRIMARY KEY,
  session_id            INTEGER NOT NULL REFERENCES tutoring_sessions(id) ON DELETE CASCADE,
  tutor_student_id      INTEGER REFERENCES students(id) ON DELETE CASCADE,
  tutee_student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  target_error_tag      TEXT,
  tutor_overcame_error  INTEGER NOT NULL DEFAULT 0 CHECK (tutor_overcame_error IN (0, 1)),
  demo_correct          INTEGER CHECK (demo_correct IS NULL OR demo_correct BETWEEN 0 AND 3),
  demo_recorded_at      TEXT,
  UNIQUE (session_id, tutee_student_id),
  CHECK (tutor_student_id IS NULL OR tutor_student_id <> tutee_student_id),
  CHECK ((demo_correct IS NULL) = (demo_recorded_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_tutoring_pairs_session ON tutoring_pairs(session_id);
CREATE INDEX IF NOT EXISTS idx_tutoring_pairs_tutee ON tutoring_pairs(tutee_student_id);
