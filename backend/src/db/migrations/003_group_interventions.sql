-- Ciclo de acompañamiento: el docente registra que aplicó una actividad sugerida para
-- después comparar el error típico antes y después en una nueva prueba.
-- No guarda datos de alumnos: el antes y después se calcula desde student_responses.
CREATE TABLE group_interventions (
  id                INTEGER PRIMARY KEY,
  group_id          INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  activity_id       INTEGER NOT NULL REFERENCES recommended_activities(id) ON DELETE RESTRICT,
  skill_id          INTEGER NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  target_error_tag  TEXT,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note              TEXT CHECK (note IS NULL OR length(note) <= 300),
  response_cutoff_id INTEGER NOT NULL DEFAULT 0,
  applied_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_interventions_group ON group_interventions(group_id, applied_at);
