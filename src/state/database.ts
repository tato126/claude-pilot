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
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
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

  migrateSchema(db);

  return db;
}

function migrateSchema(db: Database.Database): void {
  const version = db.pragma("user_version", { simple: true }) as number;

  if (version < 1) {
    // v1: retry_count, last_error 컬럼 추가 (기존 DB 마이그레이션)
    const columns = db
      .prepare("PRAGMA table_info(tasks)")
      .all() as { name: string }[];
    const columnNames = columns.map((c) => c.name);

    if (!columnNames.includes("retry_count")) {
      db.exec(
        "ALTER TABLE tasks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!columnNames.includes("last_error")) {
      db.exec("ALTER TABLE tasks ADD COLUMN last_error TEXT");
    }

    db.pragma("user_version = 1");
  }
}
