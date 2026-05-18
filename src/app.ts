import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import { listMissingRequiredConfig } from "./config.js";
import { extractMessageFromChatMessages, extractMessageFromResponsesInput } from "./http/input.js";
import { toChatCompletionsResult, toResponsesApiResult, toResponsesStreamEvents } from "./http/responses.js";
import { sendSse } from "./http/sse.js";
import { normalizeConversationId, toAssistantConversationItem, toConversationInputItems } from "./storage/normalize.js";
import type { ConversationStore } from "./storage/types.js";
import { createSuseReply, type SuseReply } from "./suse/agent.js";
import { SUSE_PROFILE } from "./suse/identity.js";
import { nowSeconds } from "./utils/ids.js";

export function createApp({
  config,
  store
}: {
  config: AppConfig;
  store: ConversationStore;
}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.SUSE_LOG_LEVEL || "info",
      redact: ["req.headers.authorization", "headers.authorization"]
    }
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (request.method === "OPTIONS") {
      return reply.status(204).send();
    }
    return undefined;
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = getErrorStatusCode(error);
    request.log.error({ err: error, statusCode }, "request_failed");
    reply.status(statusCode).send({
      error: statusCode >= 500 ? "Internal Server Error" : "Bad Request",
      message: statusCode >= 500 ? "SuSE could not complete the request." : getErrorMessage(error)
    });
  });

  app.get("/", async () => ({
    service: "@masumi/suse",
    agent: SUSE_PROFILE,
    endpoints: [
      "/health",
      "/ready",
      "/sokosumi/coworker",
      "/v1/conversations",
      "/v1/responses",
      "/v1/chat/completions",
      "/v1/models"
    ]
  }));

  app.get("/health", async () => ({
    status: "ok",
    service: "@masumi/suse",
    agent: config.agentName,
    runtimeMode: config.runtimeMode,
    specialistMode: config.specialistMode,
    storageMode: config.storageMode
  }));

  app.get("/ready", async (_request, reply) => {
    const missingConfig = listMissingRequiredConfig(config);
    const checks: Record<string, unknown> = {
      config: missingConfig.length === 0 ? "ok" : "missing",
      missingConfig
    };

    try {
      await store.ready();
      checks.storage = "ok";
    } catch (error) {
      checks.storage = error instanceof Error ? error.message : "failed";
    }

    const ready = missingConfig.length === 0 && checks.storage === "ok";
    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      service: "@masumi/suse",
      checks
    });
  });

  app.get("/sokosumi/coworker", async () => ({
    data: {
      slug: SUSE_PROFILE.slug,
      name: config.agentName,
      caption: SUSE_PROFILE.caption,
      description: SUSE_PROFILE.description,
      capabilities: SUSE_PROFILE.capabilities,
      baseURL: `${config.publicBaseUrl}/v1`
    }
  }));

  app.post("/chat", async (request) => {
    const body = asRecord(request.body);
    const result = await createSuseReply({
      message: stringValue(body.message) || stringValue(body.input) || stringValue(body.prompt),
      conversationId: stringValue(body.conversationId),
      metadata: createRequestMetadata(request.headers, body.metadata, { protocol: "chat" }),
      config
    });
    logSuseRun(request.log, result, "chat");
    return toPublicSuseReply(result);
  });

  app.post("/v1/conversations", async (request) => {
    return store.createConversation(asRecord(request.body));
  });

  app.get("/v1/conversations/:conversationId", async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const conversation = await store.getConversation(conversationId);
    if (!conversation) return reply.status(404).send({ error: "Not Found", message: `Conversation not found: ${conversationId}` });
    return conversation;
  });

  app.post("/v1/conversations/:conversationId", async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const conversation = await store.updateConversation(conversationId, asRecord(request.body));
    if (!conversation) return reply.status(404).send({ error: "Not Found", message: `Conversation not found: ${conversationId}` });
    return conversation;
  });

  app.delete("/v1/conversations/:conversationId", async (request) => {
    const { conversationId } = request.params as { conversationId: string };
    return store.deleteConversation(conversationId);
  });

  app.get("/v1/conversations/:conversationId/items", async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const items = await store.listConversationItems(conversationId);
    if (!items) return reply.status(404).send({ error: "Not Found", message: `Conversation not found: ${conversationId}` });
    return items;
  });

  app.get("/v1/conversations/:conversationId/items/:itemId", async (request, reply) => {
    const { conversationId, itemId } = request.params as { conversationId: string; itemId: string };
    const item = await store.getConversationItem(conversationId, itemId);
    if (!item) return reply.status(404).send({ error: "Not Found", message: `Conversation item not found: ${itemId}` });
    return item;
  });

  app.delete("/v1/conversations/:conversationId/items/:itemId", async (request, reply) => {
    const { conversationId, itemId } = request.params as { conversationId: string; itemId: string };
    const conversation = await store.deleteConversationItem(conversationId, itemId);
    if (!conversation) return reply.status(404).send({ error: "Not Found", message: `Conversation not found: ${conversationId}` });
    return conversation;
  });

  app.post("/v1/responses", async (request, reply) => {
    const body = asRecord(request.body);
    const conversationRef = body.conversation || body.conversation_id || body.conversationId;
    const conversationId = normalizeConversationId(conversationRef);

    if (conversationId && body.input) {
      await store.appendConversationItems(conversationId, toConversationInputItems(body.input));
    }

    const result = await createSuseReply({
      message: extractMessageFromResponsesInput(body.input) || (await store.getLastUserText(conversationRef)),
      conversationId,
      metadata: createRequestMetadata(request.headers, body.metadata, {
        protocol: "responses",
        model: stringValue(body.model),
        conversation: conversationId || undefined
      }),
      config
    });
    logSuseRun(request.log, result, "responses");
    const responseResult = toResponsesApiResult(result, conversationRef);

    await store.saveResponse(responseResult);
    if (conversationId) {
      await store.appendConversationItems(conversationId, [toAssistantConversationItem(responseResult.output_text)]);
    }

    if (body.stream === true) {
      sendSse(reply, toResponsesStreamEvents(responseResult));
      return reply;
    }

    return responseResult;
  });

  app.get("/v1/responses/:responseId", async (request, reply) => {
    const { responseId } = request.params as { responseId: string };
    const response = await store.getResponse(responseId);
    if (!response) return reply.status(404).send({ error: "Not Found", message: `Response not found: ${responseId}` });
    return response;
  });

  app.post("/v1/chat/completions", async (request) => {
    const body = asRecord(request.body);
    const result = await createSuseReply({
      message: extractMessageFromChatMessages(body.messages),
      conversationId: stringValue(body.conversation_id) || stringValue(body.conversationId),
      metadata: createRequestMetadata(request.headers, body.metadata, {
        protocol: "chat_completions",
        model: stringValue(body.model)
      }),
      config
    });
    logSuseRun(request.log, result, "chat_completions");
    return toChatCompletionsResult(result);
  });

  app.get("/v1/models", async () => {
    return {
      object: "list",
      data: [
        {
          id: SUSE_PROFILE.slug,
          object: "model",
          created: nowSeconds(),
          owned_by: "suse"
        }
      ]
    };
  });

  return app;
}

function createRequestMetadata(
  headers: Record<string, string | string[] | undefined>,
  metadata: unknown,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(isRecord(metadata) ? metadata : {}),
    ...extra,
    sokosumi: {
      userId: headerValue(headers["x-sokosumi-user-id"]),
      organizationId: headerValue(headers["x-sokosumi-organization-id"]) || headerValue(headers["x-organization-id"]),
      coworkerSlug: headerValue(headers["x-coworker-slug"])
    }
  };
}

function logSuseRun(logger: { info: (obj: Record<string, unknown>, msg?: string) => void }, result: SuseReply, protocol: string): void {
  logger.info(
    {
      event: "suse_run_completed",
      protocol,
      runId: result.internal.runId,
      correlationId: result.internal.correlationId,
      route: result.internal.route,
      selectedWorkerCount: result.internal.selectedWorkerCount,
      inputChars: result.internal.inputChars,
      mode: result.mode
    },
    "suse_run_completed"
  );
}

function toPublicSuseReply(result: SuseReply): Omit<SuseReply, "internal"> {
  const { internal: _internal, ...publicResult } = result;
  return publicResult;
}

function getErrorStatusCode(error: unknown): number {
  if (isRecord(error) && typeof error.statusCode === "number") return error.statusCode;
  return 500;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
