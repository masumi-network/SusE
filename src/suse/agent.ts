import type { AppConfig } from "../config.js";
import { createOrchestrationRun, type OrchestrationRunResult } from "./orchestrationRun.js";

export type SuseReply = OrchestrationRunResult;

export async function createSuseReply({
  message,
  conversationId,
  metadata,
  config
}: {
  message: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
  config: AppConfig;
}): Promise<SuseReply> {
  return createOrchestrationRun({
    message,
    conversationId,
    metadata,
    config
  });
}
