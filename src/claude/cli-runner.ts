import { spawn } from "node:child_process";

const PLAN_TIMEOUT_MS = 600_000; // 10 minutes
const EXECUTE_TIMEOUT_MS = 1_800_000; // 30 minutes

interface ClaudeCliRunnerOptions {
  model: string;
}

export class ClaudeCliRunner {
  private readonly model: string;

  constructor(options: ClaudeCliRunnerOptions) {
    this.model = options.model;
  }

  runPlan(prompt: string, cwd: string): Promise<string> {
    const args = [
      "-p",
      prompt,
      "--model",
      this.model,
      "--allowedTools",
      "Read,Glob,Grep,WebFetch,WebSearch",
      "--output-format",
      "text",
    ];

    return this.runClaude(args, cwd, PLAN_TIMEOUT_MS);
  }

  runExecute(prompt: string, cwd: string, model?: string): Promise<string> {
    const args = [
      "-p",
      prompt,
      "--model",
      model ?? this.model,
      "--dangerously-skip-permissions",
      "--output-format",
      "text",
    ];

    return this.runClaude(args, cwd, EXECUTE_TIMEOUT_MS);
  }

  runVerify(prompt: string, cwd: string, model: string): Promise<string> {
    const args = [
      "-p",
      prompt,
      "--model",
      model,
      "--allowedTools",
      "Read,Glob,Grep",
      "--output-format",
      "text",
    ];

    return this.runClaude(args, cwd, PLAN_TIMEOUT_MS);
  }

  private runClaude(
    args: string[],
    cwd: string,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const child = spawn("claude", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(
          new Error(
            `Claude CLI timed out after ${timeoutMs / 1000}s.\nstderr: ${stderr}`,
          ),
        );
      }, timeoutMs);

      child.on("close", (code: number | null) => {
        clearTimeout(timer);

        if (code !== 0) {
          reject(
            new Error(
              `Claude CLI exited with code ${code}.\nstderr: ${stderr}`,
            ),
          );
          return;
        }

        resolve(stdout);
      });

      child.on("error", (err: Error) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
      });
    });
  }
}
