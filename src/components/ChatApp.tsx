'use client';

import { useChat } from '@ai-sdk/react';
import type { Message, ToolInvocation } from 'ai';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Sidebar, { type Conversation } from './Sidebar';
import ToolCard from './ToolCard';

const EXAMPLES = [
  '帮我算一下 (1234 * 56 / 7) ^ 0.5',
  '现在东京几点了？',
  '抓取 https://nodejs.org 首页并总结 Node.js 是什么',
  '记一条笔记：明天上午 10 点项目周会，然后检索一下我记过哪些笔记',
];

export default function ChatApp({
  email,
  initialConversations,
}: {
  email: string;
  initialConversations: Conversation[];
}) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const convIdRef = useRef<number | null>(null);
  const pendingUserRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, setMessages, input, setInput, handleSubmit, isLoading, error, stop } = useChat({
    api: '/api/chat',
    onFinish: async (message) => {
      const id = convIdRef.current;
      const userContent = pendingUserRef.current;
      if (id == null || !userContent) return;
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: id,
          userContent,
          assistantContent: message.content,
          toolInvocations: message.toolInvocations ?? [],
        }),
      });
      await refreshConversations();
    },
  });

  useEffect(() => {
    convIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function refreshConversations() {
    const res = await fetch('/api/conversations');
    if (!res.ok) return;
    const data = (await res.json()) as { conversations: Conversation[] };
    setConversations(data.conversations);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let id = conversationId;
    if (id == null) {
      const res = await fetch('/api/conversations', { method: 'POST' });
      if (!res.ok) return;
      const data = (await res.json()) as { conversation: { id: number } };
      id = data.conversation.id;
      setConversationId(id);
    }
    pendingUserRef.current = input.trim();
    handleSubmit(e, { body: { conversationId: id } });
  }

  async function selectConversation(id: number) {
    setSidebarOpen(false);
    if (id === conversationId) return;
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: { id: string; role: string; content: string; toolInvocations?: unknown[] }[];
    };
    setConversationId(id);
    setMessages(
      data.messages.map(
        (m): Message => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          toolInvocations: m.toolInvocations as ToolInvocation[] | undefined,
        }),
      ),
    );
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setInput('');
    setSidebarOpen(false);
  }

  async function deleteConversation(id: number) {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (id === conversationId) newChat();
    await refreshConversations();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  const lastMessage = messages[messages.length - 1];
  const waiting = isLoading && (!lastMessage || lastMessage.role === 'user');

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={conversationId}
        email={email}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={(id) => void selectConversation(id)}
        onNew={newChat}
        onDelete={(id) => void deleteConversation(id)}
        onLogout={() => void logout()}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <button
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <h1 className="text-sm font-semibold tracking-wide">Agent Workbench</h1>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
            5 个内置工具 · 多步执行
          </span>
          <div className="ml-auto hidden text-xs text-slate-500 sm:block">{email}</div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.length === 0 ? (
              <div className="pt-16 text-center">
                <div className="text-3xl">⚡</div>
                <h2 className="mt-4 text-lg font-semibold">开始一段新的对话</h2>
                <p className="mt-2 text-sm text-slate-500">
                  助手可以调用计算器、时间、网页抓取和笔记工具，试试下面的例子：
                </p>
                <div className="mx-auto mt-6 grid max-w-xl gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => {
                        setInput(ex);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-emerald-600/90 px-4 py-2.5 text-sm">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="space-y-3">
                    {m.content && (
                      <div className="prose prose-invert prose-sm max-w-none prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-800 prose-pre:bg-slate-950">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    )}
                    {m.toolInvocations?.map((inv, i) => (
                      <ToolCard key={inv.toolCallId ?? i} invocation={inv} />
                    ))}
                  </div>
                ),
              )
            )}

            {waiting && (
              <div className="flex items-center gap-1.5 px-1 text-slate-500">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                请求失败：{error.message || '未知错误'}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-slate-800 px-4 py-4">
          <form ref={formRef} onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              rows={2}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500"
            />
            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-xl bg-slate-700 px-4 py-3 text-sm transition-colors hover:bg-slate-600"
              >
                停止
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                发送
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
