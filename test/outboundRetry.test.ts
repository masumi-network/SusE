import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";
import { callLangdockSpecialist } from "../src/suse/langdockClient.js";
import { createOpenRouterChatReply } from "../src/suse/openRouterClient.js";
import { SPECIALISTS } from "../src/suse/specialists.js";

test("OpenRouter client retries transient HTTP failures", async () => {
  const config = loadConfig({
    PORT: "3000",
    OPENROUTER_API_KEY: "test-key",
    OPENROUTER_MODEL: "test/model",
    OPENROUTER_MAX_ATTEMPTS: "2",
    OPENROUTER_RETRY_DELAY_MS: "1"
  });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 });
    }

    return new Response(
      JSON.stringify({
        id: "completion_1",
        model: "test/model",
        choices: [{ message: { content: "Synthesis complete." } }]
      }),
      { status: 200 }
    );
  };

  const result = await createOpenRouterChatReply({
    config,
    messages: [{ role: "user", content: "hello" }],
    fetchImpl: fetchImpl as typeof fetch
  });

  assert.equal(calls, 2);
  assert.equal(result.reply, "Synthesis complete.");
});

test("Langdock client retries transient HTTP failures", async () => {
  const config = loadConfig({
    PORT: "3000",
    LANGDOCK_API_KEY: "test-key",
    LANGDOCK_AGENT_ID_LEXI: "agent_lexi",
    LANGDOCK_MAX_ATTEMPTS: "2",
    LANGDOCK_RETRY_DELAY_MS: "1"
  });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ message: "upstream unavailable" }), { status: 503 });
    }

    return new Response(JSON.stringify({ output: "Lexi finding." }), { status: 200 });
  };

  const result = await callLangdockSpecialist({
    config,
    specialist: SPECIALISTS[0]!,
    brief: "Assess supplier risk.",
    fetchImpl: fetchImpl as typeof fetch
  });

  assert.equal(calls, 2);
  assert.equal(result.status, "completed");
  assert.equal(result.content, "Lexi finding.");
});

