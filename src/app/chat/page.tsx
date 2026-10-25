import { redirect } from 'next/navigation';
import { ensureSchema, getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import ChatApp from '@/components/ChatApp';

export default async function ChatPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  await ensureSchema();
  const db = await getDb();
  const rs = await db.execute({
    sql: 'SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 50',
    args: [user.id],
  });
  const conversations = rs.rows.map((r) => ({
    id: Number(r.id),
    title: (r.title as string) ?? null,
    updatedAt: String(r.updated_at),
  }));

  return <ChatApp email={user.email} initialConversations={conversations} />;
}
