export type TaskStatus =
  | "IDLE"
  | "PLANNING"
  | "PLAN_PENDING"
  | "EXECUTING"
  | "VERIFYING"
  | "PR_CREATED"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export interface TaskRecord {
  id: number;
  repo: string;
  issue_number: number;
  status: TaskStatus;
  plan_comment_id: number | null;
  branch_name: string | null;
  pr_number: number | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PollState {
  repo: string;
  last_poll_at: string;
}

/** 유효한 상태 전이 맵 — COMPLETED는 abort용으로 모든 활성 상태에서 허용 */
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  IDLE: ["PLANNING", "COMPLETED"],
  PLANNING: ["PLAN_PENDING", "COMPLETED"],
  PLAN_PENDING: ["EXECUTING", "REJECTED", "COMPLETED"],
  EXECUTING: ["VERIFYING", "COMPLETED"],
  VERIFYING: ["EXECUTING", "PR_CREATED", "FAILED", "COMPLETED"],
  PR_CREATED: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: ["PLANNING", "COMPLETED"],
  FAILED: ["EXECUTING", "COMPLETED"],
};
