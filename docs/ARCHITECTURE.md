# Architecture

## Goal

SuSE is one public Sokosumi coworker. She handles chat and Task Board work, consults specialist sustainability agents internally, then returns one synthesized answer.

User-facing boundary: SuSE may say she has expert support, but she must not expose internal agent names, routing, tools, vendors, transcripts, or coordination metadata. Agent-to-agent work remains background-only.

## Runtime

```txt
Sokosumi chat/task UI
  -> SuSE Railway HTTP service
  -> Railway Postgres for durable state
  -> Langdock API for specialist calls
  -> OpenRouter for SuSE synthesis
  -> Sokosumi response stream or task event
```

## Public Interfaces

SuSE exposes a Nori/Pheme-style coworker chat surface:

- `POST /v1/conversations`
- `GET /v1/conversations/:id`
- `POST /v1/conversations/:id`
- `DELETE /v1/conversations/:id`
- `GET /v1/conversations/:id/items`
- `GET /v1/conversations/:id/items/:itemId`
- `DELETE /v1/conversations/:id/items/:itemId`
- `POST /v1/responses`
- `GET /v1/responses/:responseId`
- `GET /health`
- `GET /ready`

Task Board work is not only inbound HTTP. SuSE also authenticates as a coworker and polls:

- `GET /v1/coworkers/me/events`
- `GET /v1/tasks/:taskId`
- `POST /v1/tasks/:taskId/events`

## Main Modules

### Coworker Surface

HTTP module accepting Sokosumi chat requests and returning OpenAI Responses-compatible JSON or SSE.

Depth target: callers know only Responses/Conversations shapes. Internal orchestration stays hidden.

### Conversation Store

Postgres module storing conversations, items, response-thread mapping, completed responses, task-processing cursors, and idempotency records.

Depth target: HTTP handlers never manipulate SQL directly.

### Task Board Worker

Poller module adapted from `pi-sokosumi`. It finds ready task events, posts `RUNNING`, sends task content through SuSE orchestration, then posts `COMPLETED` or `FAILED`.

Depth target: SuSE task behavior is callback-driven; generic polling stays separate.

### Specialist Router

Deterministic module selecting which Specialist Coworkers to call.

Inputs:

- user request
- conversation/task metadata
- previous specialist findings, if any

Outputs:

- ordered call plan
- focused specialist briefs
- stop condition

### Langdock Adapter

Adapter around Langdock chat completions. It maps specialist slug to Langdock agent id from env and returns normalized text/JSON findings.

Depth target: router never knows HTTP headers, retries, timeout shape, or Langdock response parsing.

### Orchestration Run

Module implementing SuSE's Thinking Layer for one user request or Task Board task. It owns budget checks, direct replies, background worker selection, worker calls, synthesis, public-output sanitization, and internal run metadata.

Depth target: chat and Task Board callers use one stable SuSE reply interface; orchestration details stay local.

### Synthesis Adapter

Adapter around OpenRouter chat completions. It receives request, call plan, specialist findings, unresolved assumptions, and produces final SuSE answer.

Depth target: business code never knows OpenRouter HTTP details.

## State Model

Use Postgres for durable state:

- conversations
- conversation items
- response id -> thread id mapping
- completed responses
- task event cursor/idempotency
- task run ledger with leases, attempts, event ids, hashes, and final state
- task status and completion payload

Use memory only for active request state:

- specialist call plan
- specialist findings for current run
- retry/backoff state
- transient SSE event assembly

## Streaming

If `/v1/responses` receives `stream: true`, return SSE. Pheme proved Sokosumi chat expects streaming for smooth display.

Minimum event sequence:

1. `response.created`
2. `response.output_item.added`
3. `response.content_part.added`
4. `response.output_text.delta`
5. `response.output_text.done`
6. `response.content_part.done`
7. `response.output_item.done`
8. `response.completed`

## Reliability

- Direct Langdock call timeout per specialist.
- Retry transient 429/5xx with short capped backoff.
- Continue with partial specialist results if one non-critical specialist fails.
- Fail whole task only when SuSE cannot produce a useful answer.
- Task poller must skip already-progressed tasks after restart.
- DB writes must be idempotent on response/task ids.

## Security

- API keys only in Railway env.
- Never log Langdock IDs, OpenRouter key, Sokosumi coworker key, raw Authorization headers.
- Redact body previews by default.
- Do not expose specialist internal transcripts unless deliberately included in final output.
- Do not expose internal agent names, routing, vendors, tools, or coordination metadata in final user-facing payloads.
