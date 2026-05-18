import pg from "pg";
import { createId, nowSeconds } from "../utils/ids.js";
import {
  extractTextFromItem,
  normalizeConversationId,
  normalizeItems,
  normalizeMetadata
} from "./normalize.js";
import type {
  ConversationDeletedObject,
  ConversationItem,
  ConversationItemList,
  ConversationObject,
  ConversationStore,
  CreateConversationInput
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
