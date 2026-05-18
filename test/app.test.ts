import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";

process.env.SUSE_LOG_LEVEL = "silent";

test("health and ready work in memory mode", async () => {
  const config = loadConfig({
    PORT: "3000",
    SUSE_STORAGE: "memory",
    SUSE_RUNTIME_MODE: "stub",
    SUSE_SPECIALIST_MODE: "stub"
  });
  const store = createMemoryStore();
  const app = createApp({ config, store });

  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().agent, "SuSE");

  const ready = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json().status, "ready");

  await app.close();
  await store.close();
});

test("responses route persists completed response and conversation items", async () => {
  const config = loadConfig({ PORT: "3000", SUSE_STORAGE: "memory" });
  const store = createMemoryStore();
  const app = createApp({ config, store });

  const conversationResponse = await app.inject({
    method: "POST",
    url: "/v1/conversations",
    payload: {
      metadata: {
        source: "test"
      }
    }
  });
  assert.equal(conversationResponse.statusCode, 200);
  const conversation = conversationResponse.json();

  const response = await app.inject({
    method: "POST",
    url: "/v1/responses",
    payload: {
      conversation: conversation.id,
      input: "Review this green claim for compliance and sustainability risk."
    }
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.object, "response");
  assert.equal(body.status, "completed");
  assert.match(body.output_text, /Emil-Conrad/);

  const fetched = await app.inject({
    method: "GET",
    url: `/v1/responses/${body.id}`
  });
  assert.equal(fetched.statusCode, 200);
  assert.equal(fetched.json().id, body.id);

  const items = await app.inject({
    method: "GET",
    url: `/v1/conversations/${conversation.id}/items`
  });
  assert.equal(items.statusCode, 200);
  assert.equal(items.json().data.length, 2);

  await app.close();
  await store.close();
});

test("greetings and capability questions answer directly without specialist routing", async () => {
  const config = loadConfig({ PORT: "3000", SUSE_STORAGE: "memory" });
  const store = createMemoryStore();
  const app = createApp({ config, store });

  const response = await app.inject({
    method: "POST",
    url: "/v1/responses",
    payload: {
      input: "hii how can you help me"
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.metadata.route, "direct");
  assert.deepEqual(body.metadata.selectedSpecialists, []);
  assert.doesNotMatch(body.output_text, /I routed this through/i);
  assert.doesNotMatch(body.output_text, /Live specialist execution is disabled/i);
  assert.match(body.output_text, /SuSE/);

  await app.close();
  await store.close();
});

test("responses route supports SSE streaming", async () => {
  const config = loadConfig({ PORT: "3000", SUSE_STORAGE: "memory" });
  const store = createMemoryStore();
  const app = createApp({ config, store });

  const response = await app.inject({
    method: "POST",
    url: "/v1/responses",
    payload: {
      input: "Calculate food CO2 for a pasta recipe.",
      stream: true
    }
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] as string, /text\/event-stream/);
  assert.match(response.payload, /event: response\.created/);
  assert.match(response.payload, /event: response\.output_text\.delta/);
  assert.match(response.payload, /event: response\.completed/);

  await app.close();
  await store.close();
});
