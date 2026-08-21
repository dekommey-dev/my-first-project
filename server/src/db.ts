import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { env } from './env.js'

export type Role = 'user' | 'assistant'

export interface Conversation {
  id: string
  title: string
  model: string
  systemPrompt: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  conversationId: string
  role: Role
  content: string
  model: string | null
  createdAt: number
}

fs.mkdirSync(env.dataDir, { recursive: true })

const db = new Database(path.join(env.dataDir, 'aida.sqlite'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    model         TEXT NOT NULL,
    system_prompt TEXT NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    model           TEXT,
    created_at      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages (conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_conversations_updated
    ON conversations (updated_at DESC);
`)

interface ConversationRow {
  id: string
  title: string
  model: string
  system_prompt: string
  created_at: number
  updated_at: number
}

interface MessageRow {
  id: string
  conversation_id: string
  role: Role
  content: string
  model: string | null
  created_at: number
}

const toConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  title: row.title,
  model: row.model,
  systemPrompt: row.system_prompt,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  model: row.model,
  createdAt: row.created_at,
})

const statements = {
  insertConversation: db.prepare(
    `INSERT INTO conversations (id, title, model, system_prompt, created_at, updated_at)
     VALUES (@id, @title, @model, @system_prompt, @created_at, @updated_at)`,
  ),
  listConversations: db.prepare(
    `SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?`,
  ),
  getConversation: db.prepare(`SELECT * FROM conversations WHERE id = ?`),
  deleteConversation: db.prepare(`DELETE FROM conversations WHERE id = ?`),
  touchConversation: db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`),
  insertMessage: db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, model, created_at)
     VALUES (@id, @conversation_id, @role, @content, @model, @created_at)`,
  ),
  listMessages: db.prepare(
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid`,
  ),
  deleteMessagesFrom: db.prepare(
    `DELETE FROM messages
      WHERE conversation_id = ?
        AND rowid >= (SELECT rowid FROM messages WHERE id = ?)`,
  ),
  countMessages: db.prepare(
    `SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?`,
  ),
}

export const store = {
  createConversation(input: { title?: string; model: string; systemPrompt?: string }): Conversation {
    const now = Date.now()
    const row: ConversationRow = {
      id: randomUUID(),
      title: input.title?.trim() || 'New chat',
      model: input.model,
      system_prompt: input.systemPrompt ?? '',
      created_at: now,
      updated_at: now,
    }
    statements.insertConversation.run(row)
    return toConversation(row)
  },

  listConversations(limit = 200): Conversation[] {
    return (statements.listConversations.all(limit) as ConversationRow[]).map(toConversation)
  },

  getConversation(id: string): Conversation | null {
    const row = statements.getConversation.get(id) as ConversationRow | undefined
    return row ? toConversation(row) : null
  },

  updateConversation(id: string, patch: Partial<Pick<Conversation, 'title' | 'model' | 'systemPrompt'>>): Conversation | null {
    const current = this.getConversation(id)
    if (!current) return null

    const fields: string[] = []
    const values: unknown[] = []
    if (patch.title !== undefined) {
      fields.push('title = ?')
      values.push(patch.title.trim() || 'New chat')
    }
    if (patch.model !== undefined) {
      fields.push('model = ?')
      values.push(patch.model)
    }
    if (patch.systemPrompt !== undefined) {
      fields.push('system_prompt = ?')
      values.push(patch.systemPrompt)
    }
    if (fields.length === 0) return current

    fields.push('updated_at = ?')
    values.push(Date.now(), id)
    db.prepare(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getConversation(id)
  },

  deleteConversation(id: string): boolean {
    return statements.deleteConversation.run(id).changes > 0
  },

  listMessages(conversationId: string): Message[] {
    return (statements.listMessages.all(conversationId) as MessageRow[]).map(toMessage)
  },

  countMessages(conversationId: string): number {
    return (statements.countMessages.get(conversationId) as { n: number }).n
  },

  addMessage(input: { conversationId: string; role: Role; content: string; model?: string | null }): Message {
    const row: MessageRow = {
      id: randomUUID(),
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      created_at: Date.now(),
    }
    statements.insertMessage.run(row)
    statements.touchConversation.run(row.created_at, input.conversationId)
    return toMessage(row)
  },

  /** Deletes `messageId` and every message stored after it. Used by "retry". */
  deleteMessagesFrom(conversationId: string, messageId: string): number {
    return statements.deleteMessagesFrom.run(conversationId, messageId).changes
  },
}

export default db
