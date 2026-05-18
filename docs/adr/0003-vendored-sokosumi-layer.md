# ADR 0003: Vendored Sokosumi Layer

## Status

Accepted.

## Context

`pi-sokosumi` exists inside sibling repo `pheme`. It provides useful coworker API client and task poller code, but it is not published to npm.

Railway deployments should not depend on sibling repo paths unless deployed as one monorepo.

## Decision

Use `pi-sokosumi` as source/reference. Vendor or adapt needed pieces into SuSE so production deploy is self-contained.

## Consequences

Positive:

- reliable Railway build
- no cross-repo runtime dependency
- SuSE can evolve independently

Negative:

- potential duplication until `pi-sokosumi` is published
- future shared fixes must be synced deliberately
