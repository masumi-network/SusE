import type { AppConfig } from "../config.js";
import type { TaskRunStore } from "../storage/types.js";
import { createSuseReply } from "../suse/agent.js";
import { createHttpSokosumiClient } from "./client.js";
import { createSokosumiTaskPoller, type SokosumiTaskPoller } from "./taskPoller.js";
import type { SokosumiTask } from "./types.js";

export function startSokosumiTaskWorker({
  config,
  taskRunStore,
  logger = console
}: {
  config: AppConfig;
  taskRunStore?: TaskRunStore;
  logger?: Pick<Console, "log" | "error">;
}): SokosumiTaskPoller | undefined {
  if (!config.sokosumi.taskPollerEnabled) return undefined;

  const client = createHttpSokosumiClient({ config });
  const poller = createSokosumiTaskPoller({
    client,
    intervalMs: config.sokosumi.taskPollIntervalMs,
    limit: config.sokosumi.taskPollLimit,
    maxPages: config.sokosumi.taskPollMaxPages,
    taskRunStore,
    logger,
    async processTask({ task }) {
      const result = await createSuseReply({
        message: extractTaskPrompt(task),
        conversationId: task.id,
        metadata: {
          protocol: "sokosumi_task",
          taskId: task.id
        },
        config
      });
      return result.reply;
    },
    createCompletedEvent({ result }) {
      return {
        status: "COMPLETED",
        origin: "SOKOSUMI",
        comment: result,
        credits: config.sokosumi.taskCompletionCredits
      };
    }
  });

  poller.start();
  return poller;
}

export function extractTaskPrompt(task: SokosumiTask): string {
  const parts = [
    stringValue(task.title),
    stringValue(task.name),
    stringValue(task.description),
    stringValue(task.instructions),
    jsonSummary(task.input),
    jsonSummary(task.payload)
  ].filter(Boolean);

  const eventComments = Array.isArray(task.events)
    ? task.events
        .map((event) => stringValue(event.comment))
        .filter(Boolean)
        .slice(-5)
    : [];

  return [...parts, ...eventComments].join("\n\n").trim() || "Empty Sokosumi task.";
}

function jsonSummary(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
