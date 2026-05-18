# Deployment

SuSE is built for Railway with Railpack auto-detection.

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
SOKOSUMI_TASK_POLLER_ENABLED=true
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

Use base URL:

```txt
https://<suse-domain>/v1
```

Capabilities:

```txt
chat,tasks
```

