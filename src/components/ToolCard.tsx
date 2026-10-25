'use client';

import { useState } from 'react';
import type { ToolInvocation } from 'ai';

const TOOL_LABELS: Record<string, string> = {
  calculator: '🧮 计算器',
  get_current_time: '🕒 当前时间',
  fetch_webpage: '🌐 网页抓取',
  save_note: '📝 保存笔记',
  search_notes: '🔍 检索笔记',
};

function previewResult(result: unknown): string {
  try {
    const s = JSON.stringify(result, null, 2);
    return s.length > 2000 ? `${s.slice(0, 2000)}\n…` : s;
  } catch {
    return String(result);
  }
}

export default function ToolCard({ invocation }: { invocation: ToolInvocation }) {
  const [open, setOpen] = useState(false);
  const running = invocation.state === 'call';
  const result = invocation.state === 'result' ? invocation.result : null;
  const label = TOOL_LABELS[invocation.toolName] ?? `🔧 ${invocation.toolName}`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 text-sm">
      <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left" onClick={() => setOpen(!open)}>
        <span>{label}</span>
        {running ? (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-400">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400" />
            运行中
          </span>
        ) : (
          <span className="ml-auto text-xs text-emerald-400">✓ 完成</span>
        )}
        <span className="text-xs text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-800 px-4 py-3">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">参数</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
              {JSON.stringify(invocation.args, null, 2)}
            </pre>
          </div>
          {result != null && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">结果</p>
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
                {previewResult(result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
