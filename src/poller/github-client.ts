import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { GitHubComment, GitHubIssue } from "../types/events.js";

const execFile = promisify(execFileCb);

export class GitHubClient {
  private readonly repo: string;

  constructor(repo: string) {
    this.repo = repo;
  }

  async listIssueComments(
    issueNumber: number,
    since?: string
  ): Promise<GitHubComment[]> {
    const endpoint = `repos/${this.repo}/issues/${issueNumber}/comments`;
    const args = ["api", endpoint, "--paginate"];

    if (since) {
      args.push("-f", `since=${since}`);
    }

    let stdout: string;
    try {
      ({ stdout } = await execFile("gh", args));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `gh api failed for issue #${issueNumber} comments: ${msg}`
      );
    }

    try {
      const parsed = JSON.parse(stdout);
      // --paginate returns concatenated JSON arrays; gh may wrap them in a single array
      if (Array.isArray(parsed)) {
        return parsed as GitHubComment[];
      }
      throw new Error("Unexpected response shape: expected an array");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to parse comment list for issue #${issueNumber}: ${msg}`
      );
    }
  }

  async createIssueComment(
    issueNumber: number,
    body: string
  ): Promise<number> {
    const endpoint = `repos/${this.repo}/issues/${issueNumber}/comments`;
    const args = ["api", endpoint, "--method", "POST", "-f", `body=${body}`];

    let stdout: string;
    try {
      ({ stdout } = await execFile("gh", args));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `gh api failed to create comment on issue #${issueNumber}: ${msg}`
      );
    }

    let parsed: { id?: unknown };
    try {
      parsed = JSON.parse(stdout);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to parse createIssueComment response for issue #${issueNumber}: ${msg}`
      );
    }

    if (typeof parsed.id !== "number") {
      throw new Error(
        `createIssueComment: unexpected response — "id" field missing or not a number`
      );
    }

    return parsed.id;
  }

  async getIssue(issueNumber: number): Promise<GitHubIssue> {
    const endpoint = `repos/${this.repo}/issues/${issueNumber}`;
    const args = ["api", endpoint];

    let stdout: string;
    try {
      ({ stdout } = await execFile("gh", args));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`gh api failed to get issue #${issueNumber}: ${msg}`);
    }

    try {
      return JSON.parse(stdout) as GitHubIssue;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to parse getIssue response for issue #${issueNumber}: ${msg}`
      );
    }
  }

  async createPullRequest(
    head: string,
    base: string,
    title: string,
    body: string
  ): Promise<number> {
    const args = [
      "pr",
      "create",
      "--repo",
      this.repo,
      "--head",
      head,
      "--base",
      base,
      "--title",
      title,
      "--body",
      body,
    ];

    let stdout: string;
    try {
      ({ stdout } = await execFile("gh", args));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `gh pr create failed (head=${head}, base=${base}): ${msg}`
      );
    }

    // gh pr create prints the PR URL, e.g.:
    //   https://github.com/{owner}/{repo}/pull/42
    const url = stdout.trim();
    const match = url.match(/\/pull\/(\d+)$/);
    if (!match) {
      throw new Error(
        `createPullRequest: could not parse PR number from gh output: "${url}"`
      );
    }

    return parseInt(match[1], 10);
  }
}
