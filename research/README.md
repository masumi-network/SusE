# SuSE Research Notes

Status: suggestions only. Not approved.

Purpose: index suggestion ADRs for review.

Use `SADR` prefix here:

- `SADR` = Suggestion ADR
- not accepted
- not implementation mandate
- review needed before code changes

## SADR Index

| SADR | Suggestion | Why It Exists | Depends On |
| --- | --- | --- | --- |
| [0001](./sadr-0001-durable-task-run-ledger.md) | Durable Task Run Ledger | make Task Board work idempotent/recoverable | none |
| [0002](./sadr-0002-orchestration-run-service.md) | Orchestration Run Service | make SuSE thinking layer inspectable/testable | 0001 preferred |
| [0003](./sadr-0003-worker-capability-registry.md) | Worker Capability Registry | replace hard-coded specialists with routeable worker inventory | 0002 preferred |
| [0004](./sadr-0004-queue-concurrency-backpressure.md) | Queue, Concurrency, Backpressure | protect providers/credits via worker caps and queue claim | 0001 |
| [0005](./sadr-0005-observability-budgets-recovery.md) | Observability, Budgets, Recovery | operate SuSE under failure/cost pressure | 0001, 0002 |
| [0006](./sadr-0006-agent-messenger-v2-transport.md) | Agent Messenger As V2 Transport | add async external coworker/human approval path later | 0001, 0002, 0003 |
| [0007](./sadr-0007-mip003-later.md) | Masumi MIP-003 Later | defer paid public agentic-service protocol until needed | 0001, 0005 |
| [0008](./sadr-0008-durable-workflow-engine-later.md) | Durable Workflow Engine Later | defer Temporal-style workflow engine until DB queue insufficient | 0001, 0004 |

## Suggested Review Order

1. SADR 0001
2. SADR 0002
3. SADR 0005
4. SADR 0003
5. SADR 0004
6. SADR 0006
7. SADR 0007
8. SADR 0008

## Core Learning

SuSE v1 works as chat/task coworker. Missing piece is not more agents. Missing piece is durable orchestration substrate.

Current risk:

- task poller tracks processed events in memory
- specialist fanout has no per-provider cap
- run details are not stored as first-class records
- cost/usage not tied to run
- recovery path is manual/implicit

Best next milestone:

1. prove real Task Board E2E
2. add durable run/task ledger
3. add correlation IDs + internal traces
4. add capability registry
5. then add queue/concurrency

## External Research Notes

Official docs used:

- PostgreSQL `FOR UPDATE SKIP LOCKED`: queue-like table use, but inconsistent view warning. Good for worker claim, not general reads. Source: https://www.postgresql.org/docs/current/sql-select.html
- BullMQ concurrency/rate limit: useful after Redis becomes worth it. Source: https://docs.bullmq.io/guide/workers/concurrency and https://docs.bullmq.io/guide/rate-limiting
- OpenTelemetry JS: traces/metrics stable, logs development. Source: https://opentelemetry.io/docs/languages/js/
- Temporal TypeScript: strong durable workflow layer, but adds server/runtime model. Source: https://nodejs.temporal.io/
- Masumi MIP-003: required for public agentic service API. Source: https://docs.masumi.network/mips/_mip-003
