-- 004 · Cuestionarios reutilizables y constructor tipo Kahoot!
-- Permite almacenar cuestionarios propios de docentes, compartidos en la escuela
-- y precargados del sistema, con reactivos de opción múltiple, verdadero/falso
-- o completar la frase.

CREATE TABLE quizzes (
  id           INTEGER PRIMARY KEY,
  school_id    INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  created_by   INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  origin_type  TEXT NOT NULL CHECK (origin_type IN ('teacher', 'system')),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  skill_id     INTEGER NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  grade        INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (origin_type = 'system' AND created_by IS NULL) OR
    (origin_type = 'teacher' AND created_by IS NOT NULL AND school_id IS NOT NULL)
  )
);

CREATE INDEX idx_quizzes_school ON quizzes(school_id, grade);
CREATE INDEX idx_quizzes_creator ON quizzes(created_by);
CREATE INDEX idx_quizzes_skill ON quizzes(skill_id, grade);

CREATE TABLE quiz_questions (
  id              INTEGER PRIMARY KEY,
  quiz_id         INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL CHECK (position >= 1),
  question_type   TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank')),
  prompt          TEXT NOT NULL,
  options_json    TEXT NOT NULL DEFAULT '[]',
  correct_answer  TEXT NOT NULL,
  hint            TEXT NOT NULL DEFAULT '',
  UNIQUE (quiz_id, position)
);

CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id, position);
