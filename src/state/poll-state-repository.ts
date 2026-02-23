import type Database from "better-sqlite3";

export class PollStateRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getLastPollAt(repo: string): string | null {
    const row = this.db
      .prepare(`SELECT last_poll_at FROM poll_state WHERE repo = ?`)
      .get(repo) as { last_poll_at: string } | undefined;

    return row?.last_poll_at ?? null;
  }

  updateLastPollAt(repo: string, timestamp: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO poll_state (repo, last_poll_at) VALUES (?, ?)`
      )
      .run(repo, timestamp);
  }

  isCommentProcessed(commentId: number): boolean {
    const row = this.db
      .prepare(`SELECT 1 FROM processed_comments WHERE comment_id = ?`)
      .get(commentId);
    return !!row;
  }

  markCommentProcessed(commentId: number): void {
    this.db
      .prepare(`INSERT OR IGNORE INTO processed_comments (comment_id) VALUES (?)`)
      .run(commentId);
  }
}
