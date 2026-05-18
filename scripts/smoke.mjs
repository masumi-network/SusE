const baseUrl = stripTrailingSlash(process.env.SMOKE_BASE_URL || "http://localhost:3000");

await checkJson("GET", "/health", undefined, (body) => {
  assert(body.status === "ok", "health status should be ok");
});

await checkJson("GET", "/ready", undefined, (body) => {
  assert(body.status === "ready", "ready status should be ready");
});

const conversation = await checkJson(
  "POST",
  "/v1/conversations",
  {
    metadata: {
      source: "smoke"
    }
  },
  (body) => {
    assert(typeof body.id === "string", "conversation id should exist");
  }
);

const response = await checkJson(
  "POST",
  "/v1/responses",
  {
    conversation: conversation.id,
    input: "Smoke test: review a supplier sustainability risk.",
    stream: false
  },
  (body) => {
    assert(body.status === "completed", "response should complete");
    assert(typeof body.output_text === "string" && body.output_text.length > 0, "response text should exist");
  }
);

await checkJson("GET", `/v1/responses/${response.id}`, undefined, (body) => {
  assert(body.id === response.id, "stored response should be retrievable");
});

await checkSse("/v1/responses", {
  input: "Smoke test: calculate food CO2.",
  stream: true
});

console.log(JSON.stringify({ ok: true, baseUrl }));

async function checkJson(method, path, payload, validate) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(`${method} ${path} failed with ${res.status}: ${text}`);
  }

  validate(body);
  return body;
}

async function checkSse(path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${path} SSE failed with ${res.status}: ${text}`);
  }

  assert(res.headers.get("content-type")?.includes("text/event-stream"), "SSE content-type expected");
  assert(text.includes("event: response.created"), "SSE response.created expected");
  assert(text.includes("event: response.output_text.delta"), "SSE text delta expected");
  assert(text.includes("event: response.completed"), "SSE response.completed expected");
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

