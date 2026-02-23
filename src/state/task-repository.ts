import type Database from "better-sqlite3";
import type { TaskRecord, TaskStatus } from "../types/state.js";
import { VALID_TRANSITIONS } from "../types/state.js";

export class TaskRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  findByIssue(repo: string, issueNumber: number): TaskRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM tasks WHERE repo = ? AND issue_number = ?`
      )
      .get(repo, issueNumber) as TaskRecord | undefined;

    return row ?? null;
  }

  create(repo: string, issueNumber: number): TaskRecord {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (repo, issue_number, status)
      VALUES (?, ?, 'IDLE')
    `);

    const result = stmt.run(repo, issueNumber);
    const id = result.lastInsertRowid as number;

    return this.db
      .prepare(`SELECT * FROM tasks WHERE id = ?`)
      .get(id) as TaskRecord;
  }

  updateStatus(id: number, status: TaskStatus): void {
    const current = this.db
      .prepare(`SELECT status FROM tasks WHERE id = ?`)
      .get(id) as { status: TaskStatus } | undefined;

    if (!current) {
      throw new Error(`Task not found: id=${id}`);
    }

    const allowed = VALID_TRANSITIONS[current.status];
    if (!allowed.includes(status)) {
      throw new Error(
        `Invalid state transition: ${current.status} -> ${status}`
      );
    }

    this.db
      .prepare(
        `UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(status, id);
  }

  updatePlanCommentId(id: number, commentId: number): void {
    this.db
      .prepare(
        `UPDATE tasks SET plan_comment_id = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(commentId, id);
  }

  updateBranch(id: number, branchName: string): void {
    this.db
      .prepare(
        `UPDATE tasks SET branch_name = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(branchName, id);
  }

  updatePrNumber(id: number, prNumber: number): void {
    this.db
      .prepare(
        `UPDATE tasks SET pr_number = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(prNumber, id);
  }

  findActive(): TaskRecord[] {
    return this.db
      .prepare(`SELECT * FROM tasks WHERE status != 'COMPLETED'`)
      .all() as TaskRecord[];
  }
}
