import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSchema, getDb } from '@/lib/db';
import { createSession, hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 位'),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数错误' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  await ensureSchema();
  const db = await getDb();
  const exists = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
  if (exists.rows.length > 0) {
    return NextResponse.json({ error: '该邮箱已注册，请直接登录' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const rs = await db.execute({
    sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    args: [email, passwordHash],
  });
  await createSession(Number(rs.lastInsertRowid));
  return NextResponse.json({ ok: true });
}
