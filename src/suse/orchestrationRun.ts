import type { AppConfig } from "../config.js";
import { createId } from "../utils/ids.js";
import { SUSE_PROFILE, SUSE_SYSTEM_PROMPT } from "./identity.js";
import { callLangdockSpecialist, type LangdockFinding } from "./langdockClient.js";
import { createOpenRouterChatReply } from "./openRouterClient.js";
import { selectSpecialistsForMessage, type Specialist } from "./specialists.js";

export type OrchestrationRunResult = {
  agent: string;
  mode: string;
  model: string;
  conversationId: string;
  reply: string;
  input: string;
  metadata: Record<string, unknown>;
  internal: {
    runId: string;
    correlationId: string;
    route: "direct" | "background" | "budget_limited";
    selectedWorkerCount: number;
    inputChars: number;
  };
};

export async function createOrchestrationRun({
  message,
  conversationId,
  metadata,
  config
}: {
  message: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
  config: AppConfig;
}): Promise<OrchestrationRunResult> {
  const normalizedMessage = normalizeMessage(message);
  const runId = createId("run");
  const correlationId = createId("corr");

  if (normalizedMessage.length > config.budgets.maxInputChars) {
    return {
      agent: SUSE_PROFILE.name,
      mode: "budget_limited",
      model: SUSE_PROFILE.slug,
      conversationId: conversationId || "",
      input: normalizedMessage,
      reply: createInputLimitReply(config.budgets.maxInputChars),
      metadata: {
        ...(metadata || {})
      },
      internal: {
        runId,
        correlationId,
        route: "budget_limited",
        selectedWorkerCount: 0,
        inputChars: normalizedMessage.length
      }
    };
  }

  const directReply = await createDirectReplyIfAppropriate({ config, message: normalizedMessage });
  if (directReply) {
    return {
      agent: SUSE_PROFILE.name,
      mode: directReply.mode,
      model: SUSE_PROFILE.slug,
      conversationId: conversationId || "",
      input: normalizedMessage,
      reply: ensurePublicReply(directReply.reply, createDirectFallbackReply(normalizedMessage)),
      metadata: {
        ...(metadata || {})
      },
      internal: {
        runId,
        correlationId,
        route: "direct",
        selectedWorkerCount: 0,
        inputChars: normalizedMessage.length
      }
    };
  }

  const selectedSpecialists = selectSpecialistsForMessage(normalizedMessage).slice(0, config.budgets.maxSpecialistsPerRun);
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
    model: SUSE_PROFILE.slug,
    conversationId: conversationId || "",
    input: normalizedMessage,
    reply: ensurePublicReply(
      synthesis.reply,
      createFallbackSynthesis({
        message: normalizedMessage,
        findings
      })
    ),
    metadata: {
      ...(metadata || {})
    },
    internal: {
      runId,
      correlationId,
      route: "background",
      selectedWorkerCount: selectedSpecialists.length,
      inputChars: normalizedMessage.length
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

  if (shouldUseDeterministicDirectReply(message)) {
    return {
      provider: "direct",
      mode: "direct",
      model: "suse-direct",
      reply: createDirectFallbackReply(message)
    };
  }

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
        "Answer directly as SuSE. You may briefly say you have expert support if relevant, but do not mention internal agents, routing, orchestration, tools, vendors, or background coordination. " +
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
        "Use the private background context to produce one final answer as SuSE. " +
        "It is fine to speak as a sustainability expert with expert support behind you. " +
        "Never mention internal agents, specialists, routing, orchestration, tools, vendors, or background coordination. " +
        "Do not paste raw transcripts. Mention assumptions and gaps only when they affect the user's answer."
    },
    {
      role: "user",
      content:
        `User request:\n${message}\n\n` +
        `Private background context:\n${formatFindingsForPrompt(findings)}\n\n` +
        "Return the best possible answer for the user. Keep all background coordination private."
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
    createStubGuidanceForSpecialist(specialist),
    "State assumptions clearly and ask for missing product, market, supplier, claim, or footprint data when needed."
  ].join("\n");
}

function createStubGuidanceForSpecialist(specialist: Specialist): string {
  switch (specialist.slug) {
    case "lexi":
      return "Map the product, supplier, material, and traceability risks. Prioritize high-impact or high-uncertainty supply-chain areas.";
    case "emil-conrad":
      return "Check that sustainability claims are specific, substantiated, current, and not broader than the evidence supports.";
    case "diddy-p":
      return "Identify Digital Product Passport obligations, required data fields, data carriers, and ownership of product data.";
    case "food-co2-analyst":
      return "Collect ingredient weights, sourcing assumptions, emission factors, and packaging/transport data before calculating CO2e.";
  }
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
  const completedFindings = completed
    .map((finding) => sanitizeFindingForReply(finding.content))
    .filter(Boolean)
    .map((finding) => `- ${finding}`)
    .join("\n");

  return [
    "Here is the best sustainability read based on the details available.",
    "",
    completedFindings || createGenericFallbackGuidance(message),
    failed.length > 0 || failureReason ? "\nSome supporting context was unavailable, so treat this as a preliminary answer." : "",
    "",
    "Next step: share product/category, market, suppliers/materials, claim wording, and any footprint data for a sharper recommendation."
  ]
    .filter(Boolean)
    .join("\n");
}

function createGenericFallbackGuidance(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("claim") || normalized.includes("greenwashing") || normalized.includes("marketing")) {
    return [
      "- Make the claim specific and bounded: say what improved, against what baseline, and over what period.",
      "- Keep evidence close to the claim: lifecycle data, certifications, test reports, and methodology should be available before publication.",
      "- Avoid absolute wording unless you can substantiate the full product, lifecycle, and market context."
    ].join("\n");
  }

  if (normalized.includes("co2") || normalized.includes("carbon") || normalized.includes("footprint")) {
    return [
      "- Define the calculation boundary first: ingredients/materials, manufacturing, packaging, transport, use phase, and end of life.",
      "- Use source-specific activity data where possible, then document emission factors and uncertainty.",
      "- Report assumptions separately from measured values so the result can be improved later."
    ].join("\n");
  }

  if (normalized.includes("passport") || normalized.includes("dpp")) {
    return [
      "- Start with the product category and target market to identify which Digital Product Passport rules apply.",
      "- Map required product data, responsible owners, update frequency, and the data carrier users will scan.",
      "- Separate mandatory compliance fields from optional sustainability storytelling."
    ].join("\n");
  }

  return [
    "- Clarify the product, market, and decision you need to make.",
    "- Identify the sustainability risk area: supply chain, claims, product data, footprint, or reporting.",
    "- Collect the evidence behind the decision, then turn it into a concrete recommendation or action plan."
  ].join("\n");
}

function formatFindingsForPrompt(findings: LangdockFinding[]): string {
  return findings
    .map((finding, index) => {
      if (finding.status === "failed") {
        return `## Background note ${index + 1}\nStatus: unavailable`;
      }
      return `## Background note ${index + 1}\nStatus: completed\n${finding.content}`;
    })
    .join("\n\n");
}

function trimForReply(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 700) return normalized;
  return `${normalized.slice(0, 697)}...`;
}

function sanitizeFindingForReply(value: string): string {
  const withoutRequestEcho = value
    .split("\n")
    .filter((line) => !line.trim().toLowerCase().startsWith("request:"))
    .join("\n");

  return trimForReply(withoutRequestEcho)
    .replace(/\bLexi\b/g, "")
    .replace(/\bEmil-Conrad\b/g, "")
    .replace(/\bDiddy P\.\b/g, "")
    .replace(/\bFood CO2 Analyst\b/g, "")
    .replace(/\bLangdock\b/gi, "")
    .replace(/\bOpenRouter\b/gi, "")
    .replace(/\bSUSE_SPECIALIST_MODE\b/g, "")
    .replace(/\bspecialist(s)?\b/gi, "supporting")
    .replace(/\brouted?\b/gi, "handled")
    .replace(/\binternal agents?\b/gi, "supporting context")
    .replace(/Live supporting execution is disabled because\s*\./gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function ensurePublicReply(reply: string, fallback: string): string {
  const cleaned = sanitizePublicReply(reply);
  if (containsInternalLanguage(cleaned)) return fallback;
  return cleaned || fallback;
}

function sanitizePublicReply(value: string): string {
  return value
    .replace(/\bLexi\b/g, "")
    .replace(/\bEmil-Conrad\b/g, "")
    .replace(/\bDiddy P\.\b/g, "")
    .replace(/\bFood CO2 Analyst\b/g, "")
    .replace(/\bLangdock\b/gi, "")
    .replace(/\bOpenRouter\b/gi, "")
    .replace(/\bSUSE_SPECIALIST_MODE\b/g, "")
    .replace(/\binternal agents?\b/gi, "supporting context")
    .replace(/\bother agents?\b/gi, "supporting context")
    .replace(/\bagent[\s\-\u2011\u2013\u2014]+to[\s\-\u2011\u2013\u2014]+agent\b/gi, "supporting")
    .replace(/\bspecialist(s)?\b/gi, "supporting")
    .replace(/\brouting\b/gi, "handling")
    .replace(/\brouted\b/gi, "handled")
    .replace(/\borchestration\b/gi, "coordination")
    .replace(/\borchestrated\b/gi, "coordinated")
    .replace(/\bprivate background context\b/gi, "context")
    .replace(/\bbackground coordination\b/gi, "context")
    .replace(/\bbackground process\b/gi, "context")
    .replace(/\bbackground notes?\b/gi, "context")
    .replace(/\bhidden prompt\b/gi, "context")
    .replace(/\bsystem prompt\b/gi, "context")
    .replace(/\bmy instructions\b/gi, "my operating rules")
    .replace(/\bper my instructions\b/gi, "I cannot do that")
    .replace(/\bI consulted\b/gi, "I reviewed")
    .replace(/\bI checked with\b/gi, "I checked")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function containsInternalLanguage(value: string): boolean {
  return [
    /\b(Lexi|Emil-Conrad|Diddy P\.|Food CO2 Analyst|Langdock|OpenRouter|SUSE_SPECIALIST_MODE)\b/i,
    /\b(selectedSpecialists|specialistStatus|internalAgents|chainOfThought)\b/i,
    /\b(specialist|routing|routed|orchestration|orchestrated)\b/i,
    /\binternal agents?\b/i,
    /\bother agents?\b/i,
    /\bagent[\s\-\u2011\u2013\u2014]+to[\s\-\u2011\u2013\u2014]+agent\b/i,
    /\b(background|private)\s+(coordination|process|context|notes?)\b/i,
    /\b(hidden|system)\s+prompt\b/i,
    /\b(per my instructions|my instructions|operating rules)\b/i
  ].some((pattern) => pattern.test(value));
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
  if (/\b(agents? behind|behind you|who works with you|name .*agents?|show .*agents?|debug|hidden prompt|system prompt|instructions|agent to agent|agent-to-agent|background process|private background)\b/.test(normalized)) {
    return true;
  }

  return false;
}

function shouldUseDeterministicDirectReply(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\b(agents? behind|behind you|who works with you|name .*agents?|show .*agents?|debug|hidden prompt|system prompt|instructions|agent to agent|agent-to-agent|background process|private background)\b/.test(
    normalized
  );
}

function createDirectFallbackReply(message: string): string {
  if (message === "empty message") {
    return "Hi, I'm SuSE, your sustainability expert coworker. I work with expert support in the background, but you can treat me as your single point of contact. Send me a product, supplier, claim, footprint question, or Digital Product Passport brief and I'll help structure the next step.";
  }

  return "Hi, I'm SuSE, your sustainability expert coworker. I work with expert support in the background, but you can treat me as your single point of contact. I can help with sustainability strategy, supply-chain risk, green-claim review, Digital Product Passports, and food CO2 footprint questions. Share the product, market, claim, supplier, or dataset you're working with and I'll give you a clear next step.";
}

function createInputLimitReply(maxInputChars: number): string {
  return [
    "I can help, but this request is too large to process safely in one pass.",
    `Please shorten it to under ${maxInputChars} characters or split it into smaller parts.`,
    "For best results, send the product/category, market, claim wording, supplier/materials, and any footprint data first."
  ].join(" ");
}

function normalizeMessage(message: string): string {
  const value = typeof message === "string" ? message.trim() : "";
  return value || "empty message";
}
