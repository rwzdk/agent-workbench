import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/chat');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <Link href="/" className="text-lg font-bold">
        ⚡ Agent <span className="text-emerald-400">Workbench</span>
      </Link>
      <LoginForm />
      <Link href="/" className="text-xs text-slate-500 transition-colors hover:text-slate-300">
        ← 返回首页
      </Link>
    </main>
  );
}
