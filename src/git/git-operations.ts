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

    // 기존 로컬 브랜치가 있으면 삭제 후 재생성
    try {
      await execFile("git", ["branch", "-D", branchName], {
        cwd: this.repoPath,
      });
    } catch {
      // 브랜치가 없으면 무시
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

  async createWorktree(
    worktreePath: string,
    branchName: string,
    baseBranch: string
  ): Promise<void> {
    try {
      await execFile("git", ["fetch", "origin", baseBranch], {
        cwd: this.repoPath,
      });
    } catch (err) {
      throw new Error(
        `Failed to fetch origin/${baseBranch}: ${(err as Error).message}`
      );
    }

    // 기존 worktree가 남아있으면 정리
    try {
      await execFile("git", ["worktree", "remove", "--force", worktreePath], {
        cwd: this.repoPath,
      });
    } catch {
      // worktree가 없으면 무시
    }

    // 기존 로컬 브랜치가 있으면 삭제
    try {
      await execFile("git", ["branch", "-D", branchName], {
        cwd: this.repoPath,
      });
    } catch {
      // 브랜치가 없으면 무시
    }

    try {
      await execFile(
        "git",
        [
          "worktree",
          "add",
          "-b",
          branchName,
          worktreePath,
          `origin/${baseBranch}`,
        ],
        { cwd: this.repoPath }
      );
    } catch (err) {
      throw new Error(
        `Failed to create worktree at '${worktreePath}': ${(err as Error).message}`
      );
    }
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    try {
      await execFile("git", ["worktree", "remove", "--force", worktreePath], {
        cwd: this.repoPath,
      });
    } catch (err) {
      throw new Error(
        `Failed to remove worktree at '${worktreePath}': ${(err as Error).message}`
      );
    }
  }

  async commitAllIn(worktreePath: string, message: string): Promise<void> {
    try {
      await execFile("git", ["add", "-A"], { cwd: worktreePath });
    } catch (err) {
      throw new Error(
        `Failed to stage changes in worktree: ${(err as Error).message}`
      );
    }

    try {
      await execFile("git", ["commit", "-m", message], {
        cwd: worktreePath,
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
      throw new Error(`Failed to commit in worktree: ${error.message}`);
    }
  }

  async pushFrom(worktreePath: string, branchName: string): Promise<void> {
    try {
      await execFile("git", ["push", "-u", "origin", branchName], {
        cwd: worktreePath,
      });
    } catch (err) {
      throw new Error(
        `Failed to push from worktree: ${(err as Error).message}`
      );
    }
  }

  async hasChangesIn(worktreePath: string): Promise<boolean> {
    try {
      const { stdout } = await execFile("git", ["status", "--porcelain"], {
        cwd: worktreePath,
      });
      return stdout.trim().length > 0;
    } catch (err) {
      throw new Error(
        `Failed to check worktree status: ${(err as Error).message}`
      );
    }
  }
}
