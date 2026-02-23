import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export class GitOperations {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async createBranch(branchName: string, baseBranch: string): Promise<void> {
    try {
      await execFile("git", ["fetch", "origin", baseBranch], {
        cwd: this.repoPath,
      });
    } catch (err) {
      throw new Error(
        `Failed to fetch origin/${baseBranch}: ${(err as Error).message}`
      );
    }

    try {
      await execFile(
        "git",
        ["checkout", "-b", branchName, `origin/${baseBranch}`],
        { cwd: this.repoPath }
      );
    } catch (err) {
      throw new Error(
        `Failed to create branch '${branchName}' from origin/${baseBranch}: ${(err as Error).message}`
      );
    }
  }

  async commitAll(message: string): Promise<void> {
    try {
      await execFile("git", ["add", "-A"], { cwd: this.repoPath });
    } catch (err) {
      throw new Error(`Failed to stage changes: ${(err as Error).message}`);
    }

    try {
      await execFile("git", ["commit", "-m", message], {
        cwd: this.repoPath,
      });
    } catch (err) {
      const error = err as { code?: number; stderr?: string; message: string };
      if (
        error.code === 1 &&
        error.stderr &&
        error.stderr.includes("nothing to commit")
      ) {
        return;
      }
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  async push(branchName: string): Promise<void> {
    try {
      await execFile("git", ["push", "-u", "origin", branchName], {
        cwd: this.repoPath,
      });
    } catch (err) {
      throw new Error(
        `Failed to push branch '${branchName}': ${(err as Error).message}`
      );
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execFile(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: this.repoPath }
      );
      return stdout.trim();
    } catch (err) {
      throw new Error(
        `Failed to get current branch: ${(err as Error).message}`
      );
    }
  }

  async hasChanges(): Promise<boolean> {
    try {
      const { stdout } = await execFile("git", ["status", "--porcelain"], {
        cwd: this.repoPath,
      });
      return stdout.trim().length > 0;
    } catch (err) {
      throw new Error(`Failed to check git status: ${(err as Error).message}`);
    }
  }

  async checkout(branchName: string): Promise<void> {
    try {
      await execFile("git", ["checkout", branchName], { cwd: this.repoPath });
    } catch (err) {
      throw new Error(
        `Failed to checkout branch '${branchName}': ${(err as Error).message}`
      );
    }
  }
}
