import { createId, nowSeconds } from "../utils/ids.js";
import { normalizeConversationId } from "../storage/normalize.js";
import type { SuseReply } from "../suse/agent.js";

export type ResponsesApiResult = {
  id: string;
  object: "response";
  created_at: number;
  status: "completed";
  model: string;
  conversation: { id: string } | null;
  output_text: string;
  output: [
    {
      id: string;
      type: "message";
      status: "completed";
      role: "assistant";
      content: [
        {
          type: "output_text";
          text: string;
          annotations: unknown[];
        }
      ];
    }
  ];
  metadata: Record<string, unknown>;
};

export type SseEvent = {
  type: string;
  sequence_number: number;
  [key: string]: unknown;
};

export function toResponsesApiResult(result: SuseReply, conversationRef: unknown): ResponsesApiResult {
  const createdAt = nowSeconds();
  const conversationId = normalizeConversationId(conversationRef);

  return {
    id: createId("resp"),
    object: "response",
    created_at: createdAt,
    status: "completed",
    model: result.model,
    conversation: conversationId ? { id: conversationId } : null,
    output_text: result.reply,
    output: [
      {
        id: createId("msg"),
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: result.reply,
            annotations: []
          }
        ]
      }
    ],
    metadata: {
      agent: result.agent,
      conversationId: result.conversationId || conversationId || undefined,
      ...result.metadata
    }
  };
}

export function toResponsesStreamEvents(responseResult: ResponsesApiResult): SseEvent[] {
  const outputItem = responseResult.output[0];
  const outputText = outputItem.content[0].text;

  return [
    {
      type: "response.created",
      sequence_number: 0,
      response: {
        ...responseResult,
        status: "in_progress",
        output_text: "",
        output: []
      }
    },
    {
      type: "response.output_item.added",
      sequence_number: 1,
      output_index: 0,
      item: {
        id: outputItem.id,
        type: "message",
        status: "in_progress",
        role: "assistant",
        content: []
      }
    },
    {
      type: "response.content_part.added",
      sequence_number: 2,
      item_id: outputItem.id,
      output_index: 0,
      content_index: 0,
      part: {
        type: "output_text",
        text: "",
        annotations: []
      }
    },
    {
      type: "response.output_text.delta",
      sequence_number: 3,
      item_id: outputItem.id,
      output_index: 0,
      content_index: 0,
      delta: outputText
    },
    {
      type: "response.output_text.done",
      sequence_number: 4,
      item_id: outputItem.id,
      output_index: 0,
      content_index: 0,
      text: outputText
    },
    {
      type: "response.content_part.done",
      sequence_number: 5,
      item_id: outputItem.id,
      output_index: 0,
      content_index: 0,
      part: {
        type: "output_text",
        text: outputText,
        annotations: []
      }
    },
    {
      type: "response.output_item.done",
      sequence_number: 6,
      output_index: 0,
      item: outputItem
    },
    {
      type: "response.completed",
      sequence_number: 7,
      response: responseResult
    }
  ];
}

export function toChatCompletionsResult(result: SuseReply): Record<string, unknown> {
  const createdAt = nowSeconds();
  return {
    id: createId("chatcmpl"),
    object: "chat.completion",
    created: createdAt,
    model: result.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: result.reply
        },
        finish_reason: "stop"
      }
    ],
    metadata: result.metadata
  };
}

