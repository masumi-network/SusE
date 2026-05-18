import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";
import { createHttpSokosumiClient } from "../src/sokosumi/client.js";

test("Sokosumi client omits non-positive task event credits", async () => {
  const config = loadConfig({
    PORT: "3000",
    SUSE_STORAGE: "memory",
    SOKOSUMI_COWORKER_API_KEY: "coworker-token"
  });
  let capturedBody: unknown;
  const client = createHttpSokosumiClient({
    config,
    fetchImpl: async (_url, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return jsonResponse({ data: { id: "evt_1" } }, 201);
    }
  });

  await client.createTaskEvent("task_1", {
    status: "COMPLETED",
    origin: "SOKOSUMI",
    comment: "Done",
    credits: 0
  });

  assert.deepEqual(capturedBody, {
    status: "COMPLETED",
    origin: "SOKOSUMI",
    comment: "Done"
  });
});

test("Sokosumi client checks delegated organization credits", async () => {
  const config = loadConfig({
    PORT: "3000",
    SUSE_STORAGE: "memory",
    SOKOSUMI_COWORKER_API_KEY: "coworker-token"
  });
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> = {};
  const client = createHttpSokosumiClient({
    config,
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
      return jsonResponse({ data: { credits: { total: 42 } } });
    }
  });

  const credits = await client.getDelegatedCredits({
    userId: "user-123",
    organizationId: "org-456"
  });

  assert.equal(credits, 42);
  assert.match(capturedUrl, /\/v1\/users\/user-123\/organizations\/org-456\/credits$/);
  assert.equal(capturedHeaders.authorization, "Bearer coworker-token");
  assert.equal(capturedHeaders["x-delegation-user-id"], "user-123");
  assert.equal(capturedHeaders["x-delegation-organization-id"], "org-456");
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
