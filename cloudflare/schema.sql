CREATE TABLE IF NOT EXISTS quiz_states (
  user_key TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_states_updated_at
ON quiz_states(updated_at);

CREATE TABLE IF NOT EXISTS quiz_progress (
  user_key TEXT PRIMARY KEY,
  current_index INTEGER NOT NULL DEFAULT 0,
  current_question_id TEXT,
  current_tab TEXT NOT NULL DEFAULT 'practice',
  current_filter TEXT NOT NULL DEFAULT 'all',
  current_chapter TEXT NOT NULL DEFAULT 'all',
  current_section TEXT NOT NULL DEFAULT 'all',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  user_key TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_json TEXT NOT NULL DEFAULT '[]',
  submitted INTEGER NOT NULL DEFAULT 0,
  is_correct INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_key, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_user
ON quiz_answers(user_key);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_updated_at
ON quiz_answers(updated_at);
