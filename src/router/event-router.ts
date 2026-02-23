import type { PilotEvent } from "../types/events.js";
import type { TaskRecord } from "../types/state.js";
import type { TaskRepository } from "../state/task-repository.js";
import type { PlanGenerator } from "../handlers/plan-generator.js";
import type { CodeExecutor } from "../handlers/code-executor.js";

export class EventRouter {
  constructor(
    private taskRepo: TaskRepository,
    private planGenerator: PlanGenerator,
    private codeExecutor: CodeExecutor
  ) {}

  async route(event: PilotEvent): Promise<void> {
    console.log(`[Router] Routing event: type=${event.type} repo=${event.repo} issue=${event.issue_number}`);

    switch (event.type) {
      case "mention":
        await this.handleMention(event);
        break;
      case "approve":
        await this.handleApprove(event);
        break;
      case "reject":
        await this.handleReject(event);
        break;
      case "abort":
        await this.handleAbort(event);
        break;
      default:
        console.log(`[Router] Unknown event type: ${(event as PilotEvent).type}`);
    }
  }

  private async handleMention(event: PilotEvent): Promise<void> {
    const existing = this.taskRepo.findByIssue(event.repo, event.issue_number);

    if (existing && existing.status !== "COMPLETED" && existing.status !== "REJECTED") {
      console.log(`[Router] Task already in progress: id=${existing.id} status=${existing.status}`);
      return;
    }

    let task: TaskRecord;
    if (!existing || existing.status === "COMPLETED") {
      task = this.taskRepo.create(event.repo, event.issue_number);
      console.log(`[Router] Created new task: id=${task.id}`);
    } else {
      // status === "REJECTED"
      task = existing;
    }

    this.taskRepo.updateStatus(task.id, "PLANNING");
    console.log(`[Router] Task status updated to PLANNING: id=${task.id}`);

    try {
      const updatedTask = this.taskRepo.findByIssue(event.repo, event.issue_number)!;
      await this.planGenerator.generate(event, updatedTask);
    } catch (err) {
      console.log(`[Router] Error in planGenerator.generate: ${err}`);
    }
  }

  private async handleApprove(event: PilotEvent): Promise<void> {
    const task = this.taskRepo.findByIssue(event.repo, event.issue_number);

    if (!task) {
      console.log(`[Router] Warning: no task found for approve event repo=${event.repo} issue=${event.issue_number}`);
      return;
    }

    if (task.status !== "PLAN_PENDING" && task.status !== "FAILED") {
      console.log(`[Router] Warning: approve event received but task status is ${task.status}, expected PLAN_PENDING or FAILED. Skipping.`);
      return;
    }

    if (task.status === "FAILED") {
      this.taskRepo.resetRetry(task.id);
      console.log(`[Router] Retrying failed task: id=${task.id} — retry count reset`);
    }

    this.taskRepo.updateStatus(task.id, "EXECUTING");
    console.log(`[Router] Task status updated to EXECUTING: id=${task.id}`);

    try {
      const updatedTask = this.taskRepo.findByIssue(event.repo, event.issue_number)!;
      await this.codeExecutor.execute(event, updatedTask);
    } catch (err) {
      console.log(`[Router] Error in codeExecutor.execute: ${err}`);
    }
  }

  private async handleReject(event: PilotEvent): Promise<void> {
    const task = this.taskRepo.findByIssue(event.repo, event.issue_number);

    if (!task) {
      console.log(`[Router] Warning: no task found for reject event repo=${event.repo} issue=${event.issue_number}`);
      return;
    }

    if (task.status !== "PLAN_PENDING") {
      console.log(`[Router] Warning: reject event received but task status is ${task.status}, expected PLAN_PENDING. Skipping.`);
      return;
    }

    this.taskRepo.updateStatus(task.id, "REJECTED");
    console.log(`[Router] Task status updated to REJECTED: id=${task.id}`);

    this.taskRepo.updateStatus(task.id, "PLANNING");
    console.log(`[Router] Task status updated to PLANNING (re-plan after rejection): id=${task.id}`);

    try {
      const updatedTask = this.taskRepo.findByIssue(event.repo, event.issue_number)!;
      await this.planGenerator.generate(event, updatedTask);
    } catch (err) {
      console.log(`[Router] Error in planGenerator.generate (re-plan): ${err}`);
    }
  }

  private async handleAbort(event: PilotEvent): Promise<void> {
    const task = this.taskRepo.findByIssue(event.repo, event.issue_number);

    if (!task) {
      console.log(`[Router] Abort event: no task found for repo=${event.repo} issue=${event.issue_number}`);
      return;
    }

    if (task.status !== "COMPLETED") {
      this.taskRepo.updateStatus(task.id, "COMPLETED");
      console.log(`[Router] Task aborted and marked as COMPLETED: id=${task.id}`);
    } else {
      console.log(`[Router] Abort event: task already COMPLETED: id=${task.id}`);
    }
  }
}
