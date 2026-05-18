import type { AppConfig } from "../config.js";
import { SUSE_PROFILE, SUSE_SYSTEM_PROMPT } from "./identity.js";
import { callLangdockSpecialist, type LangdockFinding } from "./langdockClient.js";
import { createOpenRouterChatReply } from "./openRouterClient.js";
import { selectSpecialistsForMessage, type Specialist } from "./specialists.js";

export type SuseReply = {
  agent: string;
  mode: string;
  model: string;
  conversationId: string;
  reply: string;
  input: string;
  metadata: Record<string, unknown>;
};

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
  const normalizedMessage = normalizeMessage(message);
  const directReply = await createDirectReplyIfAppropriate({ config, message: normalizedMessage });
  if (directReply) {
    return {
      agent: SUSE_PROFILE.name,
      mode: directReply.mode,
      model: directReply.model,
      conversationId: conversationId || "",
      input: normalizedMessage,
      reply: directReply.reply,
      metadata: {
        ...(metadata || {}),
        route: "direct",
        selectedSpecialists: [],
        specialistStatus: [],
        synthesisProvider: directReply.provider
      }
    };
  }

  const selectedSpecialists = selectSpecialistsForMessage(normalizedMessage);
  const findings = await collectSpecialistFindings({
    config,
    message: normalizedMessage,
    specialists: selectedSpecialists
  });
  const synthesis = await synthesizeReply({
    config,
    message: normalizedMessage,
    findings
  });

  return {
    agent: SUSE_PROFILE.name,
    mode: synthesis.mode,
    model: synthesis.model,
    conversationId: conversationId || "",
    input: normalizedMessage,
    reply: synthesis.reply,
    metadata: {
      ...(metadata || {}),
      selectedSpecialists: selectedSpecialists.map((specialist) => specialist.slug),
      specialistStatus: findings.map((finding) => ({
        specialist: finding.specialist.slug,
        status: finding.status,
        error: finding.error
      })),
      synthesisProvider: synthesis.provider
    }
  };
}

async function createDirectReplyIfAppropriate({
  config,
  message
}: {
  config: AppConfig;
  message: string;
}): Promise<
  | {
      provider: string;
      mode: string;
      model: string;
      reply: string;
    }
  | undefined
> {
  if (!shouldAnswerDirectly(message)) return undefined;

  if (config.runtimeMode === "openrouter") {
    try {
      const completion = await createOpenRouterChatReply({
        config,
        messages: createDirectMessages(message)
      });
      return {
        provider: "openrouter",
        mode: "direct",
        model: completion.model,
        reply: completion.reply
      };
    } catch {
      return {
        provider: "fallback",
        mode: "direct",
        model: "suse-direct",
        reply: createDirectFallbackReply(message)
      };
    }
  }

  return {
    provider: "direct",
    mode: "direct",
    model: "suse-direct",
    reply: createDirectFallbackReply(message)
  };
}

async function collectSpecialistFindings({
  config,
  message,
  specialists
}: {
  config: AppConfig;
  message: string;
  specialists: Specialist[];
}): Promise<LangdockFinding[]> {
  if (config.specialistMode !== "langdock") {
    return specialists.map((specialist) => ({
      specialist,
      status: "completed",
      content: createStubSpecialistFinding({ message, specialist })
    }));
  }

  return Promise.all(
    specialists.map((specialist) =>
      callLangdockSpecialist({
        config,
        specialist,
        brief: createSpecialistBrief({ message, specialist, specialists })
      })
    )
  );
}

async function synthesizeReply({
  config,
  message,
  findings
}: {
  config: AppConfig;
  message: string;
  findings: LangdockFinding[];
}): Promise<{
  provider: string;
  mode: string;
  model: string;
  reply: string;
}> {
  if (config.runtimeMode === "openrouter") {
    try {
      const completion = await createOpenRouterChatReply({
        config,
        messages: createSynthesisMessages({ message, findings })
      });
      return {
        provider: "openrouter",
        mode: "orchestrated",
        model: completion.model,
        reply: completion.reply
      };
    } catch (error) {
      return {
        provider: "fallback",
        mode: "fallback",
        model: "suse-fallback",
        reply: createFallbackSynthesis({
          message,
          findings,
          failureReason: error instanceof Error ? error.message : "OpenRouter synthesis failed."
        })
      };
    }
  }

  return {
    provider: "stub",
    mode: "stub",
    model: "suse-stub",
    reply: createFallbackSynthesis({ message, findings })
  };
}

function createDirectMessages(message: string): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content:
        `${SUSE_SYSTEM_PROMPT}\n\n` +
        "Answer directly as SuSE. Do not consult or mention internal specialists. " +
        "For greetings or capability questions, briefly explain how you can help and ask for the user's sustainability context."
    },
    {
      role: "user",
      content: message
    }
  ];
}

function createSynthesisMessages({
  message,
  findings
}: {
  message: string;
  findings: LangdockFinding[];
}): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content:
        `${SUSE_SYSTEM_PROMPT}\n\n` +
        "Use the specialist findings as private working context. Produce one final answer. " +
        "Do not paste raw transcripts. Mention assumptions and gaps only when they affect the answer."
    },
    {
      role: "user",
      content:
        `User request:\n${message}\n\n` +
        `Specialist findings:\n${formatFindingsForPrompt(findings)}\n\n` +
        "Return the best possible answer for the user."
    }
  ];
}

function createSpecialistBrief({
  message,
  specialist,
  specialists
}: {
  message: string;
  specialist: Specialist;
  specialists: Specialist[];
}): string {
  const peerNames = specialists
    .filter((candidate) => candidate.slug !== specialist.slug)
    .map((candidate) => candidate.name)
    .join(", ");

  return [
    `User request: ${message}`,
    "",
    `You are being consulted by SuSE for your specialist focus: ${specialist.focus}.`,
    peerNames ? `Other specialists may also be consulted: ${peerNames}.` : "You are the only specialist selected for this request.",
    "",
    "Return concise findings with:",
    "- the direct answer from your specialty",
    "- assumptions or missing inputs",
    "- risks or compliance caveats",
    "- concrete next steps"
  ].join("\n");
}

function createStubSpecialistFinding({
  message,
  specialist
}: {
  message: string;
  specialist: Specialist;
}): string {
  return [
    `${specialist.name} would review the request through ${specialist.focus}.`,
    `Request: ${message}`,
    "Live specialist execution is disabled because SUSE_SPECIALIST_MODE is not set to langdock."
  ].join("\n");
}

function createFallbackSynthesis({
  message,
  findings,
  failureReason
}: {
  message: string;
  findings: LangdockFinding[];
  failureReason?: string;
}): string {
  const completed = findings.filter((finding) => finding.status === "completed");
  const failed = findings.filter((finding) => finding.status === "failed");
  const consulted = findings.map((finding) => finding.specialist.name).join(", ");
  const completedFindings = completed
    .map((finding) => `- ${finding.specialist.name}: ${trimForReply(finding.content)}`)
    .join("\n");
  const failures = failed.map((finding) => `- ${finding.specialist.name}: ${finding.error}`).join("\n");

  return [
    `I routed this through: ${consulted}.`,
    "",
    `Request:\n${message}`,
    "",
    completedFindings ? `Specialist findings:\n${completedFindings}` : "No specialist completed successfully.",
    failures ? `\nUnavailable specialist context:\n${failures}` : "",
    failureReason ? `\nSynthesis fallback reason: ${failureReason}` : "",
    "",
    "Next step: provide the missing business/product details if you want a more specific sustainability recommendation."
  ]
    .filter(Boolean)
    .join("\n");
}

function formatFindingsForPrompt(findings: LangdockFinding[]): string {
  return findings
    .map((finding) => {
      if (finding.status === "failed") {
        return `## ${finding.specialist.name}\nStatus: failed\nError: ${finding.error}`;
      }
      return `## ${finding.specialist.name}\nStatus: completed\n${finding.content}`;
    })
    .join("\n\n");
}

function trimForReply(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 700) return normalized;
  return `${normalized.slice(0, 697)}...`;
}

function shouldAnswerDirectly(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized === "empty message") return true;
  if (/^(hi+|hello+|hey+|yo|gm|good morning|good afternoon|good evening)\b/.test(normalized)) return true;
  if (/\b(how can you help|what can you do|who are you|introduce yourself|help me get started)\b/.test(normalized)) {
    return true;
  }

  return false;
}

function createDirectFallbackReply(message: string): string {
  if (message === "empty message") {
    return "Hi, I'm SuSE, your sustainability expert coworker. Send me a product, supplier, claim, footprint question, or Digital Product Passport brief and I'll help structure the next step.";
  }

  return "Hi, I'm SuSE, your sustainability expert coworker. I can help with sustainability strategy, supply-chain risk, green-claim review, Digital Product Passports, and food CO2 footprint questions. Share the product, market, claim, supplier, or dataset you're working with and I'll decide whether to answer directly or bring in the right specialist context.";
}

function normalizeMessage(message: string): string {
  const value = typeof message === "string" ? message.trim() : "";
  return value || "empty message";
}
