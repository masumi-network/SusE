import { createHash } from "node:crypto";
import pg from "pg";
import { createId, nowSeconds } from "../utils/ids.js";
import {
  extractTextFromItem,
  normalizeConversationId,
  normalizeItems,
  normalizeMetadata
} from "./normalize.js";
import type {
  ClaimTaskRunInput,
  ConversationDeletedObject,
  ConversationItem,
  ConversationItemList,
  ConversationObject,
  ConversationStore,
  CreateConversationInput,
  TaskRunClaim,
  TaskRunStatus
} from "./types.js";

const { Pool } = pg;

export async function createPostgresStore(databaseUrl: string): Promise<ConversationStore> {
  const pool = new Pool({ connectionString: databaseUrl });
  await migrate(pool);

  async function getConversation(conversationId: string): Promise<ConversationObject | undefined> {
    const result = await pool.query(
      `
      select id, created_at, metadata
      from suse_conversations
      where id = $1 and deleted_at is null
      `,
      [conversationId]
    );
    return result.rows[0] ? toConversationObject(result.rows[0]) : undefined;
  }

  return {
    async ready() {
      await pool.query("select 1");
    },

    async close() {
      await pool.end();
    },

    async createConversation(input: CreateConversationInput = {}) {
      const client = await pool.connect();
      const conversation: ConversationObject = {
        id: createId("conv"),
        object: "conversation",
        created_at: nowSeconds(),
        metadata: normalizeMetadata(input.metadata)
      };
      const items = normalizeItems(input.items);

      try {
        await client.query("begin");
        await client.query(
          `
          insert into suse_conversations (id, created_at, metadata)
          values ($1, $2, $3)
          `,
          [conversation.id, conversation.created_at, JSON.stringify(conversation.metadata)]
        );

        await insertItems(client, conversation.id, items, 0);
        await client.query("commit");
        return conversation;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async getConversation(conversationId: string) {
      return getConversation(conversationId);
    },

    async updateConversation(conversationId: string, input = {}) {
      const result = await pool.query(
        `
        update suse_conversations
        set metadata = $2
        where id = $1 and deleted_at is null
        returning id, created_at, metadata
        `,
        [conversationId, JSON.stringify(normalizeMetadata(input.metadata))]
      );
      return result.rows[0] ? toConversationObject(result.rows[0]) : undefined;
    },

    async deleteConversation(conversationId: string): Promise<ConversationDeletedObject> {
      const result = await pool.query(
        `
        update suse_conversations
        set deleted_at = now()
        where id = $1 and deleted_at is null
        returning id
        `,
        [conversationId]
      );
      return {
        id: conversationId,
        object: "conversation.deleted",
        deleted: result.rowCount === 1
      };
    },

    async listConversationItems(conversationId: string) {
      const conversation = await getConversation(conversationId);
      if (!conversation) return undefined;

      const result = await pool.query(
        `
        select id, type, status, role, content
        from suse_conversation_items
        where conversation_id = $1 and deleted_at is null
        order by position asc
        `,
        [conversationId]
      );
      return toItemList(result.rows.map(toConversationItem));
    },

    async getConversationItem(conversationId: string, itemId: string) {
      const result = await pool.query(
        `
        select i.id, i.type, i.status, i.role, i.content
        from suse_conversation_items i
        join suse_conversations c on c.id = i.conversation_id
        where i.conversation_id = $1
          and i.id = $2
          and i.deleted_at is null
          and c.deleted_at is null
        `,
        [conversationId, itemId]
      );
      return result.rows[0] ? toConversationItem(result.rows[0]) : undefined;
    },

    async deleteConversationItem(conversationId: string, itemId: string) {
      const conversation = await getConversation(conversationId);
      if (!conversation) return undefined;

      await pool.query(
        `
        update suse_conversation_items
        set deleted_at = now()
        where conversation_id = $1 and id = $2 and deleted_at is null
        `,
        [conversationId, itemId]
      );
      return conversation;
    },

    async appendConversationItems(conversationRef: unknown, items: unknown) {
      const conversationId = normalizeConversationId(conversationRef);
      if (!conversationId) return undefined;

      const conversation = await getConversation(conversationId);
      if (!conversation) return undefined;

      const normalizedItems = normalizeItems(items);
      if (normalizedItems.length === 0) return conversation;

      const client = await pool.connect();
      try {
        await client.query("begin");
        const positionResult = await client.query(
          `
          select coalesce(max(position), -1) as max_position
          from suse_conversation_items
          where conversation_id = $1
          `,
          [conversationId]
        );
        const startPosition = Number(positionResult.rows[0]?.max_position ?? -1) + 1;
        await insertItems(client, conversationId, normalizedItems, startPosition);
        await client.query("commit");
        return conversation;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async getLastUserText(conversationRef: unknown) {
      const conversationId = normalizeConversationId(conversationRef);
      if (!conversationId) return "";

      const result = await pool.query(
        `
        select i.id, i.type, i.status, i.role, i.content
        from suse_conversation_items i
        join suse_conversations c on c.id = i.conversation_id
        where i.conversation_id = $1
          and i.role = 'user'
          and i.deleted_at is null
          and c.deleted_at is null
        order by i.position desc
        limit 1
        `,
        [conversationId]
      );
      return extractTextFromItem(result.rows[0] ? toConversationItem(result.rows[0]) : undefined);
    },

    async saveResponse(response) {
      await pool.query(
        `
        insert into suse_completed_responses (id, created_at, body)
        values ($1, $2, $3)
        on conflict (id) do update
        set created_at = excluded.created_at,
            body = excluded.body
        `,
        [response.id, response.created_at, JSON.stringify(response)]
      );
    },

    async getResponse(responseId: string) {
      const result = await pool.query(
        `
        select body
        from suse_completed_responses
        where id = $1
        `,
        [responseId]
      );
      return result.rows[0]?.body;
    },

    async claimTaskRun(input: ClaimTaskRunInput) {
      const client = await pool.connect();
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + input.leaseMs);

      try {
        await client.query("begin");
        const eventResult = await client.query(
          `
          insert into suse_task_events (event_id, task_id, trigger_status, first_seen_at)
          values ($1, $2, $3, $4)
          on conflict (event_id) do nothing
          returning event_id
          `,
          [input.eventId, input.taskId, input.triggerStatus || null, now]
        );

        if (eventResult.rowCount === 1) {
          const run = {
            runId: createId("run"),
            correlationId: createId("corr"),
            attempt: 1
          };

          await client.query(
            `
            insert into suse_worker_runs (
              run_id,
              task_id,
              event_id,
              correlation_id,
              status,
              attempt,
              claimed_at,
              heartbeat_at,
              input_hash,
              lease_owner,
              lease_expires_at
            )
            values ($1, $2, $3, $4, 'claimed', $5, $6, $6, $7, $8, $9)
            `,
            [
              run.runId,
              input.taskId,
              input.eventId,
              run.correlationId,
              run.attempt,
              now,
              hashValue(`${input.taskId}:${input.eventId}`),
              input.leaseOwner,
              leaseExpiresAt
            ]
          );
          await client.query(
            `
            update suse_task_events
            set claimed_at = $2,
                run_id = $3
            where event_id = $1
            `,
            [input.eventId, now, run.runId]
          );
          await client.query("commit");
          return {
            claimed: true,
            runId: run.runId,
            correlationId: run.correlationId,
            status: "claimed",
            attempt: run.attempt
          } satisfies TaskRunClaim;
        }

        const existingResult = await client.query(
          `
          select run_id, correlation_id, status, attempt, lease_expires_at
          from suse_worker_runs
          where event_id = $1
          order by claimed_at desc
          limit 1
          `,
          [input.eventId]
        );
        const existing = existingResult.rows[0];
        if (!existing) {
          await client.query("commit");
          return {
            claimed: false,
            reason: "missing_run"
          } satisfies TaskRunClaim;
        }

        const status = String(existing.status) as TaskRunStatus;
        const leaseActive = existing.lease_expires_at && new Date(existing.lease_expires_at).getTime() > now.getTime();
        if ((status === "claimed" || status === "running") && !leaseActive) {
          const retryResult = await client.query(
            `
            update suse_worker_runs
            set status = 'claimed',
                attempt = attempt + 1,
                claimed_at = $2,
                heartbeat_at = $2,
                lease_owner = $3,
                lease_expires_at = $4,
                last_error = null
            where run_id = $1
            returning run_id, correlation_id, status, attempt
            `,
            [existing.run_id, now, input.leaseOwner, leaseExpiresAt]
          );
          await client.query("commit");
          return toTaskRunClaim(retryResult.rows[0], true);
        }

        await client.query("commit");
        return {
          ...toTaskRunClaim(existing, false),
          reason: status === "completed" || status === "failed" || status === "skipped" ? "already_processed" : "lease_active"
        } satisfies TaskRunClaim;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async markTaskRunRunning({ runId, claimEventId }) {
      await pool.query(
        `
        update suse_worker_runs
        set status = 'running',
            heartbeat_at = now(),
            claim_event_id = coalesce($2, claim_event_id)
        where run_id = $1
        `,
        [runId, claimEventId || null]
      );
    },

    async markTaskRunCompleted({ runId, completionEventId, finalAnswer }) {
      await pool.query(
        `
        update suse_worker_runs
        set status = 'completed',
            completed_at = now(),
            heartbeat_at = now(),
            completion_event_id = coalesce($2, completion_event_id),
            final_answer_hash = $3,
            output_hash = $3
        where run_id = $1
        `,
        [runId, completionEventId || null, hashValue(finalAnswer)]
      );
    },

    async markTaskRunFailed({ runId, error }) {
      await pool.query(
        `
        update suse_worker_runs
        set status = 'failed',
            completed_at = now(),
            heartbeat_at = now(),
            last_error = $2
        where run_id = $1
        `,
        [runId, errorMessage(error)]
      );
    },

    async markTaskRunSkipped({ eventId, reason }) {
      await pool.query(
        `
        update suse_worker_runs
        set status = 'skipped',
            completed_at = now(),
            heartbeat_at = now(),
            last_error = $2
        where event_id = $1
          and status in ('claimed', 'running')
        `,
        [eventId, reason]
      );
    }
  };
}

async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists suse_conversations (
      id text primary key,
      created_at integer not null,
      metadata jsonb not null default '{}'::jsonb,
      deleted_at timestamptz
    );

    create table if not exists suse_conversation_items (
      id text primary key,
      conversation_id text not null references suse_conversations(id) on delete cascade,
      position integer not null,
      type text not null,
      status text not null,
      role text not null,
      content jsonb not null default '[]'::jsonb,
      created_at integer not null,
      deleted_at timestamptz
    );

    create index if not exists suse_conversation_items_conversation_position_idx
      on suse_conversation_items (conversation_id, position);

    create table if not exists suse_completed_responses (
      id text primary key,
      created_at integer not null,
      body jsonb not null
    );

    create table if not exists suse_task_events (
      event_id text primary key,
      task_id text not null,
      trigger_status text,
      first_seen_at timestamptz not null default now(),
      claimed_at timestamptz,
      run_id text
    );

    create table if not exists suse_worker_runs (
      run_id text primary key,
      task_id text not null,
      event_id text not null unique references suse_task_events(event_id) on delete cascade,
      correlation_id text not null,
      status text not null,
      attempt integer not null default 1,
      claimed_at timestamptz not null default now(),
      heartbeat_at timestamptz not null default now(),
      completed_at timestamptz,
      claim_event_id text,
      completion_event_id text,
      last_error text,
      final_answer_hash text,
      input_hash text,
      output_hash text,
      lease_owner text,
      lease_expires_at timestamptz
    );

    create index if not exists suse_worker_runs_status_lease_idx
      on suse_worker_runs (status, lease_expires_at);

    create index if not exists suse_worker_runs_task_idx
      on suse_worker_runs (task_id, claimed_at desc);
  `);
}

async function insertItems(
  client: pg.PoolClient,
  conversationId: string,
  items: ConversationItem[],
  startPosition: number
): Promise<void> {
  for (const [offset, item] of items.entries()) {
    await client.query(
      `
      insert into suse_conversation_items
        (id, conversation_id, position, type, status, role, content, created_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (id) do nothing
      `,
      [
        item.id,
        conversationId,
        startPosition + offset,
        item.type,
        item.status,
        item.role,
        JSON.stringify(item.content),
        nowSeconds()
      ]
    );
  }
}

function toConversationObject(row: Record<string, unknown>): ConversationObject {
  return {
    id: String(row.id),
    object: "conversation",
    created_at: Number(row.created_at),
    metadata: normalizeMetadata(row.metadata)
  };
}

function toConversationItem(row: Record<string, unknown>): ConversationItem {
  return {
    id: String(row.id),
    type: String(row.type),
    status: String(row.status),
    role: normalizeRole(row.role),
    content: Array.isArray(row.content) ? row.content : []
  };
}

function toItemList(data: ConversationItem[]): ConversationItemList {
  return {
    object: "list",
    data,
    first_id: data[0]?.id || null,
    last_id: data[data.length - 1]?.id || null,
    has_more: false
  };
}

function normalizeRole(value: unknown): ConversationItem["role"] {
  if (value === "assistant" || value === "system") return value;
  return "user";
}

function toTaskRunClaim(row: Record<string, unknown>, claimed: boolean): TaskRunClaim {
  return {
    claimed,
    runId: String(row.run_id),
    correlationId: String(row.correlation_id),
    status: String(row.status) as TaskRunStatus,
    attempt: Number(row.attempt)
  };
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Task processing failed.";
}
