# Environment

No secrets in git. Set these in Railway.

## Core

| Var | Required | Purpose |
| --- | --- | --- |
| `PORT` | yes | HTTP port, Railway provides |
| `SUSE_PUBLIC_BASE_URL` | yes | SuSE public Railway URL |
| `SUSE_AGENT_NAME` | no | default `SuSE` |
| `SUSE_RUNTIME_MODE` | yes | `stub` or `openrouter` |
| `SUSE_SPECIALIST_MODE` | yes | `stub` or `langdock` |
| `SUSE_STORAGE` | yes | `memory` or `postgres`; defaults to `postgres` when `DATABASE_URL` is set |
| `SUSE_MAX_INPUT_CHARS` | no | default `12000`; over-limit requests get a safe shortening prompt |
| `SUSE_MAX_SPECIALISTS_PER_RUN` | no | default `4`; caps background worker fanout |
| `DATABASE_URL` | yes for Postgres | Railway Postgres |
| `NODE_ENV` | yes | `production` on Railway |

## Sokosumi

| Var | Required | Purpose |
| --- | --- | --- |
| `SOKOSUMI_API_URL` | yes | `https://api.preprod.sokosumi.com` or prod URL |
| `SOKOSUMI_COWORKER_API_KEY` | yes for tasks/usage charging | Coworker API key for polling, events, delegated credit checks, and usage charging |
| `SOKOSUMI_USAGE_CHARGING_ENABLED` | yes for paid chat | `true` to charge Sokosumi credits for successful chat/Responses calls |
| `SOKOSUMI_CONVERSATION_CREDITS` | no | default `0.1`; credits charged per successful chat/Responses call |
| `SOKOSUMI_TASK_POLLER_ENABLED` | yes | `true` to process Task Board |
| `SOKOSUMI_TASK_POLL_INTERVAL_MS` | no | default `15000` |
| `SOKOSUMI_TASK_POLL_LIMIT` | no | default `20` |
| `SOKOSUMI_TASK_POLL_MAX_PAGES` | no | default `10` |
| `SOKOSUMI_TASK_COMPLETION_CREDITS` | no | default `0.1`; positive credits are attached to `COMPLETED` task events |

## Langdock

| Var | Required | Purpose |
| --- | --- | --- |
| `LANGDOCK_API_KEY` | yes | server-side Langdock API key |
| `LANGDOCK_BASE_URL` | no | default `https://api.langdock.com` |
| `LANGDOCK_AGENT_ID_LEXI` | yes | Lexi agent id |
| `LANGDOCK_AGENT_ID_EMIL_CONRAD` | yes | Emil-Conrad agent id |
| `LANGDOCK_AGENT_ID_DIDDY_P` | yes | Diddy P. agent id |
| `LANGDOCK_AGENT_ID_FOOD_CO2_ANALYST` | yes | Food CO2 Analyst agent id |
| `LANGDOCK_TIMEOUT_MS` | no | default `45000` |
| `LANGDOCK_MAX_ATTEMPTS` | no | default `2`; retries transient 408/409/425/429/5xx |
| `LANGDOCK_RETRY_DELAY_MS` | no | default `300`; linear backoff base |

## OpenRouter

| Var | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | synthesis LLM key |
| `OPENROUTER_BASE_URL` | no | default `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | yes later | chosen model |
| `OPENROUTER_TEMPERATURE` | no | recommended `0.2` to `0.4` |
| `OPENROUTER_MAX_COMPLETION_TOKENS` | no | default `1200` |
| `OPENROUTER_TIMEOUT_MS` | no | default `30000` |
| `OPENROUTER_MAX_ATTEMPTS` | no | default `2`; retries transient 408/409/425/429/5xx |
| `OPENROUTER_RETRY_DELAY_MS` | no | default `300`; linear backoff base |
| `OPENROUTER_SITE_URL` | no | public URL for OpenRouter headers |
| `OPENROUTER_APP_NAME` | no | `SuSE` |

## Logging

| Var | Required | Purpose |
| --- | --- | --- |
| `SUSE_LOG_LEVEL` | no | `info` default |

## Redaction

Always redact:

- `Authorization`
- `SOKOSUMI_COWORKER_API_KEY`
- `LANGDOCK_API_KEY`
- `OPENROUTER_API_KEY`
- specialist agent ids when logging config
