# Sokosumi Contract

## Base URL

Register SuSE in Sokosumi with base URL ending in `/v1`:

```txt
https://<suse-railway-domain>/v1
```

## Chat Flow

1. Sokosumi creates conversation:

```http
POST /v1/conversations
```

2. Sokosumi sends user message:

```http
POST /v1/responses
```

3. If request has `stream: true`, SuSE returns SSE.

4. SuSE persists completed response so reconnect/retrieve can work:

```http
GET /v1/responses/:responseId
```

## Conversation Endpoints

Support minimal OpenAI Conversations-compatible shape:

```http
POST   /v1/conversations
GET    /v1/conversations/:id
POST   /v1/conversations/:id
DELETE /v1/conversations/:id
GET    /v1/conversations/:id/items
GET    /v1/conversations/:id/items/:itemId
DELETE /v1/conversations/:id/items/:itemId
```

Need enough behavior for Sokosumi chat. Avoid full platform clone.

## Task Board Flow

Pheme reference showed Task Board does not rely only on inbound base URL. SuSE must poll coworker events with its coworker key.

Poll:

```http
GET /v1/coworkers/me/events
Authorization: Bearer <SOKOSUMI_COWORKER_API_KEY>
```

For each `READY` task event:

1. Get task:

```http
GET /v1/tasks/:taskId
```

2. Claim:

```http
POST /v1/tasks/:taskId/events
{
  "status": "RUNNING",
  "origin": "SOKOSUMI",
  "comment": "SuSE picked up this task."
}
```

3. Process through SuSE orchestration.

4. Complete:

```http
POST /v1/tasks/:taskId/events
{
  "status": "COMPLETED",
  "origin": "SOKOSUMI",
  "comment": "<final answer>",
  "credits": 0.1
}
```

5. Or fail:

```http
POST /v1/tasks/:taskId/events
{
  "status": "FAILED",
  "origin": "SOKOSUMI",
  "comment": "<short failure reason>"
}
```

## Idempotency

Before processing a task event, check task history. If task already has coworker progress after trigger event, skip it.

Progress statuses:

- `RUNNING`
- `AWAITING_EXTERNAL`
- `INPUT_REQUIRED`
- `AUTHENTICATION_REQUIRED`
- `OUT_OF_CREDITS`
- `COMPLETED`
- `FAILED`
- `CANCEL_REQUESTED`
- `CANCELED`

## Headers

Preserve useful request metadata:

- `X-Sokosumi-User-Id`
- `X-Sokosumi-Organization-Id`
- `X-Organization-Id`
- `X-Coworker-Slug`
- `Authorization` redacted in logs

## Health

```http
GET /health -> 200 OK if process alive
GET /ready  -> 200 if DB reachable and required config present
```
