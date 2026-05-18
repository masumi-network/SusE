import type { AppConfig } from "../config.js";
import type { SokosumiClient, SokosumiTaskEventInput } from "./types.js";

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
        body: omitNonPositiveCredits(body)
      });
      return result.data;
    },

    async getDelegatedCredits({ userId, organizationId }) {
      const userPath = encodeURIComponent(userId);
      const path = organizationId
        ? `/v1/users/${userPath}/organizations/${encodeURIComponent(organizationId)}/credits`
        : `/v1/users/${userPath}/credits`;
      const result = await request(path, {
        headers: delegationHeaders(userId, organizationId)
      });
      return extractCreditsTotal(result);
    },

    async postUsage({ credits, idempotencyKey, referenceId, organizationId, userId }) {
      const result = await request("/v1/coworkers/me/usage", {
        method: "POST",
        body: {
          credits,
          idempotencyKey,
          referenceId,
          organizationId,
          userId
        }
      });
      return result.data;
    }
  };

  async function request(
    path: string,
    options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<Record<string, unknown>> {
    if (!config.sokosumi.coworkerApiKey) {
      throw new Error("SOKOSUMI_COWORKER_API_KEY is required for Task Board polling.");
    }

    const response = await fetchImpl(`${config.sokosumi.apiUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${config.sokosumi.coworkerApiKey}`,
        "Content-Type": "application/json",
        ...options.headers
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

function delegationHeaders(userId: string, organizationId?: string): Record<string, string> {
  return {
    "X-Delegation-User-Id": userId,
    ...(organizationId ? { "X-Delegation-Organization-Id": organizationId } : {})
  };
}

function omitNonPositiveCredits(body: SokosumiTaskEventInput): SokosumiTaskEventInput {
  if (body.credits === undefined || body.credits > 0) return body;
  const { credits: _credits, ...withoutCredits } = body;
  return withoutCredits;
}

function extractCreditsTotal(result: Record<string, unknown>): number {
  const data = isRecord(result.data) ? result.data : result;
  const credits = data.credits;
  if (typeof credits === "number") return credits;
  if (typeof credits === "string") return Number(credits) || 0;
  if (isRecord(credits)) {
    const total = credits.total;
    if (typeof total === "number") return total;
    if (typeof total === "string") return Number(total) || 0;
  }
  return 0;
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
