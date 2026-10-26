import { describe, expect, it } from 'vitest';
import { recordTrace } from '../lib/trace';
import type { DbLike, DbStatement } from '../lib/db';

function fakeDb() {
  const statements: DbStatement[] = [];
  return {
    statements,
    db: {
      execute: async (stmt: DbStatement) => {
        statements.push(stmt);
        return { rows: [], lastInsertRowid: 1 };
      },
      batch: async (stmts: DbStatement[]) => {
        statements.push(...stmts);
        return stmts.map(() => ({ rows: [] }));
      },
    } satisfies DbLike,
  };
}

describe('recordTrace', () => {
  it('写入一条追踪记录，duration 取整，meta 序列化为 JSON', async () => {
    const { db, statements } = fakeDb();
    await recordTrace(
      {
        userId: 7,
        conversationId: 3,
        kind: 'chat',
        name: 'gpt-4o-mini',
        durationMs: 1234.6,
        ok: true,
        meta: { promptTokens: 100, completionTokens: 50 },
      },
      db,
    );
    expect(statements).toHaveLength(1);
    const stmt = statements[0];
    expect(stmt.sql).toContain('INSERT INTO traces');
    expect(stmt.args).toEqual([
      7,
      3,
      'chat',
      'gpt-4o-mini',
      1235,
      1,
      '{"promptTokens":100,"completionTokens":50}',
    ]);
  });

  it('conversationId 缺省为 NULL，失败记录 ok=0', async () => {
    const { db, statements } = fakeDb();
    await recordTrace(
      { userId: 1, kind: 'tool', name: 'calculator', durationMs: 5.2, ok: false, meta: { error: '除零' } },
      db,
    );
    expect(statements[0].args?.[1]).toBeNull();
    expect(statements[0].args?.[5]).toBe(0);
    expect(statements[0].args?.[6]).toContain('除零');
  });

  it('追踪写入失败绝不抛出（不影响主流程）', async () => {
    const broken: DbLike = {
      execute: async () => {
        throw new Error('db down');
      },
      batch: async () => {
        throw new Error('db down');
      },
    };
    await expect(
      recordTrace({ userId: 1, kind: 'chat', name: 'x', durationMs: 1, ok: true }, broken),
    ).resolves.toBeUndefined();
  });
});
