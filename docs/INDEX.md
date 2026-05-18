# SuSE Docs Index

## Read First

1. [../CONTEXT.md](../CONTEXT.md) - shared language.
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - target system.
3. [SOKOSUMI.md](./SOKOSUMI.md) - public Sokosumi contract.
4. [ORCHESTRATION.md](./ORCHESTRATION.md) - SuSE thinking layer.

## Build Docs

- [ENVIRONMENT.md](./ENVIRONMENT.md) - required config.
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - phased build.
- [REFERENCES.md](./REFERENCES.md) - local source references.

## Decisions

- [adr/0001-standalone-coworker-service.md](./adr/0001-standalone-coworker-service.md)
- [adr/0002-direct-langdock-specialist-calls.md](./adr/0002-direct-langdock-specialist-calls.md)
- [adr/0003-vendored-sokosumi-layer.md](./adr/0003-vendored-sokosumi-layer.md)
- [adr/0004-openrouter-synthesis-layer.md](./adr/0004-openrouter-synthesis-layer.md)

## Planned Module Map

| Module | Interface | Notes |
| --- | --- | --- |
| HTTP coworker surface | `/v1/responses`, `/v1/conversations`, health | Sokosumi chat |
| Task Board worker | poll, claim, complete/fail | Based on `pi-sokosumi` |
| Conversation store | response, conversation, task state | Railway Postgres |
| Specialist router | user request -> selected specialists | Deterministic |
| Langdock adapter | specialist slug -> Langdock completion | Direct API |
| Synthesis adapter | findings -> final SuSE answer | OpenRouter |
| Observability | structured logs | No secrets |
