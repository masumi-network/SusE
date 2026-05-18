import { createId, nowSeconds } from "../utils/ids.js";
import {
  extractTextFromItem,
  normalizeConversationId,
  normalizeItems,
  normalizeMetadata
} from "./normalize.js";
import type {
  ConversationDeletedObject,
  ConversationItem,
  ConversationItemList,
  ConversationObject,
  ConversationStore,
  CreateConversationInput
} from "./types.js";

type ConversationRecord = ConversationObject & {
  items: ConversationItem[];
  deleted: boolean;
};

export function createMemoryStore(): ConversationStore {
  const conversations = new Map<string, ConversationRecord>();
  const responses = new Map<string, Record<string, unknown>>();

  return {
    async ready() {
      return undefined;
    },

    async close() {
      conversations.clear();
      responses.clear();
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
    }
  };
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

