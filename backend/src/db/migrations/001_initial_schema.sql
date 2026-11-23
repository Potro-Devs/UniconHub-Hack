-- 001 · Esquema inicial de Axi (AGENTS.md §6).
-- Reglas que la base de datos garantiza además de la capa de dominio:
--   * Nunca se almacena CURP; el historial se une por `students.internal_folio`.
--   * `outcome_status` coherente con la opción elegida y el nivel de pista usado (§4.2).
--   * Escala de dominio en intervalos estrictos de 25% (§4.3).
--   * `skill_mastery_history` es inmutable (§4.5).
--   * `completed_paper` implica `is_screen_locked = 1` (§4.9).

-- ───────────────────────── Escuela y usuarios ─────────────────────────

CREATE TABLE schools (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  cct         TEXT UNIQUE,                       -- Clave de Centro de Trabajo (opcional)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  school_id      INTEGER NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'director')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_school ON users(school_id);

-- ───────────────────────── Grupos y alumnos ─────────────────────────

CREATE TABLE groups (
  id           INTEGER PRIMARY KEY,
  school_id    INTEGER NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  teacher_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  grade        INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  section      TEXT NOT NULL,                    -- "A", "B", ...
  school_year  TEXT NOT NULL CHECK (school_year GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]'),
  join_code    TEXT NOT NULL UNIQUE CHECK (length(join_code) = 6),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, grade, section, school_year)
);
CREATE INDEX idx_groups_teacher ON groups(teacher_id);

CREATE TABLE students (
  id              INTEGER PRIMARY KEY,
  school_id       INTEGER NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  internal_folio  TEXT NOT NULL UNIQUE,          -- Une el historial longitudinal (sin CURP)
  first_names     TEXT NOT NULL,
  last_names      TEXT NOT NULL,
  initials        TEXT NOT NULL CHECK (length(initials) = 2 AND initials = upper(initials)),
  avatar_color    TEXT NOT NULL,                 -- Color de la paleta accesible
  avatar_id       TEXT,                          -- Tarjeta/avatar elegido (opcional)
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_students_school ON students(school_id);

CREATE TABLE group_enrollments (
  id           INTEGER PRIMARY KEY,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  enrolled_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at     TEXT,
  UNIQUE (group_id, student_id)
);
CREATE INDEX idx_enrollments_student ON group_enrollments(student_id);

-- ───────────────────────── Currículo SEP ─────────────────────────

CREATE TABLE skills (
  id    INTEGER PRIMARY KEY,
  code  TEXT NOT NULL UNIQUE CHECK (code IN (
          'fractions', 'multiplication', 'place_value', 'problem_solving', 'reading_comprehension')),
  name  TEXT NOT NULL
);

-- Jerarquía: Fase -> Grado -> Campo Formativo -> Contenido -> PDA -> Habilidad
CREATE TABLE curriculum_contents (
  id               INTEGER PRIMARY KEY,
  phase            INTEGER NOT NULL CHECK (phase BETWEEN 3 AND 5),
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  formative_field  TEXT NOT NULL CHECK (formative_field IN (
                     'lenguajes',
                     'saberes_pensamiento_cientifico',
                     'etica_naturaleza_sociedades',
                     'de_lo_humano_comunitario')),
  title            TEXT NOT NULL,
  pda              TEXT NOT NULL,                -- Proceso de Desarrollo de Aprendizaje
  skill_id         INTEGER REFERENCES skills(id) ON DELETE SET NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  -- Fase 3: 1.º–2.º · Fase 4: 3.º–4.º · Fase 5: 5.º–6.º
  CHECK (phase = (grade + 1) / 2 + 2)
);
CREATE INDEX idx_contents_grade ON curriculum_contents(grade, sort_order);
CREATE INDEX idx_contents_skill ON curriculum_contents(skill_id);

CREATE TABLE group_curriculum_progress (
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  content_id  INTEGER NOT NULL REFERENCES curriculum_contents(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'seen')),
  notes       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, content_id)
);

-- ───────────────────────── Banco de reactivos ─────────────────────────

CREATE TABLE questions (
  id          INTEGER PRIMARY KEY,
  skill_id    INTEGER NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  content_id  INTEGER REFERENCES curriculum_contents(id) ON DELETE SET NULL,
  grade       INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  stem        TEXT NOT NULL,
  -- Pistas graduadas (§4.6): ninguna puede revelar la respuesta correcta.
  hint_1      TEXT NOT NULL,                     -- Qué observar o preguntar
  hint_2      TEXT NOT NULL,                     -- Un paso operativo/conceptual
  hint_3      TEXT NOT NULL,                     -- Ejemplo parecido con otros datos
  difficulty  INTEGER NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_questions_skill_grade ON questions(skill_id, grade);

CREATE TABLE question_options (
  id                 INTEGER PRIMARY KEY,
  question_id        INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label              TEXT NOT NULL CHECK (label IN ('A', 'B', 'C', 'D')),
  text               TEXT NOT NULL,
  is_correct         INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  -- Cada distractor es un error típico etiquetado (§1.1).
  error_tag          TEXT,
  error_explanation  TEXT,
  UNIQUE (question_id, label),
  CHECK (
    (is_correct = 1 AND error_tag IS NULL AND error_explanation IS NULL) OR
    (is_correct = 0 AND error_tag IS NOT NULL AND error_explanation IS NOT NULL)
  )
);
-- Una sola opción correcta por reactivo.
CREATE UNIQUE INDEX idx_options_one_correct ON question_options(question_id) WHERE is_correct = 1;

-- ───────────────────────── Asignaciones ─────────────────────────

CREATE TABLE assignments (
  id          INTEGER PRIMARY KEY,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  modality    TEXT NOT NULL CHECK (modality IN ('screen', 'paper')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_assignments_group ON assignments(group_id);

CREATE TABLE assignment_questions (
  assignment_id  INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  question_id    INTEGER NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  position       INTEGER NOT NULL CHECK (position >= 1),
  PRIMARY KEY (assignment_id, question_id),
  UNIQUE (assignment_id, position)
);

CREATE TABLE assignment_targets (
  id                INTEGER PRIMARY KEY,
  assignment_id     INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending', 'in_progress', 'completed_screen', 'completed_paper')),
  is_screen_locked  INTEGER NOT NULL DEFAULT 0 CHECK (is_screen_locked IN (0, 1)),
  started_at        TEXT,
  completed_at      TEXT,
  UNIQUE (assignment_id, student_id),
  -- Bloqueo anti-duplicidad Pantalla vs. Papel (§4.9)
  CHECK (status <> 'completed_paper' OR is_screen_locked = 1)
);
CREATE INDEX idx_targets_student ON assignment_targets(student_id);

CREATE TABLE student_responses (
  id                    INTEGER PRIMARY KEY,
  assignment_target_id  INTEGER NOT NULL REFERENCES assignment_targets(id) ON DELETE CASCADE,
  question_id           INTEGER NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  selected_option_id    INTEGER REFERENCES question_options(id) ON DELETE RESTRICT,
  outcome_status        TEXT NOT NULL CHECK (outcome_status IN (
                          'correct_autonomous', 'achieved_with_support', 'incorrect', 'unanswered')),
  max_hint_level_used   INTEGER NOT NULL DEFAULT 0 CHECK (max_hint_level_used BETWEEN 0 AND 3),
  error_tag             TEXT,
  source                TEXT NOT NULL CHECK (source IN ('screen', 'paper')),
  answered_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (assignment_target_id, question_id),
  -- Clasificación de respuestas (§4.2)
  CHECK (
    (outcome_status = 'correct_autonomous'    AND selected_option_id IS NOT NULL AND max_hint_level_used = 0  AND error_tag IS NULL) OR
    (outcome_status = 'achieved_with_support' AND selected_option_id IS NOT NULL AND max_hint_level_used >= 1 AND error_tag IS NULL) OR
    (outcome_status = 'incorrect'             AND selected_option_id IS NOT NULL AND error_tag IS NOT NULL) OR
    (outcome_status = 'unanswered'            AND selected_option_id IS NULL     AND error_tag IS NULL)
  )
);
CREATE INDEX idx_responses_question ON student_responses(question_id);

-- ───────────────────────── Dominio longitudinal ─────────────────────────

CREATE TABLE skill_mastery_history (
  id                     INTEGER PRIMARY KEY,
  student_id             INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  skill_id               INTEGER NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  assignment_id          INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  grade                  INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  session_index          INTEGER NOT NULL CHECK (session_index >= 1),   -- peso lineal w_i = i
  session_percentage     REAL NOT NULL CHECK (session_percentage BETWEEN 0 AND 100),
  autonomous_percentage  REAL NOT NULL CHECK (autonomous_percentage BETWEEN 0 AND 100),
  supported_percentage   REAL NOT NULL CHECK (supported_percentage BETWEEN 0 AND 100),
  mastery_percentage     REAL NOT NULL CHECK (mastery_percentage BETWEEN 0 AND 100),
  mastery_level          TEXT NOT NULL CHECK (mastery_level = CASE
                           WHEN mastery_percentage < 25 THEN 'needs_support'
                           WHEN mastery_percentage < 50 THEN 'in_progress'
                           WHEN mastery_percentage < 75 THEN 'achieved'
                           ELSE 'mastered' END),
  recorded_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, skill_id, session_index)
);
CREATE INDEX idx_mastery_student_skill ON skill_mastery_history(student_id, skill_id, session_index);

-- Cada corte deja un registro inmutable (§4.5).
CREATE TRIGGER trg_mastery_history_no_update
BEFORE UPDATE ON skill_mastery_history
BEGIN
  SELECT RAISE(ABORT, 'skill_mastery_history es inmutable');
END;

CREATE TRIGGER trg_mastery_history_no_delete
BEFORE DELETE ON skill_mastery_history
BEGIN
  SELECT RAISE(ABORT, 'skill_mastery_history es inmutable');
END;

CREATE TABLE student_achievements (
  id                INTEGER PRIMARY KEY,
  student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  achievement_code  TEXT NOT NULL,
  size              TEXT NOT NULL CHECK (size IN ('small', 'medium', 'large')),
  skill_id          INTEGER REFERENCES skills(id) ON DELETE SET NULL,
  assignment_id     INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  awarded_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_achievements_student ON student_achievements(student_id);

CREATE TABLE recommended_activities (
  id                INTEGER PRIMARY KEY,
  skill_id          INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  grade_min         INTEGER NOT NULL CHECK (grade_min BETWEEN 1 AND 6),
  grade_max         INTEGER NOT NULL CHECK (grade_max BETWEEN 1 AND 6),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  duration_minutes  INTEGER CHECK (duration_minutes > 0),
  grouping          TEXT,                        -- "En parejas", "Equipos de 3", ...
  materials         TEXT,
  target_error_tag  TEXT,                        -- Error típico que atiende (opcional)
  CHECK (grade_min <= grade_max)
);
CREATE INDEX idx_activities_skill ON recommended_activities(skill_id, grade_min, grade_max);
