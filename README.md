# SuSE

SuSE is a Sustainability Expert coworker for Sokosumi. Users discover and chat with SuSE on Sokosumi; SuSE runs as its own Railway service and coordinates specialist sustainability agents behind the scenes.

## Status

Implemented:

- Node 20 TypeScript service.
- Health and readiness endpoints.
- Sokosumi conversations and responses endpoints.
- SSE streaming for `POST /v1/responses` with `stream: true`.
- Memory storage for local/test use.
- Postgres storage with startup migrations for Railway.
- Deterministic specialist routing.
- Langdock specialist adapter.
- OpenRouter synthesis adapter.
- Sokosumi Task Board poller with RUNNING/COMPLETED/FAILED events.

## Product Shape

- Public name: **SuSE**, short for Sustainability Expert.
- Public surface: Sokosumi coworker chat and Task Board.
- Runtime: standalone Railway service backed by Railway Postgres.
- Orchestration: deterministic routing plus OpenRouter synthesis.
- Specialist access: direct Langdock API calls, not nested Sokosumi hires.

## Specialist Coworkers

These specialists are already live through the Langdock Masumi wrapper. SuSE calls their underlying Langdock agents directly for speed.

| Specialist | Focus |
| --- | --- |
| Lexi | Supply-chain analysis and sustainability risk identification |
| Emil-Conrad | Legally compliant sustainability communication under EmpCo and UWG |
| Diddy P. | Digital Product Passport requirements and implementation |
| Food CO2 Analyst | Food product CO2 footprint calculations |

Known wrapper route base for reference:

```txt
https://langdock-masumi-wrapper-production-f58a.up.railway.app
```

Do not call the wrapper's public `/start_job` routes for SuSE v1 specialist work. Those routes are paid Masumi/Sokosumi surfaces. Use Langdock directly.

## Docs

- [CONTEXT.md](./CONTEXT.md) - domain glossary and resolved ambiguity log
- [docs/INDEX.md](./docs/INDEX.md) - full doc map
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - system architecture and modules
- [docs/SOKOSUMI.md](./docs/SOKOSUMI.md) - Sokosumi endpoint contract
- [docs/ORCHESTRATION.md](./docs/ORCHESTRATION.md) - routing and synthesis behavior
- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md) - env vars and secrets
- [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) - build phases
- [docs/REFERENCES.md](./docs/REFERENCES.md) - local reference repos
- [docs/adr/](./docs/adr/) - architecture decisions

## Local Development

```bash
npm install
npm test
npm run dev
```

Default local mode uses in-memory storage and stub specialist/synthesis replies. Set `DATABASE_URL` or `SUSE_STORAGE=postgres` for Postgres. Set `SUSE_SPECIALIST_MODE=langdock` and `SUSE_RUNTIME_MODE=openrouter` after secrets are configured.

## Non-Goals For V1

- No Nori codebase fork.
- No public MIP-003 `/start_job` surface for SuSE.
- No nested Sokosumi hire for each specialist call.
- No Masumi Agent Messenger dependency.
- No full Nori memory/email/Twitter/GitHub/Telegram stack.
