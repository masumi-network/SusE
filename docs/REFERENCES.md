# References

Local references used during planning.

## Nori DevRel Agent

Path:

```txt
/Users/sarthiborkar/masumi/coworkers/nori-devrel-agent
```

Use for:

- Sokosumi coworker endpoint behavior.
- Responses API shape.
- Task Board callback behavior.
- Conversation persistence ideas.

Do not copy:

- full codebase
- memory stack
- email/Twitter/GitHub/Telegram interfaces
- A2A/Masumi Messenger runtime

## Langdock Masumi Wrapper

Path:

```txt
/Users/sarthiborkar/masumi/langdock-masumi-wrapper
```

Use for:

- Langdock chat completions request/response parsing.
- Specialist names, slugs, descriptions.
- Wrapper route reference.

Do not call for internal SuSE v1 specialist work:

- `/agents/:slug/start_job`
- `/agents/:slug/status`

Reason: those are public Masumi/Sokosumi paid job routes.

## Pheme

Path:

```txt
/Users/sarthiborkar/masumi/coworkers/pheme
```

Use for:

- Minimal Sokosumi `/v1/conversations` and `/v1/responses` behavior.
- SSE streaming event shape.
- `pi-sokosumi` client and task poller source.
- OpenRouter client shape.

Important lesson:

- Sokosumi sent `stream: true`; JSON-only response did not display smoothly. SuSE v1 needs SSE.

## pi-sokosumi

Path:

```txt
/Users/sarthiborkar/masumi/coworkers/pheme/packages/pi-sokosumi
```

Use for:

- coworker-authenticated Sokosumi HTTP client
- task event poller
- task progress/idempotency logic
- Pi extension reference

Production choice:

- vendor/adapt needed pieces into SuSE.
- avoid sibling repo runtime dependency.
