export interface PilotConfig {
  polling: PollingConfig;
  triggers: TriggerConfig;
  repos: RepoConfig[];
  claude: ClaudeConfig;
}

export interface PollingConfig {
  interval_seconds: number;
}

export interface TriggerConfig {
  mention: string;
  approve: string;
  reject: string;
  abort: string;
}

export interface RepoConfig {
  name: string;
  local_path: string;
  base_branch: string;
  allowed_authors: string[];
  verify_commands?: string[];
}

export interface ClaudeConfig {
  plan_model: string;
  execute_model: string;
  verify_model: string;
  review_model: string;
  max_verify_retries: number;
}
