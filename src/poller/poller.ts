import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { PilotConfig, RepoConfig } from "../types/config.js";
import type { PilotEvent, GitHubComment } from "../types/events.js";
import { parseComment } from "./event-parser.js";
import { PollStateRepository } from "../state/poll-state-repository.js";

const execFile = promisify(execFileCb);

export class Poller {
  private readonly config: PilotConfig;
  private readonly pollStateRepo: PollStateRepository;

  constructor(config: PilotConfig, pollStateRepo: PollStateRepository) {
    this.config = config;
    this.pollStateRepo = pollStateRepo;
  }

  async poll(): Promise<PilotEvent[]> {
    const allEvents: PilotEvent[] = [];

    for (const repo of this.config.repos) {
      try {
        const events = await this.pollRepo(repo);
        allEvents.push(...events);
      } catch (err) {
        console.error(
          `[Poller] Error polling ${repo.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return allEvents;
  }

  private async pollRepo(repo: RepoConfig): Promise<PilotEvent[]> {
    const lastPollAt = this.pollStateRepo.getLastPollAt(repo.name);

    const commentItems = await this.fetchIssueComments(repo.name, lastPollAt);
    console.log(
      `[Poller] ${repo.name}: fetched ${commentItems.length} comment(s) (since=${lastPollAt ?? "null"})`
    );

    const events: PilotEvent[] = [];
    let latestTimestamp = lastPollAt;

    for (const { issueNumber, comment } of commentItems) {
      // 가장 최신 댓글의 created_at을 poll_state로 사용
      if (!latestTimestamp || comment.created_at > latestTimestamp) {
        latestTimestamp = comment.created_at;
      }

      // 이미 처리한 댓글은 건너뛰기
      if (this.pollStateRepo.isCommentProcessed(comment.id)) {
        continue;
      }

      const event = parseComment(
        comment,
        repo.name,
        issueNumber,
        this.config.triggers,
        repo.allowed_authors
      );
      if (event) {
        events.push(event);
        this.pollStateRepo.markCommentProcessed(comment.id);
      }
    }

    // 댓글의 실제 created_at 기준으로 poll_state 업데이트
    if (latestTimestamp) {
      this.pollStateRepo.updateLastPollAt(repo.name, latestTimestamp);
    }

    if (events.length > 0) {
      console.log(`[Poller] ${repo.name}: found ${events.length} event(s)`);
    }

    return events;
  }

  /**
   * gh api repos/{owner}/{repo}/issues/comments 로 레포 전체 이슈 댓글을 가져온다.
   * sort=created&direction=asc로 오래된 것부터 가져와 누락 방지.
   */
  private async fetchIssueComments(
    repoName: string,
    since: string | null
  ): Promise<Array<{ issueNumber: number; comment: GitHubComment }>> {
    let endpoint = `repos/${repoName}/issues/comments?per_page=100&sort=created&direction=asc`;
    if (since) {
      endpoint += `&since=${encodeURIComponent(since)}`;
    }
    const args = ["api", endpoint, "--paginate"];

    let stdout: string;
    try {
      ({ stdout } = await execFile("gh", args));
    } catch (err) {
      throw new Error(
        `Failed to fetch issue comments for ${repoName}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // issue_url 형식: https://api.github.com/repos/{owner}/{repo}/issues/{number}
    return parsed
      .map((raw: Record<string, unknown>) => {
        const issueUrl = raw.issue_url as string;
        const match = issueUrl.match(/\/issues\/(\d+)$/);
        const issueNumber = match ? parseInt(match[1], 10) : 0;

        return {
          issueNumber,
          comment: {
            id: raw.id as number,
            body: raw.body as string,
            user: raw.user as { login: string },
            created_at: raw.created_at as string,
            html_url: raw.html_url as string,
          },
        };
      })
      .filter((item) => item.issueNumber > 0);
  }
}
