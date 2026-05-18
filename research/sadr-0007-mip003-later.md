# SADR 0007: Masumi MIP-003 Later

## Status

Suggested. Not approved.

## Context

SuSE is Sokosumi coworker now.

Current public surface:

- `/v1/conversations`
- `/v1/responses`
- Task Board polling/events

Current ADRs reject public MIP-003 `/start_job` for v1.

Direct Langdock specialist calls avoid nested Sokosumi/Masumi paid routes.

## Suggestion

Do not add MIP-003 endpoints now.

Add MIP-003 only when one of these becomes true:

- SuSE becomes standalone paid public agentic service outside Sokosumi chat
- SuSE hires paid external agentic services
- on-chain payment verification becomes requirement
- registry identity needs advanced Masumi service metadata

Before that, add operator record for:

- Sokosumi registration
- network
- base URL
- coworker key rotation
- pricing/credits
- legal links
- privacy policy
- terms
- advertised processing time
- support/contact owner

## Why

MIP-003 adds required endpoints and payment lifecycle.

Useful later, heavy now.

Current missing piece is orchestration durability, not public payment protocol.

## What Changes

No code change now.

Later, add:

- `/start_job`
- `/status`
- `/availability`
- `/input_schema`
- payment/decision logging integration
- result hash handling
- registry metadata

This should be separate ADR if approved.

## First Slice

No MIP-003 code.

Create operator record:

- current Sokosumi slug
- current base URL
- current capabilities
- current network
- key rotation process
- pricing/credit policy
- legal docs status
- mainnet readiness flag

## Acceptance Checks

- no `/start_job` route added
- no nested paid specialist call added
- operator record exists
- preprod/mainnet status clear
- key rotation owner clear

## Risks

- delaying MIP-003 may limit agent-to-agent paid marketplace use
- adding it too early may slow current Sokosumi coworker stabilization
- payment/identity work can distract from Task Board stability

## Review Questions

- Is SuSE meant to sell outside Sokosumi chat?
- Does task credit accounting satisfy near-term business need?
- When do we need on-chain decision logging?
- What legal/privacy docs needed before public paid service?

## Research Notes

Masumi MIP-003 requires agentic service endpoints for job start, status, availability, input schema. That is separate from current Sokosumi Responses/Task Board surface.

Sources:

- https://docs.masumi.network/mips/_mip-003
- https://docs.masumi.network/core-concepts/agentic-service

