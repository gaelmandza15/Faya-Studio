CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO contacts (name, email, phone)
SELECT 'Amina Diallo', 'amina.diallo@example.com', '06 12 34 56 78'
WHERE (SELECT COUNT(*) FROM contacts) = 0;

INSERT INTO contacts (name, email, phone)
SELECT 'Moussa Traoré', 'moussa.traore@example.com', '07 98 76 54 32'
WHERE (SELECT COUNT(*) FROM contacts) = 0;

INSERT INTO contacts (name, email, phone)
SELECT 'Claire Martin', 'claire.martin@example.com', '06 44 55 66 77'
WHERE (SELECT COUNT(*) FROM contacts) = 0;
