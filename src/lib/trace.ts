import { ensureSchema, getDb, type DbLike } from './db';

export type TraceEntry = {
  userId: number;
  conversationId?: number | null;
  kind: 'chat' | 'tool';
  name: string;
  durationMs: number;
  ok: boolean;
  meta?: Record<string, unknown>;
};

/**
 * 可观测 v1：把每次 LLM 调用与工具调用写入 traces 表（轻量自建追踪，
 * 不引入第三方 SDK——在 Cloudflare Workers 上这是成本最低且可控的方案）。
 * 追踪失败绝不影响主流程：内部吞掉错误。
 */
export async function recordTrace(entry: TraceEntry, db?: DbLike): Promise<void> {
  try {
    await ensureSchema();
    const store = db ?? (await getDb());
    await store.execute({
      sql: 'INSERT INTO traces (user_id, conversation_id, kind, name, duration_ms, ok, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        entry.userId,
        entry.conversationId ?? null,
        entry.kind,
        entry.name,
        Math.round(entry.durationMs),
        entry.ok ? 1 : 0,
        entry.meta ? JSON.stringify(entry.meta) : null,
      ],
    });
  } catch (e) {
    console.warn('recordTrace failed:', e instanceof Error ? e.message : e);
  }
}
