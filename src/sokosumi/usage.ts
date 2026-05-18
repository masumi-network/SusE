import type { AppConfig } from "../config.js";
import { createHttpSokosumiClient } from "./client.js";

export type SokosumiUsageChargeResult = {
  attempted: boolean;
  charged: boolean;
  credits: number;
  balance?: number;
  reason?: string;
  error?: string;
};

export async function chargeSokosumiConversationUsage({
  config,
  protocol,
  runId,
  referenceId,
  userId,
  organizationId,
  fetchImpl = fetch
}: {
  config: AppConfig;
  protocol: string;
  runId: string;
  referenceId?: string;
  userId?: string;
  organizationId?: string;
  fetchImpl?: typeof fetch;
}): Promise<SokosumiUsageChargeResult> {
  const credits = config.sokosumi.conversationCredits;

  if (!config.sokosumi.usageChargingEnabled) {
    return { attempted: false, charged: false, credits, reason: "disabled" };
  }
  if (credits <= 0) {
    return { attempted: false, charged: false, credits, reason: "zero_credits" };
  }
  if (!config.sokosumi.coworkerApiKey) {
    return { attempted: false, charged: false, credits, reason: "missing_coworker_key" };
  }
  if (!userId) {
    return { attempted: false, charged: false, credits, reason: "missing_user_id" };
  }

  const client = createHttpSokosumiClient({ config, fetchImpl });

  try {
    const balance = await client.getDelegatedCredits({ userId, organizationId });
    if (balance < credits) {
      return { attempted: true, charged: false, credits, balance, reason: "insufficient_credits" };
    }

    await client.postUsage({
      credits,
      idempotencyKey: runId,
      referenceId: referenceId || `suse/${protocol}`,
      organizationId: organizationId || null,
      userId
    });

    return { attempted: true, charged: true, credits, balance };
  } catch (error) {
    return {
      attempted: true,
      charged: false,
      credits,
      reason: "charge_failed",
      error: error instanceof Error ? error.message : "Usage charge failed."
    };
  }
}
