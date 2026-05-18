import type { AppConfig } from "../config.js";
import { createMemoryStore } from "./memoryStore.js";
import { createPostgresStore } from "./postgresStore.js";
import type { ConversationStore } from "./types.js";

export async function createConversationStore(config: AppConfig): Promise<ConversationStore> {
  if (config.storageMode === "postgres") {
    return createPostgresStore(config.databaseUrl);
  }

  return createMemoryStore();
}

