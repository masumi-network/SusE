import { createId, nowSeconds } from "../utils/ids.js";
import {
  extractTextFromItem,
  normalizeConversationId,
  normalizeItems,
  normalizeMetadata
} from "./normalize.js";
import type {
  ClaimTaskRunInput,
  ConversationDeletedObject,
  ConversationItem,
  ConversationItemList,
  ConversationObject,
  ConversationStore,
  CreateConversationInput,
  TaskRunClaim,
  TaskRunStatus
} from "./types.js";

type ConversationRecord = ConversationObject & {
  items: ConversationItem[];
  deleted: boolean;
};

type TaskRunRecord = {
  runId: string;
  correlationId: string;
  eventId: string;
  taskId: string;
  status: TaskRunStatus;
  attempt: number;
  leaseOwner: string;
  leaseExpiresAt: number;
  claimEventId?: string;
  completionEventId?: string;
  lastError?: string;
};

export function createMemoryStore(): ConversationStore {
  const conversations = new Map<string, ConversationRecord>();
  const responses = new Map<string, Record<string, unknown>>();
  const taskRunsByEventId = new Map<string, TaskRunRecord>();
  const taskRunsByRunId = new Map<string, TaskRunRecord>();

  return {
    async ready() {
      return undefined;
    },

    async close() {
      conversations.clear();
      responses.clear();
      taskRunsByEventId.clear();
      taskRunsByRunId.clear();
    },

    async createConversation(input: CreateConversationInput = {}) {
      const conversation: ConversationRecord = {
        id: createId("conv"),
        object: "conversation",
        created_at: nowSeconds(),
        metadata: normalizeMetadata(input.metadata),
        items: normalizeItems(input.items),
        deleted: false
      };

      conversations.set(conversation.id, conversation);
      return toConversationObject(conversation);
    },

    async getConversation(conversationId: string) {
      const conversation = getActiveConversation(conversations, conversationId);
      return conversation ? toConversationObject(conversation) : undefined;
    },

    async updateConversation(conversationId: string, input = {}) {
      const conversation = getActiveConversation(conversations, conversationId);
      if (!conversation) return undefined;

      conversation.metadata = normalizeMetadata(input.metadata);
      conversations.set(conversation.id, conversation);
      return toConversationObject(conversation);
    },

    async deleteConversation(conversationId: string): Promise<ConversationDeletedObject> {
      const conversation = conversations.get(conversationId);
      if (!conversation || conversation.deleted) {
        return {
          id: conversationId,
          object: "conversation.deleted",
          deleted: false
        };
      }

      conversation.deleted = true;
      conversations.set(conversation.id, conversation);
      return {
        id: conversationId,
        object: "conversation.deleted",
        deleted: true
      };
    },

    async listConversationItems(conversationId: string) {
      const conversation = getActiveConversation(conversations, conversationId);
      if (!conversation) return undefined;
      return toItemList(conversation.items);
    },

    async getConversationItem(conversationId: string, itemId: string) {
      const conversation = getActiveConversation(conversations, conversationId);
      if (!conversation) return undefined;
      return clone(conversation.items.find((item) => item.id === itemId));
    },

    async deleteConversationItem(conversationId: string, itemId: string) {
      const conversation = getActiveConversation(conversations, conversationId);
      if (!conversation) return undefined;

      conversation.items = conversation.items.filter((item) => item.id !== itemId);
      conversations.set(conversation.id, conversation);
      return toConversationObject(conversation);
    },

    async appendConversationItems(conversationRef: unknown, items: unknown) {
      const conversationId = normalizeConversationId(conversationRef);
      if (!conversationId) return undefined;

      const conversation = getActiveConversation(conversations, conversationId);
      if (!conversation) return undefined;

      conversation.items = [...conversation.items, ...normalizeItems(items)];
      conversations.set(conversation.id, conversation);
      return toConversationObject(conversation);
    },

    async getLastUserText(conversationRef: unknown) {
      const conversationId = normalizeConversationId(conversationRef);
      const conversation = getActiveConversation(conversations, conversationId);
      if (!conversation) return "";

      const item = [...conversation.items].reverse().find((candidate) => candidate.role === "user");
      return extractTextFromItem(item);
    },

    async saveResponse(response) {
      responses.set(response.id, clone(response));
    },

    async getResponse(responseId: string) {
      return clone(responses.get(responseId));
    },

    async claimTaskRun(input: ClaimTaskRunInput): Promise<TaskRunClaim> {
      const existing = taskRunsByEventId.get(input.eventId);
      const now = Date.now();

      if (existing) {
        if (existing.status === "claimed" || existing.status === "running") {
          if (existing.leaseExpiresAt <= now) {
            existing.status = "claimed";
            existing.attempt += 1;
            existing.leaseOwner = input.leaseOwner;
            existing.leaseExpiresAt = now + input.leaseMs;
            existing.lastError = undefined;
            saveTaskRun(existing);
            return toTaskRunClaim(existing, true);
          }

          return {
            ...toTaskRunClaim(existing, false),
            reason: "lease_active"
          };
        }

        return {
          ...toTaskRunClaim(existing, false),
          reason: "already_processed"
        };
      }

      const record: TaskRunRecord = {
        runId: createId("run"),
        correlationId: createId("corr"),
        eventId: input.eventId,
        taskId: input.taskId,
        status: "claimed",
        attempt: 1,
        leaseOwner: input.leaseOwner,
        leaseExpiresAt: now + input.leaseMs
      };
      saveTaskRun(record);
      return toTaskRunClaim(record, true);
    },

    async markTaskRunRunning({ runId, claimEventId }) {
      updateTaskRun(taskRunsByRunId, runId, (record) => {
        record.status = "running";
        record.claimEventId = claimEventId;
      });
    },

    async markTaskRunCompleted({ runId, completionEventId }) {
      updateTaskRun(taskRunsByRunId, runId, (record) => {
        record.status = "completed";
        record.completionEventId = completionEventId;
      });
    },

    async markTaskRunFailed({ runId, error }) {
      updateTaskRun(taskRunsByRunId, runId, (record) => {
        record.status = "failed";
        record.lastError = errorMessage(error);
      });
    },

    async markTaskRunSkipped({ eventId, reason }) {
      const existing = taskRunsByEventId.get(eventId);
      if (!existing) return;
      existing.status = "skipped";
      existing.lastError = reason;
      saveTaskRun(existing);
    }
  };

  function saveTaskRun(record: TaskRunRecord): void {
    taskRunsByEventId.set(record.eventId, record);
    taskRunsByRunId.set(record.runId, record);
  }
}

function getActiveConversation(
  conversations: Map<string, ConversationRecord>,
  conversationId: string
): ConversationRecord | undefined {
  const conversation = conversations.get(conversationId);
  if (!conversation || conversation.deleted) return undefined;
  return conversation;
}

function toConversationObject(conversation: ConversationRecord): ConversationObject {
  return {
    id: conversation.id,
    object: "conversation",
    created_at: conversation.created_at,
    metadata: clone(conversation.metadata)
  };
}

function toItemList(items: ConversationItem[]): ConversationItemList {
  const data = clone(items);
  return {
    object: "list",
    data,
    first_id: data[0]?.id || null,
    last_id: data[data.length - 1]?.id || null,
    has_more: false
  };
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function toTaskRunClaim(record: TaskRunRecord, claimed: boolean): TaskRunClaim {
  return {
    claimed,
    runId: record.runId,
    correlationId: record.correlationId,
    status: record.status,
    attempt: record.attempt
  };
}

function updateTaskRun(
  taskRunsByRunId: Map<string, TaskRunRecord>,
  runId: string,
  update: (record: TaskRunRecord) => void
): void {
  const record = taskRunsByRunId.get(runId);
  if (!record) return;
  update(record);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Task processing failed.";
}
