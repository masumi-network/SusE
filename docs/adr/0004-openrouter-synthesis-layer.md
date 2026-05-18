# ADR 0004: OpenRouter Synthesis Layer

## Status

Accepted.

## Context

SuSE needs her own answer, not raw specialist transcript output. Specialist routing and calls can be deterministic, but final synthesis needs LLM reasoning and tone.

User will provide OpenRouter key and model later.

## Decision

Use OpenRouter for SuSE's Synthesis Call. Model is configured by `OPENROUTER_MODEL`.

## Consequences

Positive:

- model can be changed without code deploy
- SuSE identity stays centralized
- specialist findings become one coherent answer

Negative:

- OpenRouter availability becomes runtime dependency
- prompt quality matters for consistency
