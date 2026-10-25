import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, ensureSchema } from '@/lib/db';
import { createSession, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数错误' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  await ensureSchema();
  const rs = await db.execute({
    sql: 'SELECT id, password_hash FROM users WHERE email = ?',
    args: [email],
  });
  const user = rs.rows[0];
  if (!user || !(await verifyPassword(password, String(user.password_hash)))) {
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 400 });
  }

  await createSession(Number(user.id));
  return NextResponse.json({ ok: true });
}
