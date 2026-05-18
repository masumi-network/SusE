# SADR 0005: Observability, Budgets, Recovery

## Status

Suggested. Not approved.

## Context

SuSE has health/readiness checks and structured Fastify logs.

Missing production signals:

- task lag
- poller heartbeat age
- upstream latency
- upstream error rate
- retry count
- fallback count
- token usage
- specialist failure rate
- queue depth
- stale runs

Missing budget controls:

- max specialists per run
- max input size
- per-user/org quotas
- daily/monthly caps
- dynamic task credits

Missing recovery docs:

- stuck `RUNNING`
- failed completion event
- DB restore
- secret rotation
- upstream outage

## Suggestion

Add three linked pieces:

1. internal metrics/log fields
2. budget guardrails
3. `research/RUNBOOK-draft.md` or `docs/RUNBOOK.md` after approval

Start minimal:

- correlation id on every run
- structured event logs
- usage counters
- `/health` includes worker heartbeat
- `/ready` includes stale run count threshold

Use logs first, metrics next.

OpenTelemetry later:

- traces: yes
- metrics: yes
- logs: wait, JS logs still less mature

## Why

Orchestrator spends money and mutates external task state. Operator must see when it fails.

Budgets stop runaway cost from:

- broad prompts
- prompt injection
- bad routing
- upstream retry storms

Recovery docs make failure repair repeatable.

## What Changes

Every run gets:

- cost estimate
- usage actuals
- status
- trace ids
- retry history

Task completion credits become run-based later, not fixed default only.

Operator gains repair workflow:

- find stale run
- inspect last state
- replay safe step
- mark terminal if needed

## First Slice

1. add `correlation_id`
2. log `run_started`, `worker_selected`, `worker_completed`, `worker_failed`, `run_completed`
3. add usage fields where providers return usage
4. add max input length
5. add max selected workers
6. draft runbook in `research/`

## Acceptance Checks

- every task run has one correlation id
- logs can reconstruct run without raw secrets
- OpenRouter usage stored when present
- over-limit request returns safe user message
- stale run repair path documented

## Risks

- metrics can leak private input if careless
- budget false positives can block useful work
- readiness checks can become too strict
- traces can become hidden data retention problem

## Review Questions

- Which metrics need public endpoint vs logs only?
- Credit caps per org or global first?
- Should run traces store raw text or summaries only?
- Should retention differ for chat vs Task Board?

## Research Notes

OpenTelemetry JS docs mark traces and metrics stable. Logs remain development. Start with structured app logs plus later OTEL traces/metrics.

Source: https://opentelemetry.io/docs/languages/js/
