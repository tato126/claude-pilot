import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import type {
  PilotConfig,
  PollingConfig,
  TriggerConfig,
  RepoConfig,
  ClaudeConfig,
} from './types/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load and validate the pilot configuration from config.yaml
 * @returns Validated PilotConfig object
 * @throws Error if config file not found or validation fails
 */
export function loadConfig(): PilotConfig {
  const configPath = resolve(__dirname, '../config.yaml');

  // Read the YAML file
  let rawConfig: Record<string, unknown>;
  try {
    const fileContent = readFileSync(configPath, 'utf-8');
    rawConfig = YAML.parse(fileContent) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Failed to read config.yaml from ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate and extract polling config
  const polling = validatePollingConfig(rawConfig.polling);

  // Validate and extract triggers config
  const triggers = validateTriggerConfig(rawConfig.triggers);

  // Validate and extract repos config
  const repos = validateReposConfig(rawConfig.repos);

  // Validate and extract claude config
  const claude = validateClaudeConfig(rawConfig.claude);

  return {
    polling,
    triggers,
    repos,
    claude,
  };
}

function validatePollingConfig(config: unknown): PollingConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Missing or invalid polling configuration');
  }

  const pollingObj = config as Record<string, unknown>;
  const interval = pollingObj.interval_seconds;

  if (typeof interval !== 'number' || interval <= 0) {
    throw new Error('polling.interval_seconds must be a positive number');
  }

  return { interval_seconds: interval };
}

function validateTriggerConfig(config: unknown): TriggerConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Missing or invalid triggers configuration');
  }

  const triggersObj = config as Record<string, unknown>;
  const required = ['mention', 'approve', 'reject', 'abort'] as const;

  for (const field of required) {
    if (typeof triggersObj[field] !== 'string') {
      throw new Error(`triggers.${field} must be a string`);
    }
  }

  return {
    mention: triggersObj.mention as string,
    approve: triggersObj.approve as string,
    reject: triggersObj.reject as string,
    abort: triggersObj.abort as string,
  };
}

function validateReposConfig(config: unknown): RepoConfig[] {
  if (!Array.isArray(config)) {
    throw new Error('repos must be an array');
  }

  if (config.length === 0) {
    throw new Error('repos must have at least 1 entry');
  }

  return config.map((repo, index) => {
    if (!repo || typeof repo !== 'object') {
      throw new Error(`repos[${index}] is not an object`);
    }

    const repoObj = repo as Record<string, unknown>;

    if (typeof repoObj.name !== 'string' || !repoObj.name.trim()) {
      throw new Error(`repos[${index}].name must be a non-empty string`);
    }

    if (typeof repoObj.local_path !== 'string' || !repoObj.local_path.trim()) {
      throw new Error(`repos[${index}].local_path must be a non-empty string`);
    }

    if (typeof repoObj.base_branch !== 'string' || !repoObj.base_branch.trim()) {
      throw new Error(`repos[${index}].base_branch must be a non-empty string`);
    }

    if (!Array.isArray(repoObj.allowed_authors)) {
      throw new Error(`repos[${index}].allowed_authors must be an array`);
    }

    if (
      !repoObj.allowed_authors.every((author) => typeof author === 'string' && author.trim())
    ) {
      throw new Error(`repos[${index}].allowed_authors must contain only non-empty strings`);
    }

    return {
      name: repoObj.name as string,
      local_path: repoObj.local_path as string,
      base_branch: repoObj.base_branch as string,
      allowed_authors: repoObj.allowed_authors as string[],
    };
  });
}

function validateClaudeConfig(config: unknown): ClaudeConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Missing or invalid claude configuration');
  }

  const claudeObj = config as Record<string, unknown>;
  const required = ['plan_model', 'execute_model', 'review_model'] as const;

  for (const field of required) {
    if (typeof claudeObj[field] !== 'string' || !claudeObj[field]) {
      throw new Error(`claude.${field} must be a non-empty string`);
    }
  }

  return {
    plan_model: claudeObj.plan_model as string,
    execute_model: claudeObj.execute_model as string,
    review_model: claudeObj.review_model as string,
  };
}
