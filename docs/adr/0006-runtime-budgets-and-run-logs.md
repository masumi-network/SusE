# ADR 0006: Runtime Budgets And Run Logs

## Status

Accepted.

## Context

SuSE runs background calls to external providers and mutates Sokosumi Task Board state.

Without basic budgets, a single large or adversarial request can create excessive prompt size or background fanout.

Without internal run identifiers, operators have to reconstruct behavior from generic HTTP logs.

## Decision

Add minimal runtime guardrails:

- `SUSE_MAX_INPUT_CHARS`
- `SUSE_MAX_SPECIALISTS_PER_RUN`
- internal run id
- internal correlation id
- structured `suse_run_completed` logs

These are internal operator signals. Public responses must not expose run ids, correlation ids, worker counts, providers, or route details.

## Consequences

Positive:

- safer handling of oversized prompts
- bounded background fanout
- easier Railway log inspection
- foundation for future metrics and recovery

Negative:

- broad prompts may need user splitting
- logs are still not full metrics
- per-user and per-org quotas remain future work
