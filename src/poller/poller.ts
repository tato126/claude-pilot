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

  /**
   * 모든 레포의 이슈 댓글을 폴링하여 이벤트 목록을 반환한다.
   * 각 레포마다 마지막 폴링 시점 이후의 댓글만 가져온다.
   */
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
    const now = new Date().toISOString();

    const commentItems = await this.fetchIssueComments(repo.name, lastPollAt);

    const events: PilotEvent[] = [];
    for (const { issueNumber, comment } of commentItems) {
      const event = parseComment(
        comment,
        repo.name,
        issueNumber,
        this.config.triggers,
        repo.allowed_authors
      );
      if (event) {
        events.push(event);
      }
    }

    this.pollStateRepo.updateLastPollAt(repo.name, now);

    if (events.length > 0) {
      console.log(`[Poller] ${repo.name}: found ${events.length} event(s)`);
    }

    return events;
  }

  /**
   * gh api repos/{owner}/{repo}/issues/comments 로 레포 전체 이슈 댓글을 가져온다.
   * issue_url 필드에서 이슈 번호를 파싱한다.
   */
  private async fetchIssueComments(
    repoName: string,
    since: string | null
  ): Promise<Array<{ issueNumber: number; comment: GitHubComment }>> {
    let endpoint = `repos/${repoName}/issues/comments?per_page=30&sort=created&direction=desc`;
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
