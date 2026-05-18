# Implementation Plan

## Phase 0 - Scaffold

Status: complete.

- Node 20 service.
- TypeScript or JS with strict structure.
- Railway start command.
- Health and readiness endpoints.
- Postgres connection and migrations.

Acceptance:

- `GET /health` returns 200.
- `GET /ready` checks DB and required env.

## Phase 1 - Sokosumi Chat

Status: complete for local/test contract. Needs live Sokosumi verification after deploy.

- Conversations endpoints.
- Responses endpoint.
- SSE support for `stream: true`.
- Completed response persistence.
- Conversation item persistence.

Acceptance:

- Sokosumi can create conversation.
- Sokosumi can send streamed chat.
- `GET /v1/responses/:id` returns completed response.

## Phase 2 - SuSE Core

Status: complete for code path. Needs live Langdock/OpenRouter verification after secrets are configured.

- SuSE identity prompt.
- Specialist registry.
- Deterministic routing.
- Langdock adapter.
- OpenRouter synthesis adapter.

Acceptance:

- Narrow request calls one specialist.
- Broad request can call multiple specialists.
- Final answer is synthesized, not transcript dump.

## Phase 3 - Task Board

Status: complete for code path. Needs live Sokosumi Task Board verification after deploy.

- Vendored/adapted `pi-sokosumi` client and poller.
- Poll ready task events.
- Claim with `RUNNING`.
- Process through SuSE core.
- Post `COMPLETED` or `FAILED`.
- Skip already-progressed tasks after restart.

Acceptance:

- Ready task processed once.
- Duplicate poll/restart does not double-complete.

## Phase 4 - Production Hardening

Status: partially complete. Basic tests, log redaction, readiness checks, Postgres migrations, adapter timeouts, and partial specialist failure fallback exist.

- Structured logs.
- Redaction.
- Timeouts/retries.
- Partial specialist failure behavior.
- DB idempotency.
- Basic tests.
- Railway deploy docs.

Acceptance:

- No secrets in logs.
- All endpoint smoke tests pass.
- Failure paths return useful user-safe messages.

## Phase 5 - Registration

Status: not started.

- Register SuSE as Sokosumi coworker.
- Base URL: `https://<domain>/v1`.
- Capabilities: `chat`, `tasks`.
- Configure coworker API key on Railway.

Acceptance:

- Sokosumi chat works.
- Task Board works.
