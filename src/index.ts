import { loadConfig } from "./config.js";
import { initDatabase } from "./state/database.js";
import { TaskRepository } from "./state/task-repository.js";
import { PollStateRepository } from "./state/poll-state-repository.js";
import { GitHubClient } from "./poller/github-client.js";
import { Poller } from "./poller/poller.js";
import { EventRouter } from "./router/event-router.js";
import { ClaudeCliRunner } from "./claude/cli-runner.js";
import { GitOperations } from "./git/git-operations.js";
import { PlanGenerator } from "./handlers/plan-generator.js";
import { CodeExecutor } from "./handlers/code-executor.js";
import { PrReviewer } from "./handlers/pr-reviewer.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  console.log("[Pilot] claude-pilot starting...");

  // 1. 설정 로딩
  const config = loadConfig();
  console.log(
    `[Pilot] Config loaded: ${config.repos.length} repo(s), poll interval ${config.polling.interval_seconds}s`
  );

  // 2. SQLite 초기화
  const dbPath = resolve(__dirname, "../data/pilot.db");
  mkdirSync(resolve(__dirname, "../data"), { recursive: true });
  const db = initDatabase(dbPath);
  console.log(`[Pilot] Database initialized: ${dbPath}`);

  const taskRepo = new TaskRepository(db);
  const pollStateRepo = new PollStateRepository(db);

  // 3. 첫 번째 레포 기준으로 핸들러 구성 (Phase 1: 단일 레포)
  const repoConfig = config.repos[0];

  const github = new GitHubClient(repoConfig.name);
  const git = new GitOperations(repoConfig.local_path);

  const planClaude = new ClaudeCliRunner({ model: config.claude.plan_model });
  const executeClaude = new ClaudeCliRunner({ model: config.claude.execute_model });
  const reviewClaude = new ClaudeCliRunner({ model: config.claude.review_model });

  const planGenerator = new PlanGenerator(github, planClaude, taskRepo, repoConfig);
  const codeExecutor = new CodeExecutor(github, executeClaude, taskRepo, git, repoConfig);
  const _prReviewer = new PrReviewer(github, reviewClaude, taskRepo, repoConfig);

  // 4. 라우터 + 폴러 구성
  const router = new EventRouter(taskRepo, planGenerator, codeExecutor);
  const poller = new Poller(config, pollStateRepo);

  // 5. Graceful shutdown
  let running = true;
  const shutdown = () => {
    console.log("\n[Pilot] Shutting down...");
    running = false;
    db.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // 6. 메인 폴링 루프
  console.log("[Pilot] Entering poll loop...");
  while (running) {
    try {
      const events = await poller.poll();
      for (const event of events) {
        await router.route(event);
      }
    } catch (err) {
      console.error(
        `[Pilot] Poll loop error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // 다음 폴링까지 대기
    await sleep(config.polling.interval_seconds * 1000, () => running);
  }

  console.log("[Pilot] Stopped.");
}

/**
 * running 상태를 체크하면서 대기한다.
 * shutdown 시 즉시 깨어나기 위해 짧은 간격으로 체크.
 */
function sleep(ms: number, isRunning: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const interval = 1000; // 1초 간격 체크
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      if (elapsed >= ms || !isRunning()) {
        clearInterval(timer);
        resolve();
      }
    }, interval);
  });
}

main().catch((err) => {
  console.error(`[Pilot] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
