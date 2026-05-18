# SADR 0004: Queue, Concurrency, Backpressure

## Status

Suggested. Not approved.

## Context

Task poller is serial. Specialist calls use `Promise.all`.

There is no explicit:

- global worker concurrency
- per-provider concurrency
- queue depth
- backpressure
- stale lock cleanup
- dead-letter state

For low traffic, fine. For orchestrator role, risky.

## Suggestion

Add DB-backed work queue first.

Use Postgres:

- `status = queued | running | completed | failed | dead_letter`
- `locked_by`
- `locked_until`
- `priority`
- `attempt`
- `next_attempt_at`

Use `FOR UPDATE SKIP LOCKED` for worker claim.

Add config:

- `SUSE_WORKER_ENABLED`
- `SUSE_WORKER_MAX_CONCURRENT`
- `SUSE_LANGDOCK_MAX_CONCURRENT`
- `SUSE_OPENROUTER_MAX_CONCURRENT`
- `SUSE_TASK_STALE_AFTER_MS`

Redis/BullMQ can come later if volume demands it.

Do not add Temporal now. Do not add BullMQ now unless Redis already exists for another approved reason.

## Why

Backpressure protects:

- Langdock
- OpenRouter
- Sokosumi
- Railway service
- user credits

DB queue gives enough durability without adding Redis too early.

Postgres works because:

- app already depends on Postgres
- queue volume likely low/medium first
- `SKIP LOCKED` supports multiple consumers claiming rows without blocking

BullMQ works later when:

- Redis is accepted infra
- delayed/repeatable jobs become core
- many workers/processes need mature queue ops
- rate limiting needs move out of app code

Temporal works later when:

- workflow history/replay matters more than simple state machine
- multi-day workflows become common
- signals/human pauses become central
- team accepts Temporal server/runtime ops

## What Changes

HTTP app and worker can split.

Before:

- request/poller does work directly

After:

- request/task creates work item
- worker claims work item
- executor runs with concurrency caps
- final state persisted

For chat, can still run inline until async chat needed.

For Task Board, queue is better default.

## First Slice

Only after SADR 0001.

1. add work item table
2. add claim query with `FOR UPDATE SKIP LOCKED`
3. add one worker loop
4. add global concurrency cap
5. keep chat inline
6. run Task Board through queue

## Acceptance Checks

- two worker loops do not claim same work item
- `locked_until` expiry makes stale item claimable
- per-provider cap prevents too many Langdock/OpenRouter calls
- queue depth visible in logs/health
- task completion remains idempotent

## Risks

- more moving parts
- harder local dev
- need Railway worker process
- long-running tasks need progress/heartbeat
- DB queue can become bottleneck at high volume

## Review Questions

- Split worker now or after ledger?
- Should chat remain inline?
- When does BullMQ become worth Redis dependency?
- What volume threshold means "leave Postgres queue"?

## Research Notes

Postgres docs: `SKIP LOCKED` useful for queue-like table access, but returns inconsistent view. Good for claim loop.

BullMQ docs: supports worker concurrency, multiple workers, rate limiting, retry behavior. Better once Redis dependency accepted.

Sources:

- https://www.postgresql.org/docs/current/sql-select.html
- https://docs.bullmq.io/guide/workers/concurrency
- https://docs.bullmq.io/guide/rate-limiting
