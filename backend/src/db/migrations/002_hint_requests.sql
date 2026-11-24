-- 002 · Control en servidor de pistas solicitadas por destinatario y reactivo (AGENTS.md §4.2 y §4.6).
CREATE TABLE hint_requests (
  assignment_target_id  INTEGER NOT NULL REFERENCES assignment_targets(id) ON DELETE CASCADE,
  question_id           INTEGER NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  max_hint_level        INTEGER NOT NULL CHECK (max_hint_level BETWEEN 1 AND 3),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assignment_target_id, question_id)
);
