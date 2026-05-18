import type { SokosumiClient, SokosumiEvent, SokosumiTask, SokosumiTaskEventInput } from "./types.js";

export type SokosumiTaskPoller = {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
};

export function createSokosumiTaskPoller({
  client,
  intervalMs,
  limit,
  maxPages,
  logger = console,
  processTask,
  createRunningEvent = defaultCreateRunningEvent,
  createCompletedEvent,
  createFailedEvent = defaultCreateFailedEvent
}: {
  client: SokosumiClient;
  intervalMs: number;
  limit: number;
  maxPages: number;
  logger?: Pick<Console, "log" | "error">;
  processTask: (input: { event: SokosumiEvent; task: SokosumiTask }) => Promise<string>;
  createRunningEvent?: (input: { event: SokosumiEvent; task: SokosumiTask }) => SokosumiTaskEventInput | undefined;
  createCompletedEvent: (input: { event: SokosumiEvent; task: SokosumiTask; result: string }) => SokosumiTaskEventInput;
  createFailedEvent?: (input: { event: SokosumiEvent; task: SokosumiTask; error: unknown }) => SokosumiTaskEventInput;
}): SokosumiTaskPoller {
  const processedEventIds = new Set<string>();
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  return {
    start() {
      log(logger, "sokosumi_task_poller_started", { intervalMs });
      void tick();
      timer = setInterval(() => void tick(), intervalMs);
    },

    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },

    async tick() {
      await tick();
    }
  };

  async function tick(): Promise<void> {
    if (running) return;
    running = true;

    try {
      await scanEventPages();
    } catch (error) {
      log(logger, "sokosumi_task_poller_error", { message: errorMessage(error) }, "error");
    } finally {
      running = false;
    }
  }

  async function scanEventPages(): Promise<void> {
    let cursor: string | undefined;
    let page = 0;

    do {
      page += 1;
      const { events, pagination } = await client.listCoworkerEvents({ limit, cursor });
      for (const event of events) {
        await handleEvent(event);
      }

      const nextCursor = pagination?.nextCursor;
      cursor = nextCursor && nextCursor !== cursor ? nextCursor : undefined;
    } while (cursor && page < maxPages);

    if (cursor) {
      log(logger, "sokosumi_task_poller_page_limit_reached", { maxPages, nextCursor: cursor });
    }
  }

  async function handleEvent(event: SokosumiEvent): Promise<void> {
    if (!event.id || processedEventIds.has(event.id)) return;
    if (!event.taskId) {
      processedEventIds.add(event.id);
      return;
    }

    const task = await client.getTask(event.taskId);
    if (!shouldProcessEvent(event, task)) {
      processedEventIds.add(event.id);
      return;
    }

    processedEventIds.add(event.id);

    if (hasTaskProgress(task, event)) {
      log(logger, "sokosumi_task_already_processed", { eventId: event.id, taskId: event.taskId });
      return;
    }

    try {
      const runningEvent = createRunningEvent({ event, task });
      if (runningEvent) await client.createTaskEvent(event.taskId, runningEvent);

      const result = await processTask({ event, task });
      await client.createTaskEvent(event.taskId, createCompletedEvent({ event, task, result }));

      log(logger, "sokosumi_task_completed", { eventId: event.id, taskId: event.taskId });
    } catch (error) {
      const failedEvent = createFailedEvent({ event, task, error });
      if (failedEvent) await client.createTaskEvent(event.taskId, failedEvent);
      throw error;
    }
  }
}

export function shouldProcessEvent(event: SokosumiEvent, task: SokosumiTask): boolean {
  if (event.status === "READY") return true;
  return isInputProvidedEvent(event, task);
}

export function hasTaskProgress(task: SokosumiTask, triggerEvent: SokosumiEvent): boolean {
  if (!Array.isArray(task.events)) return false;

  const triggerIndex = task.events.findIndex((event) => event?.id === triggerEvent?.id);

  return task.events.some((event, index) => {
    if (!event.coworkerId) return false;
    if (!isCoworkerProgressStatus(event.status)) return false;
    return isAfterTriggerEvent({ event, index, triggerEvent, triggerIndex });
  });
}

function isCoworkerProgressStatus(status: unknown): boolean {
  return [
    "RUNNING",
    "AWAITING_EXTERNAL",
    "INPUT_REQUIRED",
    "AUTHENTICATION_REQUIRED",
    "OUT_OF_CREDITS",
    "COMPLETED",
    "FAILED",
    "CANCEL_REQUESTED",
    "CANCELED"
  ].includes(String(status));
}

function isInputProvidedEvent(event: SokosumiEvent, task: SokosumiTask): boolean {
  if (event.status !== null && event.status !== undefined) return false;
  if (event.coworkerId) return false;
  if (!Array.isArray(task.events)) return false;

  const latestProgress = findLatestCoworkerProgressBeforeTrigger(task.events, event);
  return ["INPUT_REQUIRED", "AUTHENTICATION_REQUIRED", "OUT_OF_CREDITS", "AWAITING_EXTERNAL"].includes(
    String(latestProgress?.status)
  );
}

function findLatestCoworkerProgressBeforeTrigger(
  events: SokosumiEvent[],
  triggerEvent: SokosumiEvent
): SokosumiEvent | undefined {
  const triggerIndex = events.findIndex((event) => event?.id === triggerEvent?.id);
  let latestProgress: SokosumiEvent | undefined;
  let latestSortValue = -Infinity;

  events.forEach((event, index) => {
    if (!event?.coworkerId) return;
    if (!isCoworkerProgressStatus(event.status)) return;
    if (!isBeforeTriggerEvent({ event, index, triggerEvent, triggerIndex })) return;

    const sortValue = getEventTimestamp(event) ?? index;
    if (sortValue > latestSortValue) {
      latestSortValue = sortValue;
      latestProgress = event;
    }
  });

  return latestProgress;
}

function isAfterTriggerEvent({
  event,
  index,
  triggerEvent,
  triggerIndex
}: {
  event: SokosumiEvent;
  index: number;
  triggerEvent: SokosumiEvent;
  triggerIndex: number;
}): boolean {
  const eventTime = getEventTimestamp(event);
  const triggerTime = getEventTimestamp(triggerEvent);

  if (eventTime !== undefined && triggerTime !== undefined) return eventTime > triggerTime;
  if (triggerIndex >= 0) return index > triggerIndex;
  return false;
}

function isBeforeTriggerEvent({
  event,
  index,
  triggerEvent,
  triggerIndex
}: {
  event: SokosumiEvent;
  index: number;
  triggerEvent: SokosumiEvent;
  triggerIndex: number;
}): boolean {
  const eventTime = getEventTimestamp(event);
  const triggerTime = getEventTimestamp(triggerEvent);

  if (eventTime !== undefined && triggerTime !== undefined) return eventTime < triggerTime;
  if (triggerIndex >= 0) return index < triggerIndex;
  return false;
}

function getEventTimestamp(event: SokosumiEvent): number | undefined {
  const value = event.createdAt || event.created_at || event.timestamp || event.updatedAt || event.updated_at;
  if (!value) return undefined;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function defaultCreateRunningEvent(): SokosumiTaskEventInput {
  return {
    status: "RUNNING",
    origin: "SOKOSUMI",
    comment: "SuSE picked up this task."
  };
}

function defaultCreateFailedEvent({ error }: { error: unknown }): SokosumiTaskEventInput {
  return {
    status: "FAILED",
    origin: "SOKOSUMI",
    comment: `SuSE failed while processing this task: ${errorMessage(error)}`
  };
}

function log(
  logger: Pick<Console, "log" | "error">,
  event: string,
  details: Record<string, unknown> = {},
  level: "info" | "error" = "info"
): void {
  const entry = JSON.stringify({ event, ...details });
  if (level === "error" && logger.error) {
    logger.error(entry);
    return;
  }
  logger.log(entry);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Task processing failed.";
}

