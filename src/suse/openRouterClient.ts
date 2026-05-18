import type { AppConfig } from "../config.js";

export type OpenRouterCompletion = {
  reply: string;
  id?: string;
  model: string;
  usage?: unknown;
};

export async function createOpenRouterChatReply({
  config,
  messages,
  fetchImpl = fetch
}: {
  config: AppConfig;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  fetchImpl?: typeof fetch;
}): Promise<OpenRouterCompletion> {
  if (!config.openRouter.apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for OpenRouter runtime.");
  }
  if (!config.openRouter.model) {
    throw new Error("OPENROUTER_MODEL is required for OpenRouter runtime.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.openRouter.timeoutMs);

  try {
    const response = await fetchImpl(`${config.openRouter.baseUrl}/chat/completions`, {
      method: "POST",
      headers: openRouterHeaders(config),
      body: JSON.stringify({
        model: config.openRouter.model,
        messages,
        temperature: config.openRouter.temperature,
        max_completion_tokens: config.openRouter.maxCompletionTokens,
        stream: false
      }),
      signal: controller.signal
    });

    const rawBody = await response.text();
    const body = parseJson(rawBody);

    if (!response.ok) {
      throw new Error(formatOpenRouterError(response.status, body, rawBody));
    }

    const reply = extractReplyText(body);
    if (!reply) {
      throw new Error("OpenRouter response did not include assistant text.");
    }

    return {
      reply,
      id: isRecord(body) && typeof body.id === "string" ? body.id : undefined,
      model: isRecord(body) && typeof body.model === "string" ? body.model : config.openRouter.model,
      usage: isRecord(body) ? body.usage : undefined
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${config.openRouter.timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function openRouterHeaders(config: AppConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.openRouter.apiKey}`,
    "Content-Type": "application/json"
  };

  if (config.openRouter.siteUrl) headers["HTTP-Referer"] = config.openRouter.siteUrl;
  if (config.openRouter.appName) headers["X-OpenRouter-Title"] = config.openRouter.appName;

  return headers;
}

function extractReplyText(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.choices)) return "";

  const message = body.choices[0]?.message;
  if (!isRecord(message)) return "";
  const content = message.content;

  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!isRecord(part)) return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function formatOpenRouterError(status: number, body: unknown, rawBody: string): string {
  const responseBody = isRecord(body) ? body : {};
  const message =
    (isRecord(responseBody.error) && typeof responseBody.error.message === "string" ? responseBody.error.message : "") ||
    (typeof responseBody.message === "string" ? responseBody.message : "") ||
    rawBody ||
    "Unknown OpenRouter error";
  return `OpenRouter request failed with ${status}: ${message}`;
}

function parseJson(rawBody: string): unknown {
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
