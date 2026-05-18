# Environment

No secrets in git. Set these in Railway.

## Core

| Var | Required | Purpose |
| --- | --- | --- |
| `PORT` | yes | HTTP port, Railway provides |
| `PUBLIC_BASE_URL` | yes | SuSE public Railway URL |
| `DATABASE_URL` | yes | Railway Postgres |
| `NODE_ENV` | yes | `production` on Railway |

## Sokosumi

| Var | Required | Purpose |
| --- | --- | --- |
| `SOKOSUMI_API_URL` | yes | `https://api.preprod.sokosumi.com` or prod URL |
| `SOKOSUMI_COWORKER_API_KEY` | yes for tasks | Coworker API key for polling/events |
| `SOKOSUMI_TASK_POLLER_ENABLED` | yes | `true` to process Task Board |
| `SOKOSUMI_TASK_POLL_INTERVAL_MS` | no | default `15000` |
| `SOKOSUMI_TASK_POLL_LIMIT` | no | default `20` |
| `SOKOSUMI_TASK_POLL_MAX_PAGES` | no | default `10` |

## Langdock

| Var | Required | Purpose |
| --- | --- | --- |
| `LANGDOCK_API_KEY` | yes | server-side Langdock API key |
| `LANGDOCK_BASE_URL` | no | default `https://api.langdock.com` |
| `LANGDOCK_LEXI_AGENT_ID` | yes | Lexi agent id |
| `LANGDOCK_EMIL_CONRAD_AGENT_ID` | yes | Emil-Conrad agent id |
| `LANGDOCK_DIDDY_P_AGENT_ID` | yes | Diddy P. agent id |
| `LANGDOCK_FOOD_CO2_ANALYST_AGENT_ID` | yes | Food CO2 Analyst agent id |
| `LANGDOCK_TIMEOUT_MS` | no | default `45000` |

## OpenRouter

| Var | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | synthesis LLM key |
| `OPENROUTER_BASE_URL` | no | default `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | yes later | chosen model |
| `OPENROUTER_TEMPERATURE` | no | recommended `0.2` to `0.4` |
| `OPENROUTER_MAX_COMPLETION_TOKENS` | no | default per model |
| `OPENROUTER_TIMEOUT_MS` | no | default `60000` |
| `OPENROUTER_SITE_URL` | no | public URL for OpenRouter headers |
| `OPENROUTER_APP_NAME` | no | `SuSE` |

## Logging

| Var | Required | Purpose |
| --- | --- | --- |
| `LOG_LEVEL` | no | `info` default |
| `LOG_REQUEST_BODIES` | no | default `false`; only enable in controlled tests |

## Redaction

Always redact:

- `Authorization`
- `SOKOSUMI_COWORKER_API_KEY`
- `LANGDOCK_API_KEY`
- `OPENROUTER_API_KEY`
- specialist agent ids when logging config
