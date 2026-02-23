import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { ClaudeConfig } from "../types/config.js";
import type { ClaudeCliRunner } from "../claude/cli-runner.js";

const execFile = promisify(execFileCallback);

export interface VerifyResult {
  success: boolean;
  errors: string[];
}

export class VerificationRunner {
  private config: ClaudeConfig;
  private claude: ClaudeCliRunner;

  constructor(config: ClaudeConfig, claude: ClaudeCliRunner) {
    this.config = config;
    this.claude = claude;
  }

  async runVerifyCommands(
    worktreePath: string,
    commands: string[]
  ): Promise<VerifyResult> {
    const errors: string[] = [];

    for (const command of commands) {
      try {
        const [cmd, ...args] = command.split(/\s+/);
        await execFile(cmd, args, {
          cwd: worktreePath,
          timeout: 120_000,
          env: { ...process.env },
        });
      } catch (err) {
        const error = err as {
          stderr?: string;
          stdout?: string;
          message: string;
        };
        const errorOutput =
          error.stderr || error.stdout || error.message;
        errors.push(`Command \`${command}\` failed:\n${errorOutput}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  async analyzeErrors(
    errors: string[],
    issueContext: string
  ): Promise<string> {
    const prompt = [
      "You are analyzing build/test errors to provide fix instructions.",
      "",
      "## Issue Context",
      issueContext,
      "",
      "## Errors",
      ...errors.map((e, i) => `### Error ${i + 1}\n${e}`),
      "",
      "## Instructions",
      "Analyze the errors above and provide specific, actionable fix instructions.",
      "Focus on the root cause and exact code changes needed.",
      "Be concise and precise — the output will be passed directly to a code generation model.",
    ].join("\n");

    return this.claude.runVerify(prompt, "/tmp", this.config.verify_model);
  }

  async applyFix(
    worktreePath: string,
    fixInstructions: string
  ): Promise<string> {
    const prompt = [
      "Apply the following fix instructions to the codebase.",
      "Make only the changes described — do not add unrelated modifications.",
      "",
      "## Fix Instructions",
      fixInstructions,
    ].join("\n");

    return this.claude.runExecute(
      prompt,
      worktreePath,
      this.config.execute_model
    );
  }
}
