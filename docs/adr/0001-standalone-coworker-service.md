# ADR 0001: Standalone Coworker Service

## Status

Accepted.

## Context

SuSE needs Nori-like Sokosumi coworker behavior, but not Nori's full stack.

Nori includes many unrelated interfaces and subsystems:

- email
- Twitter
- GitHub
- Telegram
- memory
- A2A
- Masumi Messenger
- full task hierarchy

## Decision

Build SuSE as a standalone Railway service. Use Nori only as protocol reference for Sokosumi coworker endpoints.

## Consequences

Positive:

- smaller codebase
- faster deploy
- easier audit
- less accidental coupling

Negative:

- must implement needed endpoint compatibility directly
- less reuse from Nori internals
