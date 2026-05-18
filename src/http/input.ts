export function extractMessageFromResponsesInput(input: unknown): string {
  if (typeof input === "string") return input.trim();

  if (!Array.isArray(input)) return "";

  return input
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (!isRecord(item)) return [];
      if (typeof item.content === "string") return [item.content];
      if (Array.isArray(item.content)) {
        return item.content
          .map((contentItem) => {
            if (typeof contentItem === "string") return contentItem;
            if (!isRecord(contentItem)) return "";
            return textValue(contentItem.text) || textValue(contentItem.input_text);
          })
          .filter(Boolean);
      }
      return [];
    })
    .join("\n")
    .trim();
}

export function extractMessageFromChatMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";

  const lastUserMessage = [...messages].reverse().find((message) => {
    return isRecord(message) && message.role === "user";
  });

  if (!isRecord(lastUserMessage)) return "";

  if (typeof lastUserMessage.content === "string") return lastUserMessage.content.trim();
  if (!Array.isArray(lastUserMessage.content)) return "";

  return lastUserMessage.content
    .map((contentItem) => {
      if (typeof contentItem === "string") return contentItem;
      if (!isRecord(contentItem)) return "";
      return textValue(contentItem.text) || textValue(contentItem.input_text);
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

