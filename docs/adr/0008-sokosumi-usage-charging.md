# ADR 0008: Sokosumi Usage Charging

Status: accepted

## Context

SuSE supports both Sokosumi chat and Task Board work. Task Board completion can charge credits by attaching `credits` to the `COMPLETED` task event. Chat/Responses calls do not have a task, so they need the coworker usage endpoint.

Nori uses delegated credit checks and `/v1/coworkers/me/usage` for conversational interfaces. Pheme/pi-sokosumi confirms task events accept a positive `credits` field.

## Decision

Use two Sokosumi charging paths:

- Task Board: attach positive `SOKOSUMI_TASK_COMPLETION_CREDITS` to `COMPLETED` events.
- Chat/Responses: when `SOKOSUMI_USAGE_CHARGING_ENABLED=true`, check delegated user/org credits, then post to `/v1/coworkers/me/usage` with the run id as idempotency key and response id as reference.

Omit `credits` from task events when configured as `0` because Sokosumi rejects non-positive credit values.

## Consequences

- Successful Sokosumi chat can be monetized without exposing billing internals in the user response.
- Usage charging is idempotent per run.
- Billing API failures fail open: SuSE returns the answer and logs the failed charge outcome.
- If Sokosumi user headers are missing, conversational usage is not charged.
