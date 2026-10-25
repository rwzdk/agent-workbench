import { NextResponse } from 'next/server';
import { db, ensureSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  await ensureSchema();
  const rs = await db.execute({
    sql: 'SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 50',
    args: [user.id],
  });
  return NextResponse.json({
    conversations: rs.rows.map((r) => ({
      id: Number(r.id),
      title: (r.title as string) ?? null,
      updatedAt: String(r.updated_at),
    })),
  });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  await ensureSchema();
  const rs = await db.execute({ sql: 'INSERT INTO conversations (user_id) VALUES (?)', args: [user.id] });
  return NextResponse.json({ conversation: { id: Number(rs.lastInsertRowid), title: null } });
}
