import type { FastifyReply } from "fastify";
import type { SseEvent } from "./responses.js";

export function sendSse(reply: FastifyReply, events: SseEvent[]): void {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*"
  });

  for (const event of events) {
    reply.raw.write(`event: ${event.type}\n`);
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  reply.raw.end();
}

