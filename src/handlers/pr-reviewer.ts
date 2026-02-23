import type { RepoConfig } from "../types/config.js";
import type { GitHubClient } from "../poller/github-client.js";
import type { ClaudeCliRunner } from "../claude/cli-runner.js";
import type { TaskRepository } from "../state/task-repository.js";

export class PrReviewer {
  constructor(
    private github: GitHubClient,
    private claude: ClaudeCliRunner,
    private taskRepo: TaskRepository,
    private repoConfig: RepoConfig
  ) {}

  /** Phase 2: PR 리뷰 반영 (--resume 세션 유지) */
  async handleReviewFeedback(prNumber: number, feedback: string): Promise<void> {
    console.log(`[PrReviewer] Phase 2 stub - PR #${prNumber} feedback: ${feedback.slice(0, 100)}`);
    // TODO: Phase 2 구현
    // 1. Claude CLI --resume 으로 기존 세션 이어서
    // 2. 리뷰 피드백 반영
    // 3. 추가 커밋 + push
  }
}
