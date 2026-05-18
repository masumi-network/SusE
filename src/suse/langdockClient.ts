import type { AppConfig } from "../config.js";
import { canRetryAttempt, retryDelayMs, shouldRetryHttpStatus, sleep } from "../utils/retry.js";
import type { Specialist, SpecialistSlug } from "./specialists.js";

export type LangdockFinding = {
  specialist: Specialist;
  status: "completed" | "failed";
  content: string;
  error?: string;
};

type LangdockMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callLangdockSpecialist({
  config,
  specialist,
  brief,
  fetchImpl = fetch
}: {
  config: AppConfig;
  specialist: Specialist;
  brief: string;
  fetchImpl?: typeof fetch;
}): Promise<LangdockFinding> {
  const agentId = getSpecialistAgentId(config, specialist.slug);
  if (!config.langdock.apiKey || !agentId) {
    return {
      specialist,
      status: "failed",
      content: "",
      error: "Langdock specialist configuration is incomplete."
    };
  }

  for (let attempt = 1; attempt <= config.langdock.maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.langdock.timeoutMs);

    try {
      const response = await fetchImpl(`${config.langdock.baseUrl}/agent/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.langdock.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId,
          messages: createSpecialistMessages(specialist, brief),
          stream: false
        }),
        signal: controller.signal
      });

      const rawBody = await response.text();
      const body = parseJson(rawBody);

      if (!response.ok) {
        if (shouldRetryHttpStatus(response.status) && canRetryAttempt(attempt, config.langdock)) {
          await sleep(retryDelayMs(attempt, config.langdock));
          continue;
        }

        return {
          specialist,
          status: "failed",
          content: "",
          error: `Langdock returned HTTP ${response.status}.`
        };
      }

      const content = extractAssistantContent(body);
      if (!content) {
        return {
          specialist,
          status: "failed",
          content: "",
          error: "Langdock response did not include assistant content."
        };
      }

      return {
        specialist,
        status: "completed",
        content
      };
    } catch (error) {
      if (canRetryAttempt(attempt, config.langdock)) {
        await sleep(retryDelayMs(attempt, config.langdock));
        continue;
      }

      return {
        specialist,
        status: "failed",
        content: "",
        error:
          error instanceof Error && error.name === "AbortError"
            ? `Langdock request timed out after ${config.langdock.timeoutMs}ms.`
            : errorMessage(error)
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    specialist,
    status: "failed",
    content: "",
    error: "Langdock request failed."
  };
}

function createSpecialistMessages(specialist: Specialist, brief: string): LangdockMessage[] {
  return [
    {
      role: "system",
      content:
        `You are ${specialist.name}. Your focus is ${specialist.focus}. ` +
        "Answer the brief directly. Include assumptions, risks, and concrete next steps where useful."
    },
    {
      role: "user",
      content: brief
    }
  ];
}

function getSpecialistAgentId(config: AppConfig, slug: SpecialistSlug): string {
  if (slug === "lexi") return config.langdock.agentIds.lexi;
  if (slug === "emil-conrad") return config.langdock.agentIds.emilConrad;
  if (slug === "diddy-p") return config.langdock.agentIds.diddyP;
  return config.langdock.agentIds.foodCo2Analyst;
}

function extractAssistantContent(body: unknown): string {
  if (!isRecord(body)) return "";

  if (typeof body.output === "string") return body.output.trim();
  if (body.output !== undefined && body.output !== null) return JSON.stringify(body.output);

  const rootPartsText = joinTextParts(body.parts);
  if (rootPartsText) return rootPartsText;

  if (!Array.isArray(body.messages)) return "";
  const assistantMessages = body.messages.filter((message) => isRecord(message) && message.role === "assistant");
  const lastMessage = assistantMessages.at(-1) || body.messages.at(-1);
  if (!isRecord(lastMessage)) return "";

  if (typeof lastMessage.content === "string") return lastMessage.content.trim();
  return joinTextParts(lastMessage.parts);
}

function joinTextParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (!isRecord(part) || part.type !== "text") return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .filter(Boolean)
    .join("")
    .trim();
}

function parseJson(value: string): unknown {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Langdock request failed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
