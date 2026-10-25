import { streamText, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSessionUser } from '@/lib/auth';
import { createTools } from '@/lib/tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是 Agent Workbench 里运行的 AI 助手。
- 用简体中文、简洁地回答，可以使用 Markdown。
- 需要算数、查时间、抓网页、记笔记时，优先调用提供的工具，不要凭空猜测。
- 同一个问题里可以组合多个工具、分多步完成。
- 工具返回错误时，向用户说明原因并给出替代建议。`;

function textStreamResponse(text: string) {
  // 构造 AI SDK 数据流协议的纯文本分片，让提示以 assistant 消息形式出现在聊天里
  return new Response(`0:${JSON.stringify(text)}`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: '未登录' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return textStreamResponse(
      '⚠️ 还没有配置模型 API Key。请在项目根目录把 `.env.example` 复制为 `.env`，' +
        '填入 `OPENAI_API_KEY`（支持 OpenAI / DeepSeek / 通义等任何 OpenAI 兼容接口，' +
        '可用 `OPENAI_BASE_URL` 和 `OPENAI_MODEL` 覆盖默认值），然后重启 `npm run dev` 再试。',
    );
  }

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
