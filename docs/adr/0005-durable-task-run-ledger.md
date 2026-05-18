# ADR 0005: Durable Task Run Ledger

## Status

Accepted.

## Context

SuSE polls Sokosumi Task Board events and posts `RUNNING`, `COMPLETED`, or `FAILED`.

The first implementation used in-memory event tracking. That was enough for smoke tests, but not enough for production restarts or duplicate polling.

## Decision

Store Task Board run idempotency in the same Postgres-backed storage module as conversations.

The ledger stores:

- task event id
- task id
- run id
- correlation id
- run status
- attempt
- lease owner and lease expiry
- external `RUNNING` and `COMPLETED` event ids when available
- input/output/final answer hashes
- final error summary

The ledger does not store raw user prompt or final answer text.

## Consequences

Positive:

- duplicate task events are skipped across process restarts
- stale claimed/running work can be reclaimed after lease expiry
- completed runs are not completed twice
- future observability and recovery work has a durable base

Negative:

- storage interface is wider
- task worker now depends on the storage module
- stale-run repair policy still needs operator-level decisions
