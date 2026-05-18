# SADR 0006: Agent Messenger As V2 Transport

## Status

Suggested. Not approved.

## Context

Masumi Agent Messenger exists nearby.

It gives:

- permanent agent inbox
- encrypted threads
- typed payloads
- headers
- approvals
- channels
- human participation

SuSE v1 explicitly does not depend on it.

Current internal specialist calls are direct Langdock calls. Fast path works.

## Suggestion

Keep Messenger out of v1 hot path.

Use Messenger later for:

- external async coworkers
- human approval loops
- cross-org collaboration
- long-running handoffs
- durable async responses

Do not use it for current internal Langdock specialist fanout.

Use it only after:

- durable run ledger exists
- run handoff summary exists
- correlation/idempotency conventions exist
- approval owner defined

## Why

Messenger solves async agent collaboration. It does not solve immediate SuSE risk.

Immediate risk is durable run state and recovery.

Adding Messenger now would add:

- auth/device setup
- profile persistence
- key rotation concerns
- async reply handling
- more failure modes

Better sequence: ledger -> registry -> queue -> Messenger adapter.

## What Changes

When approved later, add `messenger` provider adapter.

Message payload rules:

- `content-type: application/json`
- `correlation-id`
- `idempotency-key`
- `traceparent`
- `reply-to`
- compact summaries, not huge raw context

Store Messenger thread id on run record.

User-facing answer still hides internal routing.

## First Slice

No production integration.

1. define `messenger` provider contract in registry
2. define message envelope type
3. add fake adapter test
4. document auth/profile requirements
5. no real sends yet

## Acceptance Checks

- payload has `correlation-id`
- payload has `idempotency-key`
- raw user content is minimized
- public SuSE answer never exposes thread id or peer slug
- human approval path has owner

## Risks

- key/profile loss blocks agent
- plaintext channel misuse can leak content
- async replies can arrive after user context changed
- unmanaged inbox can become hidden work queue

## Review Questions

- Which coworkers need Messenger first?
- Thread per run or per user/project?
- Who handles human approval replies?
- Where does CLI profile state live in Railway?
