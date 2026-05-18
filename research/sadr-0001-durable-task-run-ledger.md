# SADR 0001: Durable Task Run Ledger

## Status

Suggested. Not approved.

## Context

SuSE polls Sokosumi Task Board and posts `RUNNING`, `COMPLETED`, or `FAILED`.

Current poller uses in-memory `processedEventIds`. Restart loses this state.

Postgres currently stores:

- conversations
- conversation items
- completed responses

Postgres does not yet store:

- task event idempotency
- run attempts
- worker lease
- final answer hash
- stuck task state

This contradicts architecture intent: docs say task cursors/idempotency belong in durable state, but schema does not yet do it.

## Suggestion

Add durable task/run tables.

Minimum tables:

- `suse_task_events`
- `suse_worker_runs`

Minimum fields:

- `run_id`
- `task_id`
- `event_id`
- `correlation_id`
- `status`
- `attempt`
- `claimed_at`
- `heartbeat_at`
- `completed_at`
- `claim_event_id`
- `completion_event_id`
- `last_error`
- `final_answer_hash`
- `input_hash`
- `output_hash`
- `lease_owner`
- `lease_expires_at`

`event_id` should be unique.

Keep body text out of ledger where possible. Store hashes + compact summary. Full answer can remain in completed response/task event.

## Why

Task Board mutation is side effect. Side effect needs durable idempotency.

Crash cases now dangerous:

- crash after `RUNNING` before final answer
- restart forgets processed events
- duplicated poll page repeats work
- stuck task has no repair state

Ledger turns task work from best-effort polling into recoverable workflow.

## What Changes

Poller stops relying on memory set for correctness.

Before processing:

1. claim event in DB
2. create run row
3. post Sokosumi `RUNNING`
4. execute SuSE run
5. persist final state
6. post `COMPLETED` or `FAILED`

Restart can inspect DB and decide:

- already completed -> skip
- running but heartbeat stale -> retry or mark failed
- failed retryable -> retry
- failed terminal -> skip

## First Slice

No queue yet.

Do:

1. add schema
2. add store methods
3. poller writes run rows
4. duplicate event test
5. stale `RUNNING` test

Do not:

- split worker process
- add Redis
- add Messenger
- add MIP-003

## Risks

- more schema complexity
- need migration discipline
- need repair policy for stale runs
- hashes may not be enough for debug
- too much stored text creates privacy risk

## Acceptance Checks

- same event processed once across repeated `tick()`
- crash-like state after `RUNNING` can be detected
- completed run cannot be completed twice
- failed run records last error
- no public response metadata exposes run internals

## Research Notes

Postgres row locks can support queue-like consumers via `FOR UPDATE SKIP LOCKED`. Official docs warn skipped rows give inconsistent view, so use only for worker claim, not user-facing reads.

Source: https://www.postgresql.org/docs/current/sql-select.html

## Review Questions

- Is Postgres enough, or need Redis later?
- How long before `RUNNING` becomes stale?
- Should failed runs auto-retry or wait for operator?
- Store raw request text, compact summary, or hashes only?
