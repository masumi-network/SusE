# ADR 0002: Direct Langdock Specialist Calls

## Status

Accepted.

## Context

Four specialist sustainability coworkers already exist on Sokosumi and are backed by Langdock agents through the Langdock Masumi wrapper.

Options:

1. SuSE hires each specialist through Sokosumi.
2. SuSE calls the wrapper `/agents/:slug/start_job` routes.
3. SuSE calls Langdock directly with specialist agent ids.

Nested Sokosumi hires and wrapper payment routes add latency, payment complexity, and extra job state.

## Decision

SuSE v1 calls Langdock directly for internal specialist work.

## Consequences

Positive:

- fastest response path
- one public paid coworker: SuSE
- simpler internal orchestration

Negative:

- specialist work is not independently visible as Sokosumi jobs
- SuSE must handle internal audit/logging itself
