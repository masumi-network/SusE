# SADR 0003: Worker Capability Registry

## Status

Suggested. Not approved.

## Context

SuSE has four specialists hard-coded in `specialists.ts`.

Each specialist has:

- slug
- name
- focus
- keywords

This is fine for v1. It is weak for orchestrator role.

Missing:

- provider type
- availability
- latency target
- cost model
- max concurrency
- retry policy
- input schema
- auth requirements
- user visibility

## Suggestion

Replace static specialist list with worker capability registry.

Worker record:

```ts
type WorkerCapability = {
  slug: string;
  provider: "langdock" | "openrouter" | "sokosumi" | "masumi_mip003" | "messenger" | "local_tool";
  capabilities: string[];
  keywords: string[];
  inputSchema: unknown;
  costModel: unknown;
  latencySloMs: number;
  maxConcurrent: number;
  retryPolicy: RetryPolicy;
  authRequired: boolean;
  availability: "available" | "degraded" | "disabled";
  userVisible: boolean;
};
```

Start with current four Langdock workers in registry.

Keep registry code-backed first. DB-backed config later, after governance exists.

## Why

Orchestrator needs know who can do what, at what cost, with what limits.

Static keyword list cannot support:

- load balancing
- degraded mode
- cost routing
- external coworkers
- Messenger workers
- MIP-003 workers
- local tools

## What Changes

Router becomes planner:

- reads registry
- filters unavailable workers
- scores candidates
- respects `maxConcurrent`
- produces route plan

Specialist names still hidden from user.

Registry can stay code-backed first. DB-backed later.

## First Slice

No dynamic admin UI.

1. move current `SPECIALISTS` data into registry shape
2. keep keyword behavior same
3. add provider + max concurrency + timeout metadata
4. add tests for same routing outputs
5. expose registry only to internal code

## Acceptance Checks

- current four specialists still route same
- broad request can select multiple workers
- disabled worker never selected
- `userVisible=false` workers never leak to public output
- registry values tested against schema

## Risks

- over-engineering if added before durable run ledger
- bad registry values can route badly
- dynamic registry needs config review
- capability names can drift without domain owner

## Review Questions

- Code registry first or DB registry first?
- Should worker registry be editable without deploy?
- Who approves worker capability changes?
- Should capability terms match sustainability domain glossary?
