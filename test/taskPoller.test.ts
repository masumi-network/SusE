import test from "node:test";
import assert from "node:assert/strict";
import { createSokosumiTaskPoller, hasTaskProgress } from "../src/sokosumi/taskPoller.js";
import type { SokosumiClient, SokosumiTaskEventInput } from "../src/sokosumi/types.js";

const silentLogger = {
  log() {},
  error() {}
};

test("task poller claims and completes ready task", async () => {
  const createdEvents: Array<{ taskId: string; body: SokosumiTaskEventInput }> = [];
  const client: SokosumiClient = {
    async listCoworkerEvents() {
      return {
        events: [{ id: "evt_1", taskId: "task_1", status: "READY" }]
      };
    },
    async getTask() {
      return {
        id: "task_1",
        name: "Assess supplier sustainability risk",
        events: [{ id: "evt_1", taskId: "task_1", status: "READY" }]
      };
    },
    async createTaskEvent(taskId, body) {
      createdEvents.push({ taskId, body });
      return {};
    }
  };

  const poller = createSokosumiTaskPoller({
    client,
    intervalMs: 1000,
    limit: 20,
    maxPages: 1,
    logger: silentLogger,
    async processTask() {
      return "Done";
    },
    createCompletedEvent({ result }) {
      return {
        status: "COMPLETED",
        origin: "SOKOSUMI",
        comment: result,
        credits: 0.1
      };
    }
  });

  await poller.tick();

  assert.deepEqual(
    createdEvents.map((event) => event.body.status),
    ["RUNNING", "COMPLETED"]
  );
  assert.equal(createdEvents[1]?.body.comment, "Done");
});

test("task poller skips task with coworker progress after trigger event", async () => {
  let processed = false;
  const createdEvents: Array<{ taskId: string; body: SokosumiTaskEventInput }> = [];
  const client: SokosumiClient = {
    async listCoworkerEvents() {
      return {
        events: [{ id: "evt_1", taskId: "task_1", status: "READY" }]
      };
    },
    async getTask() {
      return {
        id: "task_1",
        events: [
          { id: "evt_1", taskId: "task_1", status: "READY" },
          { id: "evt_2", taskId: "task_1", status: "RUNNING", coworkerId: "coworker_1" }
        ]
      };
    },
    async createTaskEvent(taskId, body) {
      createdEvents.push({ taskId, body });
      return {};
    }
  };

  const poller = createSokosumiTaskPoller({
    client,
    intervalMs: 1000,
    limit: 20,
    maxPages: 1,
    logger: silentLogger,
    async processTask() {
      processed = true;
      return "Done";
    },
    createCompletedEvent({ result }) {
      return {
        status: "COMPLETED",
        origin: "SOKOSUMI",
        comment: result
      };
    }
  });

  await poller.tick();

  assert.equal(processed, false);
  assert.equal(createdEvents.length, 0);
});

test("hasTaskProgress detects progress after trigger", () => {
  assert.equal(
    hasTaskProgress(
      {
        events: [
          { id: "trigger", status: "READY" },
          { id: "progress", status: "COMPLETED", coworkerId: "coworker_1" }
        ]
      },
      { id: "trigger", status: "READY" }
    ),
    true
  );
});

