import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, ensureSchema } from './db';

export const SESSION_COOKIE = 'aw_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: number; email: string };

export async function createSession(userId: number) {
  await ensureSchema();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    args: [id, userId, expiresAt],
  });
  cookies().set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function destroySession() {
  const store = cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) {
    await ensureSchema();
    await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [id] });
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const id = cookies().get(SESSION_COOKIE)?.value;
  if (!id) return null;
  await ensureSchema();
  const rs = await db.execute({
    sql: `SELECT u.id AS id, u.email AS email
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND s.expires_at > ?`,
    args: [id, new Date().toISOString()],
  });
  const row = rs.rows[0];
  return row ? { id: Number(row.id), email: String(row.email) } : null;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
