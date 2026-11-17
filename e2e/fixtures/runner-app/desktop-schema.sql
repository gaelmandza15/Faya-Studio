-- E2E Runner — deterministic schema for the Playwright harness.
-- Idempotent: applied at every launch.

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);

INSERT OR IGNORE INTO tasks (id, title, done) VALUES
  (1, 'Préparer la livraison', 0),
  (2, 'Relancer le client', 0),
  (3, 'Archiver le dossier', 1);
