# SADR 0002: Orchestration Run Service

## Status

Suggested. Not approved.

## Context

`createSuseReply` currently does full path:

- normalize input
- direct reply detection
- select specialists
- call specialists
- synthesize final answer
- sanitize public reply

This works. But run internals are implicit.

No first-class object for:

- route plan
- selected workers
- briefs
- results
- assumptions
- usage
- fallback path

## Suggestion

Extract orchestration into `OrchestrationRun`.

Return structured result:

```ts
type OrchestrationRunResult = {
  runId: string;
  correlationId: string;
  routePlan: RoutePlan;
  workerResults: WorkerResult[];
  finalAnswer: string;
  publicMetadata: Record<string, unknown>;
  internalTrace: OrchestrationTrace;
  billingUsage: BillingUsage;
};
```

Keep current behavior. Change shape around behavior first.

Run service should have two outputs:

- public output: safe answer + public metadata
- internal output: trace + usage + route plan

Public output must stay blind to internal worker names/providers.

## Why

SuSE is "thinking layer", not pass-through router. Thinking layer needs inspectable run state.

Run service gives:

- better tests
- safer logging
- easier replay
- budget accounting
- later queue/executor split
- future Messenger handoff payload
- later MIP-003 result hash/decision logging

## What Changes

HTTP routes call orchestration service, not direct `createSuseReply` internals.

Task worker uses same service.

Public response stays same:

- no internal agent names
- no routing details
- no vendor names

Internal DB/logs gain:

- route plan
- timings
- errors
- model/provider usage
- fallback reason

## First Slice

Refactor only. No behavior change.

1. create `OrchestrationRun` type
2. wrap current `createSuseReply` flow
3. generate `runId` and `correlationId`
4. return internal trace to caller
5. save nothing yet unless SADR 0001 accepted

## Acceptance Checks

- existing endpoint tests still pass
- same user-visible output shape
- prompt-injection test still blocks internals
- internal trace has route plan and timings
- public metadata excludes worker/provider names

## Risks

- refactor can break current simple path
- trace storage may accidentally capture sensitive content
- public/private metadata boundary must stay strict
- too much type shape before ledger can become churn

## Review Questions

- Store full traces or compact summaries?
- Should raw specialist findings be retained? If yes, for how long?
- Should trace content be encrypted at rest?
- Should run service be pure in-process first, DB-aware later?
