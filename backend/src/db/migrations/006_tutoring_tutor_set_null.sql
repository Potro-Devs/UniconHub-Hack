CREATE TABLE tutoring_pairs_replacement (
  id                    INTEGER PRIMARY KEY,
  session_id            INTEGER NOT NULL REFERENCES tutoring_sessions(id) ON DELETE CASCADE,
  tutor_student_id      INTEGER REFERENCES students(id) ON DELETE SET NULL,
  tutee_student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  target_error_tag      TEXT,
  tutor_overcame_error  INTEGER NOT NULL DEFAULT 0 CHECK (tutor_overcame_error IN (0, 1)),
  demo_correct          INTEGER CHECK (demo_correct IS NULL OR demo_correct BETWEEN 0 AND 3),
  demo_recorded_at      TEXT,
  UNIQUE (session_id, tutee_student_id),
  CHECK (tutor_student_id IS NULL OR tutor_student_id <> tutee_student_id),
  CHECK ((demo_correct IS NULL) = (demo_recorded_at IS NULL))
);

INSERT INTO tutoring_pairs_replacement
  (id, session_id, tutor_student_id, tutee_student_id, target_error_tag,
    tutor_overcame_error, demo_correct, demo_recorded_at)
SELECT id, session_id, tutor_student_id, tutee_student_id, target_error_tag,
    tutor_overcame_error, demo_correct, demo_recorded_at
FROM tutoring_pairs;

DROP TABLE tutoring_pairs;
ALTER TABLE tutoring_pairs_replacement RENAME TO tutoring_pairs;
CREATE INDEX idx_tutoring_pairs_session ON tutoring_pairs(session_id);
CREATE INDEX idx_tutoring_pairs_tutee ON tutoring_pairs(tutee_student_id);
