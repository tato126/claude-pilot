import Database from "better-sqlite3";

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      issue_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'IDLE',
      plan_comment_id INTEGER,
      branch_name TEXT,
      pr_number INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(repo, issue_number)
    );

    CREATE TABLE IF NOT EXISTS poll_state (
      repo TEXT PRIMARY KEY,
      last_poll_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processed_comments (
      comment_id INTEGER PRIMARY KEY
    );
  `);

  return db;
}
