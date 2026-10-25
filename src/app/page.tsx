import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

const FEATURES = [
  {
    icon: '⚡',
    title: '流式对话',
    desc: '基于 Vercel AI SDK 的服务端流式输出，打字机式体验，支持随时中断。',
  },
  {
    icon: '🔧',
    title: '工具调用可视化',
    desc: '内置计算器 / 时间 / 网页抓取 / 笔记工具，Agent 多步调用过程全程可见。',
  },
  {
    icon: '💾',
    title: '全栈持久化',
    desc: 'SQLite (libSQL) 存储用户、会话与消息，注册登录、历史记录一个不少。',
  },
];

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect('/chat');

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-14 px-6 py-16">
      <section className="text-center">
        <p className="mb-5 inline-block rounded-full border border-emerald-800 bg-emerald-950/60 px-4 py-1 text-xs text-emerald-400">
          全栈 · AI Agent · 流式工具调用
        </p>
        <h1 className="text-4xl font-bold md:text-6xl">
          Agent <span className="text-emerald-400">Workbench</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-slate-400">
          一个用 Next.js + Vercel AI SDK 从零实现的 AI Agent 工作台：看得见的工具调用、带记忆的会话、可部署的全栈架构。
        </p>
        <div className="mt-9 flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium transition-colors hover:bg-emerald-500"
          >
            开始使用
          </Link>
          <a
            href="https://github.com/your-name/agent-workbench"
            className="rounded-xl border border-slate-700 px-6 py-3 text-sm transition-colors hover:bg-slate-900"
          >
            GitHub
          </a>
        </div>
      </section>

      <section className="grid w-full gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="text-2xl">{f.icon}</div>
            <h2 className="mt-3 font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="text-xs text-slate-600">Agent Workbench · 学习型全栈项目 · MIT License</footer>
    </main>
  );
}
