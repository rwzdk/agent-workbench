import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type DbRow = Record<string, unknown>;
export type DbStatement = { sql: string; args?: unknown[] };
export interface DbResult {
  rows: DbRow[];
  lastInsertRowid?: number | bigint | string;
}
export interface DbLike {
  execute(stmt: DbStatement): Promise<DbResult>;
  batch(stmts: DbStatement[]): Promise<DbResult[]>;
}

interface D1PreparedStatementLike {
  all(): Promise<{ results?: unknown[]; meta?: { last_row_id?: number | bigint | string } }>;
}
interface D1Like {
  prepare(sql: string): { bind(...args: unknown[]): D1PreparedStatementLike };
}

/**
 * 数据库访问统一入口：
 * - Cloudflare（OpenNext）部署时使用绑定的 D1 数据库
 * - 本地开发 / Node 部署时使用 libSQL（本地文件或远程 Turso）
 * 两边实现同一极简接口（execute / batch），业务代码零感知。
 */
export async function getDb(): Promise<DbLike> {
  if (cached) return cached;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext();
    const d1 = (env as { DB?: D1Like }).DB;
    if (d1) {
      cached = createD1Adapter(d1);
      return cached;
    }
  } catch {
    // 非 Cloudflare 环境，走本地 libSQL
  }
  cached = await createLocalClient();
  return cached;
}

let cached: DbLike | null = null;

function createD1Adapter(d1: D1Like): DbLike {
  const run = async (stmt: DbStatement): Promise<DbResult> => {
    const { results, meta } = await d1.prepare(stmt.sql).bind(...(stmt.args ?? [])).all();
    return { rows: (results ?? []) as DbRow[], lastInsertRowid: meta?.last_row_id };
  };
  return {
    execute: run,
    batch: async (stmts) => {
      const out: DbResult[] = [];
      for (const stmt of stmts) out.push(await run(stmt));
      return out;
    },
  };
}

function localFileUrl(): string {
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

async function createLocalClient(): Promise<DbLike> {
  // 用 createRequire 在运行时加载，避免打包器（OpenNext/esbuild）尝试把
  // 含原生二进制的 libSQL 客户端打进 worker bundle——Cloudflare 上永远走不到这个分支
  const { createRequire } = await import('node:module');
  const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));
  const { createClient } = nodeRequire('@libsql/client') as typeof import('@libsql/client');
  const client = createClient({
    url: process.env.LIBSQL_URL ?? localFileUrl(),
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  });
  return {
    execute: async (stmt) => (await client.execute(stmt as never)) as unknown as DbResult,
    batch: async (stmts) => (await client.batch(stmts as never)) as unknown as DbResult[],
  };
}

const DDL: string[] = [
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
];

let schemaPromise: Promise<unknown> | null = null;

export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = getDb().then((db) => db.batch(DDL.map((sql) => ({ sql, args: [] }))));
  }
  return schemaPromise;
}
