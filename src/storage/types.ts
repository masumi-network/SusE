export type JsonObject = Record<string, unknown>;

export type ConversationContentPart = {
  type: string;
  text?: string;
  input_text?: string;
  annotations?: unknown[];
};

export type ConversationItem = {
  id: string;
  type: string;
  status: string;
  role: "user" | "assistant" | "system";
  content: ConversationContentPart[];
};

export type ConversationObject = {
  id: string;
  object: "conversation";
  created_at: number;
  metadata: JsonObject;
};

export type ConversationDeletedObject = {
  id: string;
  object: "conversation.deleted";
  deleted: boolean;
};

export type ConversationItemList = {
  object: "list";
  data: ConversationItem[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
};

export type CreateConversationInput = {
  metadata?: unknown;
  items?: unknown;
};

export type TaskRunStatus = "claimed" | "running" | "completed" | "failed" | "skipped";

export type ClaimTaskRunInput = {
  eventId: string;
  taskId: string;
  triggerStatus?: string | null;
  leaseOwner: string;
  leaseMs: number;
};

export type TaskRunClaim = {
  claimed: boolean;
  runId?: string;
  correlationId?: string;
  status?: TaskRunStatus;
  attempt?: number;
  reason?: "already_processed" | "lease_active" | "missing_run";
};

export type TaskRunStore = {
  claimTaskRun(input: ClaimTaskRunInput): Promise<TaskRunClaim>;
  markTaskRunRunning(input: { runId: string; claimEventId?: string }): Promise<void>;
  markTaskRunCompleted(input: { runId: string; completionEventId?: string; finalAnswer: string }): Promise<void>;
  markTaskRunFailed(input: { runId: string; error: unknown }): Promise<void>;
  markTaskRunSkipped(input: { eventId: string; reason: string }): Promise<void>;
};

export type ConversationStore = {
  ready(): Promise<void>;
  close(): Promise<void>;
  createConversation(input?: CreateConversationInput): Promise<ConversationObject>;
  getConversation(conversationId: string): Promise<ConversationObject | undefined>;
  updateConversation(conversationId: string, input?: { metadata?: unknown }): Promise<ConversationObject | undefined>;
  deleteConversation(conversationId: string): Promise<ConversationDeletedObject>;
  listConversationItems(conversationId: string): Promise<ConversationItemList | undefined>;
  getConversationItem(conversationId: string, itemId: string): Promise<ConversationItem | undefined>;
  deleteConversationItem(conversationId: string, itemId: string): Promise<ConversationObject | undefined>;
  appendConversationItems(conversationRef: unknown, items: unknown): Promise<ConversationObject | undefined>;
  getLastUserText(conversationRef: unknown): Promise<string>;
  saveResponse(response: { id: string; created_at: number } & Record<string, unknown>): Promise<void>;
  getResponse(responseId: string): Promise<Record<string, unknown> | undefined>;
} & TaskRunStore;
