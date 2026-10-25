import { tool } from 'ai';
import { z } from 'zod';
import { ensureSchema, getDb } from './db';
import { evaluateExpression } from './calc';

export function createTools(userId: number) {
  return {
    calculator: tool({
      description: '计算数学表达式，支持 + - * / % ^ 和括号，例如 "(1+2)*3^2"。需要精确结果时务必使用。',
      parameters: z.object({
        expression: z.string().describe('要计算的数学表达式'),
      }),
      execute: async ({ expression }) => {
        try {
          const value = evaluateExpression(expression);
          return { ok: true, expression, value };
        } catch (e) {
          return { ok: false, expression, error: e instanceof Error ? e.message : '计算失败' };
        }
      },
    }),

    get_current_time: tool({
      description: '获取当前时间，可指定 IANA 时区（如 Asia/Shanghai、Asia/Tokyo），不传则返回 UTC。',
      parameters: z.object({
        timezone: z.string().optional().describe('IANA 时区名，例如 Asia/Shanghai'),
      }),
      execute: async ({ timezone }) => {
        const tz = timezone ?? 'UTC';
        try {
          const formatted = new Intl.DateTimeFormat('zh-CN', {
            timeZone: tz,
            dateStyle: 'full',
            timeStyle: 'medium',
          }).format(new Date());
          return { ok: true, timezone: tz, iso: new Date().toISOString(), formatted };
        } catch {
          return { ok: false, error: `无法识别时区：${tz}，请使用 IANA 时区名（如 Asia/Shanghai）` };
        }
      },
    }),

    fetch_webpage: tool({
      description: '抓取公开网页并返回标题与正文摘要（前 1500 字符），用于查询网页上的信息。',
      parameters: z.object({
        url: z.string().url().describe('要抓取的网页地址，必须以 http(s) 开头'),
      }),
      execute: async ({ url }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'AgentWorkbench/0.1' },
          });
          const html = await res.text();
          const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return { ok: true, status: res.status, title, excerpt: text.slice(0, 1500) };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? `抓取失败：${e.message}` : '抓取失败' };
        } finally {
          clearTimeout(timer);
        }
      },
    }),

    save_note: tool({
      description: '把重要信息保存为当前用户的笔记，之后可以用 search_notes 检索。',
      parameters: z.object({
        title: z.string().default('').describe('笔记标题，可为空'),
        content: z.string().describe('笔记内容'),
      }),
      execute: async ({ title, content }) => {
        await ensureSchema();
        const db = await getDb();
        const rs = await db.execute({
          sql: 'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
          args: [userId, title, content],
        });
        return { ok: true, noteId: Number(rs.lastInsertRowid), title, content };
      },
    }),

    search_notes: tool({
      description: '按关键词检索当前用户已保存的笔记，返回最近匹配的 5 条。',
      parameters: z.object({
        query: z.string().describe('检索关键词'),
      }),
      execute: async ({ query }) => {
        await ensureSchema();
        const db = await getDb();
        const rs = await db.execute({
          sql: `SELECT id, title, content, created_at FROM notes
                WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
                ORDER BY id DESC LIMIT 5`,
          args: [userId, `%${query}%`, `%${query}%`],
        });
        return {
          ok: true,
          query,
          results: rs.rows.map((r) => ({
            id: Number(r.id),
            title: String(r.title),
            content: String(r.content),
            createdAt: String(r.created_at),
          })),
        };
      },
    }),
  };
}
