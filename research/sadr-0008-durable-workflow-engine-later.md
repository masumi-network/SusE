# SADR 0008: Durable Workflow Engine Later

## Status

Suggested. Not approved.

## Context

Some agent orchestration stacks use durable workflow engines.

Temporal TypeScript gives workflow/activity runtime, clients, workers, testing, OpenTelemetry interceptors.

This may fit future SuSE if:

- workflows run for days
- human signals become normal
- replay/history matters
- many async external agents join
- compensation logic grows

Current SuSE does not need that yet.

## Suggestion

Do not add Temporal now.

Use local Postgres run ledger + queue first.

Revisit Temporal after:

- queue exists
- run state exists
- stuck/retry cases are measured
- Messenger or external paid agents create long waits

## Why

Temporal solves durable workflow orchestration. It also adds:

- server ops
- worker deployment model
- deterministic workflow constraints
- activity boundaries
- new local dev burden

SuSE current work can be modeled as:

- task event
- run row
- worker calls
- final answer

That does not justify Temporal yet.

## What Changes

No code change now.

Later possible migration:

- `OrchestrationRun` becomes workflow
- specialist/model/API calls become activities
- Task Board events become workflow signals/updates
- run ledger becomes projection/read model

## First Slice

No implementation.

Add decision checkpoint:

- after queue shipped
- after 30 days production data
- if stale/retry cases exceed manual comfort

## Acceptance Checks For Future Adoption

- clear workflow boundaries
- activities idempotent
- Temporal server hosting plan approved
- local dev/test path clear
- migration path from run ledger clear

## Risks

- premature platform migration
- duplicated state between Temporal history and Postgres
- deterministic workflow rules surprise contributors
- cost/ops increase

## Review Questions

- What failure cases cannot be solved by Postgres run ledger?
- How many long-running waits justify Temporal?
- Who operates Temporal server/cloud?
- Should Temporal replace queue or only durable workflows?

## Research Notes

Temporal TS docs expose separate packages for worker, workflow, activity, client, testing, and OpenTelemetry interceptors. Good sign for mature workflow layer. Still heavier than current need.

Source: https://nodejs.temporal.io/

