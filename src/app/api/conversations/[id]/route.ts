import { NextResponse } from 'next/server';
import { db, ensureSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

async function ownedConversation(id: number, userId: number) {
  const rs = await db.execute({
    sql: 'SELECT id, title FROM conversations WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  return rs.rows[0] ?? null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  await ensureSchema();
  const conv = await ownedConversation(id, user.id);
  if (!conv) return NextResponse.json({ error: '对话不存在' }, { status: 404 });

  const rs = await db.execute({
    sql: 'SELECT id, role, content, tool_invocations FROM messages WHERE conversation_id = ? ORDER BY id ASC',
    args: [id],
  });
  return NextResponse.json({
    conversation: { id: Number(conv.id), title: (conv.title as string) ?? null },
    messages: rs.rows.map((r) => ({
      id: String(r.id),
      role: r.role,
      content: String(r.content ?? ''),
      toolInvocations: r.tool_invocations ? JSON.parse(String(r.tool_invocations)) : undefined,
    })),
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  await ensureSchema();
  const conv = await ownedConversation(id, user.id);
  if (!conv) return NextResponse.json({ error: '对话不存在' }, { status: 404 });

  await db.execute({ sql: 'DELETE FROM messages WHERE conversation_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM conversations WHERE id = ?', args: [id] });
  return NextResponse.json({ ok: true });
}
