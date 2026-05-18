import test from "node:test";
import assert from "node:assert/strict";
import { createSokosumiTaskPoller, hasTaskProgress } from "../src/sokosumi/taskPoller.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import type { SokosumiTaskClient, SokosumiTaskEventInput } from "../src/sokosumi/types.js";

const silentLogger = {
  log() {},
  error() {}
};

test("task poller claims and completes ready task", async () => {
  const createdEvents: Array<{ taskId: string; body: SokosumiTaskEventInput }> = [];
  const client: SokosumiTaskClient = {
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
  const client: SokosumiTaskClient = {
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

test("task poller ledger skips duplicate event across poller instances", async () => {
  const store = createMemoryStore();
  let processCount = 0;
  const createdEvents: Array<{ taskId: string; body: SokosumiTaskEventInput }> = [];
  const client: SokosumiTaskClient = {
    async listCoworkerEvents() {
      return {
        events: [{ id: "evt_ledger", taskId: "task_ledger", status: "READY" }]
      };
    },
    async getTask() {
      return {
        id: "task_ledger",
        events: [{ id: "evt_ledger", taskId: "task_ledger", status: "READY" }]
      };
    },
    async createTaskEvent(taskId, body) {
      createdEvents.push({ taskId, body });
      return { data: { id: `created_${createdEvents.length}` } };
    }
  };

  const createPoller = () =>
    createSokosumiTaskPoller({
      client,
      intervalMs: 1000,
      limit: 20,
      maxPages: 1,
      logger: silentLogger,
      taskRunStore: store,
      async processTask() {
        processCount += 1;
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

  await createPoller().tick();
  await createPoller().tick();

  assert.equal(processCount, 1);
  assert.deepEqual(
    createdEvents.map((event) => event.body.status),
    ["RUNNING", "COMPLETED"]
  );

  await store.close();
});

test("task poller ledger reclaims stale running event", async () => {
  const store = createMemoryStore();
  const claim = await store.claimTaskRun({
    eventId: "evt_stale",
    taskId: "task_stale",
    triggerStatus: "READY",
    leaseOwner: "test-owner",
    leaseMs: 1
  });
  assert.ok(claim.runId);
  await store.markTaskRunRunning({ runId: claim.runId });
  await new Promise((resolve) => setTimeout(resolve, 5));

  let processCount = 0;
  const createdEvents: Array<{ taskId: string; body: SokosumiTaskEventInput }> = [];
  const client: SokosumiTaskClient = {
    async listCoworkerEvents() {
      return {
        events: [{ id: "evt_stale", taskId: "task_stale", status: "READY" }]
      };
    },
    async getTask() {
      return {
        id: "task_stale",
        events: [{ id: "evt_stale", taskId: "task_stale", status: "READY" }]
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
    taskRunStore: store,
    leaseMs: 1,
    async processTask() {
      processCount += 1;
      return "Recovered";
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

  assert.equal(processCount, 1);
  assert.equal(createdEvents[1]?.body.comment, "Recovered");

  await store.close();
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
