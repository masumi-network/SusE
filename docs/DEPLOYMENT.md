# Deployment

SuSE is built for Railway with Railpack auto-detection.

## Current Production

```txt
Project: SuSE Agent
Environment: production
App service: SusE
Database service: Postgres
Public URL: https://suse-production.up.railway.app
Sokosumi base URL: https://suse-production.up.railway.app/v1
Sokosumi preprod coworker id: 019e3a55-c2bb-75cc-b239-2bcf5a0f9021
Sokosumi preprod slug: suse
```

Current production status:

- App deploy succeeds.
- Railway Postgres is attached through `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
- `SUSE_STORAGE=postgres`.
- Public smoke test passes.
- `GET /health` reports `storageMode: "postgres"`.
- Sokosumi preprod registration is whitelisted with `chat` and `tasks` capabilities.
- `SOKOSUMI_COWORKER_API_KEY` is set on Railway and verified against `/v1/coworkers/me`.
- `SOKOSUMI_USAGE_CHARGING_ENABLED=true` charges successful Sokosumi chat/Responses calls through `/v1/coworkers/me/usage`.
- `SOKOSUMI_TASK_POLLER_ENABLED=true`; recent Railway logs show the poller starts.
- Current deployed runtime mode is `openrouter`.
- Current deployed specialist mode is `langdock`.

## Build

Railway should use the package scripts:

```bash
npm install
npm run build
npm start
```

No Dockerfile is required for v1.

## Required Services

- App service for SuSE.
- Railway Postgres attached to the app service.

## Required Variables

Minimum production variables:

```txt
NODE_ENV=production
SUSE_PUBLIC_BASE_URL=https://<suse-domain>
SUSE_RUNTIME_MODE=openrouter
SUSE_SPECIALIST_MODE=langdock
SUSE_STORAGE=postgres
DATABASE_URL=<railway-postgres-url>
OPENROUTER_API_KEY=<secret>
OPENROUTER_MODEL=<chosen-model>
LANGDOCK_API_KEY=<secret>
LANGDOCK_AGENT_ID_LEXI=<secret>
LANGDOCK_AGENT_ID_EMIL_CONRAD=<secret>
LANGDOCK_AGENT_ID_DIDDY_P=<secret>
LANGDOCK_AGENT_ID_FOOD_CO2_ANALYST=<secret>
SOKOSUMI_API_URL=<preprod-or-prod-url>
SOKOSUMI_COWORKER_API_KEY=<secret>
SOKOSUMI_USAGE_CHARGING_ENABLED=true
SOKOSUMI_CONVERSATION_CREDITS=0.1
SOKOSUMI_TASK_POLLER_ENABLED=true
SOKOSUMI_TASK_COMPLETION_CREDITS=0.1
```

See [ENVIRONMENT.md](./ENVIRONMENT.md) for optional retry, timeout, and polling knobs.

## Railway Deploy

From a linked Railway project/service:

```bash
railway up --detach -m "Deploy SuSE coworker"
```

If this repo is not linked, pass explicit project and environment flags.

## Smoke Test

After deploy, run:

```bash
SMOKE_BASE_URL=https://<suse-domain> npm run smoke
```

The smoke test checks:

- `GET /health`
- `GET /ready`
- `POST /v1/conversations`
- `POST /v1/responses`
- `GET /v1/responses/:id`
- SSE response streaming

## Sokosumi Registration

Current preprod registration:

```txt
id: 019e3a55-c2bb-75cc-b239-2bcf5a0f9021
slug: suse
name: SuSE
baseURL: https://suse-production.up.railway.app/v1
isWhitelisted: true
```

Capabilities:

```txt
chat,tasks
```
