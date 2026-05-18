export type SokosumiEvent = {
  id?: string;
  taskId?: string;
  status?: string | null;
  coworkerId?: string | null;
  createdAt?: string;
  created_at?: string;
  timestamp?: string;
  updatedAt?: string;
  updated_at?: string;
  comment?: string;
};

export type SokosumiTask = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  instructions?: string;
  input?: unknown;
  payload?: unknown;
  events?: SokosumiEvent[];
  [key: string]: unknown;
};

export type SokosumiTaskEventInput = {
  status: string;
  origin: "SOKOSUMI" | string;
  comment: string;
  credits?: number;
};

export type SokosumiTaskClient = {
  listCoworkerEvents(input?: { limit?: number; cursor?: string }): Promise<{
    events: SokosumiEvent[];
    pagination?: {
      nextCursor?: string;
    };
  }>;
  getTask(taskId: string): Promise<SokosumiTask>;
  createTaskEvent(taskId: string, body: SokosumiTaskEventInput): Promise<unknown>;
};

export type SokosumiUsageInput = {
  credits: number;
  idempotencyKey: string;
  referenceId?: string;
  organizationId?: string;
  userId: string;
};

export type SokosumiUsageClient = {
  getDelegatedCredits(input: { userId: string; organizationId?: string }): Promise<number>;
  postUsage(input: SokosumiUsageInput): Promise<unknown>;
};

export type SokosumiClient = SokosumiTaskClient & SokosumiUsageClient;
