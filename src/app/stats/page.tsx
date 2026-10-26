import { redirect } from 'next/navigation';
import { ensureSchema, getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type ToolRow = { name: string; calls: number; avgMs: number };
type RecentRow = { id: number; kind: string; name: string; durationMs: number; ok: number; createdAt: string };

export default async function StatsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  await ensureSchema();
  const db = await getDb();

  const counts = await db.execute({
    sql: "SELECT kind, COUNT(*) AS n FROM traces WHERE user_id = ? GROUP BY kind",
    args: [user.id],
  });
  const chatCount = Number(counts.rows.find((r) => r.kind === 'chat')?.n ?? 0);
  const toolCount = Number(counts.rows.find((r) => r.kind === 'tool')?.n ?? 0);

  const chatAvg = await db.execute({
    sql: "SELECT AVG(duration_ms) AS avgMs, SUM(CAST(json_extract(meta, '$.completionTokens') AS INTEGER)) AS tokens FROM traces WHERE user_id = ? AND kind = 'chat' AND meta IS NOT NULL",
    args: [user.id],
  });
  const avgChatMs = Number(chatAvg.rows[0]?.avgMs ?? 0);
  const totalTokens = Number(chatAvg.rows[0]?.tokens ?? 0);

  const tools = await db.execute({
    sql: "SELECT name, COUNT(*) AS calls, AVG(duration_ms) AS avgMs FROM traces WHERE user_id = ? AND kind = 'tool' GROUP BY name ORDER BY calls DESC",
    args: [user.id],
  });

  const recent = await db.execute({
    sql: "SELECT id, kind, name, duration_ms, ok, created_at FROM traces WHERE user_id = ? ORDER BY id DESC LIMIT 15",
    args: [user.id],
  });

  const toolRows: ToolRow[] = tools.rows.map((r) => ({
    name: String(r.name),
    calls: Number(r.calls),
    avgMs: Math.round(Number(r.avgMs)),
  }));
  const recentRows: RecentRow[] = recent.rows.map((r) => ({
    id: Number(r.id),
    kind: String(r.kind),
    name: String(r.name),
    durationMs: Number(r.duration_ms),
    ok: Number(r.ok),
    createdAt: String(r.created_at),
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">📊 使用统计（可观测 v1）</h1>
        <a href="/chat" className="text-sm text-slate-400 transition-colors hover:text-slate-200">
          ← 返回对话
        </a>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        每次对话与工具调用都会记录耗时与用量（自建轻量追踪层，数据只属于你）
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: '对话次数', value: chatCount },
          { label: '工具调用', value: toolCount },
          { label: '平均对话耗时', value: `${(avgChatMs / 1000).toFixed(1)}s` },
          { label: '累计 token', value: totalTokens || '—' },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">{c.value}</p>
          </div>
        ))}
      </div>

      {toolRows.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">工具调用分布</h2>
          <div className="space-y-2">
            {toolRows.map((t) => (
              <div key={t.name} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 text-sm">
                <span className="w-40 truncate text-slate-200">{t.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.round((t.calls / toolRows[0].calls) * 100)}%` }}
                  />
                </div>
                <span className="w-28 text-right text-xs text-slate-500">
                  {t.calls} 次 · 均 {t.avgMs}ms
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">最近事件</h2>
        {recentRows.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-xs text-slate-500">
            还没有追踪数据——去对话一次（或触发演示模式），然后回来看这里
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">时间</th>
                  <th className="px-4 py-2 font-medium">类型</th>
                  <th className="px-4 py-2 font-medium">名称</th>
                  <th className="px-4 py-2 text-right font-medium">耗时</th>
                  <th className="px-4 py-2 text-right font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentRows.map((r) => (
                  <tr key={r.id} className="bg-slate-900/30">
                    <td className="px-4 py-2 text-slate-500">{r.createdAt}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-1.5 py-0.5 ${r.kind === 'chat' ? 'bg-sky-950 text-sky-400' : 'bg-emerald-950 text-emerald-400'}`}>
                        {r.kind}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-200">{r.name}</td>
                    <td className="px-4 py-2 text-right text-slate-400">{r.durationMs}ms</td>
                    <td className="px-4 py-2 text-right">{r.ok ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
