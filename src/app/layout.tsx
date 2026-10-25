import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Workbench — AI Agent 工作台',
  description:
    '基于 Next.js 与 Vercel AI SDK 的全栈 AI Agent 应用：流式对话、工具调用可视化、会话持久化、用户认证。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-dvh bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
