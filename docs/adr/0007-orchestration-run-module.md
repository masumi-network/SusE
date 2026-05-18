# ADR 0007: Orchestration Run Module

## Status

Accepted.

## Context

SuSE's public `createSuseReply` API is used by chat and Task Board processing.

The implementation behind that API had grown to include:

- budget checks
- direct reply handling
- background worker selection
- background worker calls
- synthesis
- public-output sanitization
- internal run metadata

## Decision

Keep `src/suse/agent.ts` as the stable public SuSE reply module, and move the implementation into `src/suse/orchestrationRun.ts`.

The Orchestration Run module owns the internal Thinking Layer flow and returns:

- safe final answer
- public-safe metadata
- internal run data for logs and future ledger/metrics work

## Consequences

Positive:

- caller interface remains stable
- orchestration behavior is easier to find and test
- future run tracing, replay, and storage work has a named module
- public/private output rules stay centralized

Negative:

- one more module exists
- deeper trace persistence is still future work
