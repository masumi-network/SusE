import { stripTrailingSlash } from "./utils/ids.js";

export type RuntimeMode = "stub" | "openrouter";
export type SpecialistMode = "stub" | "langdock";
export type StorageMode = "memory" | "postgres";

export type SpecialistAgentIds = {
  lexi: string;
  emilConrad: string;
  diddyP: string;
  foodCo2Analyst: string;
};

export type AppConfig = {
  port: number;
  publicBaseUrl: string;
  agentName: string;
  runtimeMode: RuntimeMode;
  specialistMode: SpecialistMode;
  storageMode: StorageMode;
  databaseUrl: string;
  openRouter: {
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxCompletionTokens: number;
    timeoutMs: number;
    siteUrl: string;
    appName: string;
  };
  langdock: {
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;
    agentIds: SpecialistAgentIds;
  };
  sokosumi: {
    apiUrl: string;
    coworkerApiKey: string;
    taskPollerEnabled: boolean;
    taskPollIntervalMs: number;
    taskPollLimit: number;
    taskPollMaxPages: number;
    taskCompletionCredits: number;
  };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = parsePort(env.PORT);
  const databaseUrl = env.DATABASE_URL || "";
  const storageMode = normalizeStorageMode(env.SUSE_STORAGE, databaseUrl);
  const agentName = env.SUSE_AGENT_NAME || "SuSE";
  const publicBaseUrl = stripTrailingSlash(env.SUSE_PUBLIC_BASE_URL || `http://localhost:${port}`);

  return {
    port,
    publicBaseUrl,
    agentName,
    runtimeMode: normalizeRuntimeMode(env.SUSE_RUNTIME_MODE),
    specialistMode: normalizeSpecialistMode(env.SUSE_SPECIALIST_MODE),
    storageMode,
    databaseUrl,
    openRouter: {
      apiKey: env.OPENROUTER_API_KEY || "",
      baseUrl: stripTrailingSlash(env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"),
      model: env.OPENROUTER_MODEL || "",
      temperature: parseNumber(env.OPENROUTER_TEMPERATURE, 0.2),
      maxCompletionTokens: parsePositiveInteger(env.OPENROUTER_MAX_COMPLETION_TOKENS, 1200),
      timeoutMs: parsePositiveInteger(env.OPENROUTER_TIMEOUT_MS, 30000),
      siteUrl: env.OPENROUTER_SITE_URL || publicBaseUrl,
      appName: env.OPENROUTER_APP_NAME || agentName
    },
    langdock: {
      apiKey: env.LANGDOCK_API_KEY || "",
      baseUrl: stripTrailingSlash(env.LANGDOCK_BASE_URL || "https://api.langdock.com"),
      timeoutMs: parsePositiveInteger(env.LANGDOCK_TIMEOUT_MS, 45000),
      agentIds: {
        lexi: env.LANGDOCK_AGENT_ID_LEXI || "",
        emilConrad: env.LANGDOCK_AGENT_ID_EMIL_CONRAD || "",
        diddyP: env.LANGDOCK_AGENT_ID_DIDDY_P || "",
        foodCo2Analyst: env.LANGDOCK_AGENT_ID_FOOD_CO2_ANALYST || ""
      }
    },
    sokosumi: {
      apiUrl: stripTrailingSlash(env.SOKOSUMI_API_URL || "https://api.preprod.sokosumi.com"),
      coworkerApiKey: env.SOKOSUMI_COWORKER_API_KEY || "",
      taskPollerEnabled: env.SOKOSUMI_TASK_POLLER_ENABLED === "true",
      taskPollIntervalMs: parsePositiveInteger(env.SOKOSUMI_TASK_POLL_INTERVAL_MS, 15000),
      taskPollLimit: parsePositiveInteger(env.SOKOSUMI_TASK_POLL_LIMIT, 20),
      taskPollMaxPages: parsePositiveInteger(env.SOKOSUMI_TASK_POLL_MAX_PAGES, 10),
      taskCompletionCredits: parseNumber(env.SOKOSUMI_TASK_COMPLETION_CREDITS, 0.1)
    }
  };
}

export function listMissingRequiredConfig(config: AppConfig): string[] {
  const missing: string[] = [];

  if (config.storageMode === "postgres" && !config.databaseUrl) {
    missing.push("DATABASE_URL");
  }

  if (config.runtimeMode === "openrouter") {
    if (!config.openRouter.apiKey) missing.push("OPENROUTER_API_KEY");
    if (!config.openRouter.model) missing.push("OPENROUTER_MODEL");
  }

  if (config.specialistMode === "langdock") {
    if (!config.langdock.apiKey) missing.push("LANGDOCK_API_KEY");
    for (const [name, value] of Object.entries(config.langdock.agentIds)) {
      if (!value) missing.push(toAgentEnvName(name));
    }
  }

  if (config.sokosumi.taskPollerEnabled && !config.sokosumi.coworkerApiKey) {
    missing.push("SOKOSUMI_COWORKER_API_KEY");
  }

  return missing;
}

function normalizeRuntimeMode(value?: string): RuntimeMode {
  if (!value || value === "stub") return "stub";
  if (value === "openrouter") return value;
  throw new Error(`Invalid SUSE_RUNTIME_MODE: ${value}`);
}

function normalizeSpecialistMode(value?: string): SpecialistMode {
  if (!value || value === "stub") return "stub";
  if (value === "langdock") return value;
  throw new Error(`Invalid SUSE_SPECIALIST_MODE: ${value}`);
}

function normalizeStorageMode(value: string | undefined, databaseUrl: string): StorageMode {
  if (value === "memory" || value === "postgres") return value;
  return databaseUrl ? "postgres" : "memory";
}

function toAgentEnvName(name: string): string {
  return `LANGDOCK_AGENT_ID_${name.replace(/[A-Z]/g, (match) => `_${match}`).toUpperCase()}`;
}

function parsePort(value?: string): number {
  const parsed = Number(value || 3000);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return parsed;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid positive integer: ${value}`);
  }
  return parsed;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
}
