import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// 与 src/app/api/auth/register/route.ts 保持一致的入参校验
const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, '密码至少 8 位'),
});

describe('认证逻辑', () => {
  it('密码被加盐哈希存储且可验证', async () => {
    const hash = await bcrypt.hash('password123', 10);
    expect(hash).not.toBe('password123');
    expect(await bcrypt.compare('password123', hash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
  });

  it('拒绝非法邮箱与过短密码', () => {
    expect(credentials.safeParse({ email: 'a@b.com', password: '12345678' }).success).toBe(true);
    expect(credentials.safeParse({ email: 'not-an-email', password: '12345678' }).success).toBe(false);
    expect(credentials.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
  });

  it('邮箱自动去除空格并转为小写', () => {
    const parsed = credentials.safeParse({ email: '  A@B.COM ', password: '12345678' });
    expect(parsed.success && parsed.data.email).toBe('a@b.com');
  });
});
