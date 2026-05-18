import type { AppConfig } from "../config.js";
import type { SokosumiClient } from "./types.js";

export function createHttpSokosumiClient({
  config,
  fetchImpl = fetch
}: {
  config: AppConfig;
  fetchImpl?: typeof fetch;
}): SokosumiClient {
  return {
    async listCoworkerEvents({ limit = config.sokosumi.taskPollLimit, cursor } = {}) {
      const search = new URLSearchParams({ limit: String(limit) });
      if (cursor) search.set("cursor", cursor);

      const result = await request(`/v1/coworkers/me/events?${search}`);
      return {
        events: Array.isArray(result.data) ? result.data : [],
        pagination: asPagination(result.meta)
      };
    },

    async getTask(taskId: string) {
      const result = await request(`/v1/tasks/${encodeURIComponent(taskId)}`);
      return isRecord(result.data) ? result.data : {};
    },

    async createTaskEvent(taskId: string, body) {
      const result = await request(`/v1/tasks/${encodeURIComponent(taskId)}/events`, {
        method: "POST",
        body
      });
      return result.data;
    }
  };

  async function request(path: string, options: { method?: string; body?: unknown } = {}): Promise<Record<string, unknown>> {
    if (!config.sokosumi.coworkerApiKey) {
      throw new Error("SOKOSUMI_COWORKER_API_KEY is required for Task Board polling.");
    }

    const response = await fetchImpl(`${config.sokosumi.apiUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${config.sokosumi.coworkerApiKey}`,
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const rawBody = await response.text();
    const payload = parseJson(rawBody);

    if (!response.ok) {
      const message =
        (isRecord(payload) && typeof payload.message === "string" ? payload.message : "") ||
        `Sokosumi request failed with ${response.status}`;
      throw new Error(`${message} (${response.status})`);
    }

    return isRecord(payload) ? payload : {};
  }
}

function asPagination(value: unknown): { nextCursor?: string } | undefined {
  if (!isRecord(value) || !isRecord(value.pagination)) return undefined;
  const nextCursor = value.pagination.nextCursor;
  return typeof nextCursor === "string" ? { nextCursor } : {};
}

function parseJson(value: string): unknown {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

