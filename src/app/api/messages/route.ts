import { NextResponse } from 'next/server';
import { db, ensureSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const conversationId = Number(body?.conversationId);
  const userContent = typeof body?.userContent === 'string' ? body.userContent.trim() : '';
  const assistantContent = typeof body?.assistantContent === 'string' ? body.assistantContent : '';
  const hasToolInvocations = Array.isArray(body?.toolInvocations) && body.toolInvocations.length > 0;

  if (!Number.isInteger(conversationId) || !userContent || (!assistantContent && !hasToolInvocations)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  await ensureSchema();
  const conv = await db.execute({
    sql: 'SELECT id, title FROM conversations WHERE id = ? AND user_id = ?',
    args: [conversationId, user.id],
  });
  if (conv.rows.length === 0) return NextResponse.json({ error: '对话不存在' }, { status: 404 });

  const toolInvocations = hasToolInvocations ? JSON.stringify(body.toolInvocations) : null;
  await db.execute({
    sql: 'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
    args: [conversationId, 'user', userContent],
  });
  await db.execute({
    sql: 'INSERT INTO messages (conversation_id, role, content, tool_invocations) VALUES (?, ?, ?, ?)',
    args: [conversationId, 'assistant', assistantContent, toolInvocations],
  });

  if (conv.rows[0].title) {
    await db.execute({
      sql: "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
      args: [conversationId],
    });
  } else {
    await db.execute({
      sql: "UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?",
      args: [userContent.slice(0, 24), conversationId],
    });
  }
  return NextResponse.json({ ok: true });
}
