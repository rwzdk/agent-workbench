import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';

function defaultUrl(): string {
  const toFileUrl = (p: string) => `file:${p.replace(/\\/g, '/')}`;
  try {
    const dir = path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    return toFileUrl(path.join(dir, 'app.db'));
  } catch {
    // 只读文件系统（如部分 Serverless 环境）回退到临时目录
    const tmp = path.join(os.tmpdir(), 'agent-workbench');
    fs.mkdirSync(tmp, { recursive: true });
    return toFileUrl(path.join(tmp, 'app.db'));
  }
}

export const db: Client = createClient({
  url: process.env.LIBSQL_URL ?? defaultUrl(),
  authToken: process.env.LIBSQL_AUTH_TOKEN,
});

let schemaPromise: Promise<unknown> | null = null;

export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = db.batch(
      [
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL DEFAULT '',
          tool_invocations TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id)`,
        `CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, id DESC)`,
      ].map((sql) => ({ sql, args: [] as never[] })),
    );
  }
  return schemaPromise;
}
