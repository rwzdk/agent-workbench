'use client';

export type Conversation = { id: number; title: string | null; updatedAt: string };

export default function Sidebar({
  conversations,
  activeId,
  email,
  open,
  onClose,
  onSelect,
  onNew,
  onDelete,
  onLogout,
}: {
  conversations: Conversation[];
  activeId: number | null;
  email: string;
  open: boolean;
  onClose: () => void;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onLogout: () => void;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-900 transition-transform md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-bold tracking-wide">⚡ Agent Workbench</span>
          <button className="text-slate-400 md:hidden" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={onNew}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium transition-colors hover:bg-emerald-500"
          >
            ＋ 新对话
          </button>
        </div>

        <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {conversations.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-slate-500">还没有对话</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`group flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                c.id === activeId
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <span className="flex-1 truncate">{c.title || '新对话'}</span>
              <button
                title="删除对话"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="ml-2 hidden text-xs text-slate-500 transition-colors hover:text-red-400 group-hover:block"
              >
                🗑
              </button>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800 px-4 py-3">
          <p className="truncate text-xs text-slate-400">{email}</p>
          <div className="mt-2 flex items-center gap-3">
            <a
              href="/stats"
              className="text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              📊 使用统计
            </a>
            <button
              onClick={onLogout}
              className="text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              退出登录
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
