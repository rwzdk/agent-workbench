'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? '请求失败，请稍后再试');
        return;
      }
      router.replace('/chat');
      router.refresh();
    } catch {
      setError('网络错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-950 p-1 text-sm">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError('');
            }}
            className={`rounded-lg py-2 transition-colors ${
              mode === m ? 'bg-emerald-600 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs text-slate-400">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs text-slate-400">
            密码{mode === 'register' && '（至少 8 位）'}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={mode === 'register' ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500"
          />
        </div>

        {error && <p className="rounded-lg bg-red-950/60 px-3 py-2 text-xs text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          {loading ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>
    </div>
  );
}
