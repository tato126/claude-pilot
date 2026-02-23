import type { PilotEvent } from "../types/events.js";
import type { TaskRecord } from "../types/state.js";
import type { RepoConfig } from "../types/config.js";
import type { GitHubClient } from "../poller/github-client.js";
import type { ClaudeCliRunner } from "../claude/cli-runner.js";
import type { TaskRepository } from "../state/task-repository.js";

export class PlanGenerator {
  constructor(
    private github: GitHubClient,
    private claude: ClaudeCliRunner,
    private taskRepo: TaskRepository,
    private repoConfig: RepoConfig
  ) {}

  async generate(event: PilotEvent, task: TaskRecord): Promise<void> {
    console.log(
      `[PlanGenerator] Generating plan for issue #${event.issue_number} (task id=${task.id})`
    );

    const issue = await this.github.getIssue(event.issue_number);
    console.log(`[PlanGenerator] Fetched issue: "${issue.title}"`);

    const isRePlan = task.status === "REJECTED";
    const rejectionFeedback = isRePlan ? event.body : null;

    const prompt = this.buildPrompt(issue.title, issue.body, rejectionFeedback);

    console.log(
      `[PlanGenerator] Running Claude plan (re-plan=${isRePlan}, cwd=${this.repoConfig.local_path})`
    );
    const planContent = await this.claude.runPlan(
      prompt,
      this.repoConfig.local_path
    );
    console.log(`[PlanGenerator] Claude plan complete (${planContent.length} chars)`);

    const formattedComment = this.formatComment(planContent);

    const commentId = await this.github.createIssueComment(
      event.issue_number,
      formattedComment
    );
    console.log(
      `[PlanGenerator] Posted plan comment id=${commentId} on issue #${event.issue_number}`
    );

    this.taskRepo.updatePlanCommentId(task.id, commentId);
    this.taskRepo.updateStatus(task.id, "PLAN_PENDING");
    console.log(
      `[PlanGenerator] Task id=${task.id} updated: plan_comment_id=${commentId}, status=PLAN_PENDING`
    );
  }

  private buildPrompt(
    issueTitle: string,
    issueBody: string,
    rejectionFeedback: string | null
  ): string {
    const lines: string[] = [];

    lines.push("You are a senior software engineer reviewing a GitHub issue.");
    lines.push(
      "Analyze the codebase and produce a concrete implementation plan."
    );
    lines.push("");
    lines.push("## Issue");
    lines.push(`**Title:** ${issueTitle}`);
    lines.push("");
    lines.push("**Description:**");
    lines.push(issueBody ?? "(no description provided)");

    if (rejectionFeedback) {
      lines.push("");
      lines.push("## Previous Plan Was Rejected");
      lines.push(
        "The previous implementation plan was rejected. Please address the following feedback:"
      );
      lines.push("");
      lines.push(rejectionFeedback);
    }

    lines.push("");
    lines.push("## Instructions");
    lines.push(
      "- Read the project's CLAUDE.md file (and any docs it references) to understand conventions and constraints."
    );
    lines.push(
      "- Explore the codebase structure relevant to this issue before forming a plan."
    );
    lines.push("- Produce an implementation plan that includes:");
    lines.push("  1. **Files to modify** (list each file with a brief reason)");
    lines.push(
      "  2. **Approach** (step-by-step description of the changes to make)"
    );
    lines.push(
      "  3. **Potential risks** (edge cases, breaking changes, or areas that need extra care)"
    );
    lines.push(
      "- Be specific and actionable. The plan will be reviewed by a human before implementation begins."
    );
    lines.push(
      "- Do NOT write any code or modify any files — this is a read-only planning step."
    );

    return lines.join("\n");
  }

  private formatComment(planContent: string): string {
    const lines: string[] = [];

    lines.push("## 📋 Implementation Plan");
    lines.push("");
    lines.push(planContent.trim());
    lines.push("");
    lines.push(
      "> Reply `/approve` to start implementation, `/reject [feedback]` to request changes."
    );
    lines.push("");
    lines.push("<!-- claude-pilot -->");

    return lines.join("\n");
  }
}
