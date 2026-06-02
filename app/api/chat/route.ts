import { NextResponse } from "next/server";
import { callLLM, type ChatMessage } from "../../../lib/llm";
import { parseTable, buildTablePrompt } from "../../../lib/table";
import { buildSystemPrompt } from "../../../lib/systemPrompt";

export const runtime = "nodejs";

let cachedSystem: string | null = null;
function systemPrompt(): string {
  if (!cachedSystem) cachedSystem = buildSystemPrompt(buildTablePrompt(parseTable()));
  return cachedSystem;
}

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages가 필요합니다" }, { status: 400 });
  }
  try {
    const reply = await callLLM(systemPrompt(), messages);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("LLM 오류:", e);
    return NextResponse.json({ error: "응답 생성 실패. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
