CREATE TABLE IF NOT EXISTS quiz_states (
  user_key TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_states_updated_at
ON quiz_states(updated_at);
