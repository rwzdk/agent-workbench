import { createDataStreamResponse, formatDataStreamPart, streamText, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSessionUser } from '@/lib/auth';
import { createTools } from '@/lib/tools';
import { ensureSchema, getDb } from '@/lib/db';
import { evaluateExpression } from '@/lib/calc';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是 Agent Workbench 里运行的 AI 助手。
- 用简体中文、简洁地回答；可用 Markdown。
- 需要计算、查时间、抓网页、记笔记时，优先调用提供的工具，而不是凭空猜测。
- 同一个问题里可以组合多个工具、分多步完成。
- 工具返回错误时，向用户说明原因并给出替代建议。`;

/**
 * 演示模式：未配置 API Key 时，模拟一次"提问 → 计算器 → 保存笔记"的 Agent 多步执行。
 * 工具调用是真实执行的（表达式用自研解析器求值、笔记真实写入数据库），
 * 这样零配置的访客（比如点开线上 Demo 的招聘方）也能看到完整的产品形态。
 */
function createDemoResponse(userId: number) {
  return createDataStreamResponse({
    execute: async (writer) => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const expression = '(1234 * 56 / 7) ^ 0.5';
      const value = evaluateExpression(expression);
      const noteContent = `${expression} = ${value.toFixed(4)}`;

      writer.write(
        formatDataStreamPart(
          'text',
          '🔧 **演示模式**（未配置 `OPENAI_API_KEY`）：以下是一次「模拟提问 + **真实工具执行**」的 Agent 过程演示。\n\n' +
            '> 帮我算 (1234 × 56 ÷ 7) ^ 0.5，并把结果记成笔记\n\n',
        ),
      );
      await sleep(600);

      writer.write(
        formatDataStreamPart('tool_call', {
          toolCallId: 'demo-calc',
          toolName: 'calculator',
          args: { expression },
        }),
      );
      await sleep(800);
      writer.write(
        formatDataStreamPart('tool_result', {
          toolCallId: 'demo-calc',
          result: { ok: true, expression, value },
        }),
      );
      await sleep(600);

      writer.write(
        formatDataStreamPart('tool_call', {
          toolCallId: 'demo-note',
          toolName: 'save_note',
          args: { title: '计算结果', content: noteContent },
        }),
      );
      await sleep(700);
      await ensureSchema();
      const db = await getDb();
      const rs = await db.execute({
        sql: 'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
        args: [userId, '计算结果', noteContent],
      });
      writer.write(
        formatDataStreamPart('tool_result', {
          toolCallId: 'demo-note',
          result: { ok: true, noteId: Number(rs.lastInsertRowid), title: '计算结果', content: noteContent },
        }),
      );

      await sleep(400);
      writer.write(
        formatDataStreamPart(
          'text',
          `✅ 两步工具调用完成：计算结果 **≈ ${value.toFixed(2)}**，笔记已真实写入 SQLite（之后可以问"我记过哪些笔记"来检索它）。\n\n` +
            '在 `.env` 中配置 `OPENAI_API_KEY`（支持 DeepSeek 等任何 OpenAI 兼容接口）后，任意问题都会走真实的多步 Agent 流程。',
        ),
      );
    },
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: '未登录' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return createDemoResponse(user.id);

  const body = await req.json().catch(() => null);
  const raw: { role?: string; content?: unknown }[] = Array.isArray(body?.messages) ? body.messages : [];
  const messages: CoreMessage[] = raw
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '',
    )
    .map((m) => ({ role: m.role, content: m.content }));

  if (messages.length === 0) return Response.json({ error: '消息为空' }, { status: 400 });

  const openai = createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
  const modelId = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const result = streamText({
    model: openai(modelId),
    system: SYSTEM_PROMPT,
    messages,
    tools: createTools(user.id),
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
