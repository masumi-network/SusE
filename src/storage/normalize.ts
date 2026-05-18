import { createId } from "../utils/ids.js";
import type { ConversationContentPart, ConversationItem, JsonObject } from "./types.js";

export function normalizeConversationId(conversationRef: unknown): string {
  if (typeof conversationRef === "string") return conversationRef;
  if (isRecord(conversationRef) && typeof conversationRef.id === "string") return conversationRef.id;
  return "";
}

export function normalizeMetadata(metadata: unknown): JsonObject {
  if (!isRecord(metadata)) return {};
  return { ...metadata };
}

export function normalizeItems(items: unknown): ConversationItem[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const source = isRecord(item) ? item : {};
    return {
      id: typeof source.id === "string" ? source.id : createId("msg"),
      type: typeof source.type === "string" ? source.type : "message",
      status: typeof source.status === "string" ? source.status : "completed",
      role: normalizeRole(source.role),
      content: normalizeContent(source.content)
    };
  });
}

export function toConversationInputItems(input: unknown): ConversationItem[] {
  if (typeof input === "string") {
    return normalizeItems([
      {
        role: "user",
        content: input
      }
    ]);
  }

  if (!Array.isArray(input)) return [];

  return normalizeItems(
    input.map((item) => {
      if (typeof item === "string") {
        return { role: "user", content: item };
      }
      return item;
    })
  );
}

export function toAssistantConversationItem(text: string): ConversationItem {
  return normalizeItems([
    {
      role: "assistant",
      content: [{ type: "output_text", text }]
    }
  ])[0]!;
}

export function extractTextFromInput(input: unknown): string {
  if (typeof input === "string") return input.trim();

  if (!Array.isArray(input)) return "";

  return input
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (!isRecord(item)) return [];
      if (typeof item.content === "string") return [item.content];
      if (Array.isArray(item.content)) {
        return item.content.map(extractTextFromContentPart).filter(Boolean);
      }
      return [];
    })
    .join("\n")
    .trim();
}

export function extractTextFromItem(item: ConversationItem | undefined): string {
  if (!item) return "";
  return item.content.map(extractTextFromContentPart).filter(Boolean).join("\n").trim();
}

function normalizeRole(value: unknown): ConversationItem["role"] {
  if (value === "assistant" || value === "system") return value;
  return "user";
}

function normalizeContent(content: unknown): ConversationContentPart[] {
  if (typeof content === "string") {
    return [{ type: "input_text", text: content }];
  }

  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return { type: "input_text", text: part };
      if (!isRecord(part)) return { type: "input_text", text: "" };

      const type = typeof part.type === "string" ? part.type : "input_text";
      const text = textValue(part.text) || textValue(part.input_text);
      return { type, text };
    });
  }

  return [];
}

function extractTextFromContentPart(part: unknown): string {
  if (typeof part === "string") return part;
  if (!isRecord(part)) return "";
  return textValue(part.text) || textValue(part.input_text) || "";
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

