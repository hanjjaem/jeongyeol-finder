import { NextResponse } from "next/server";
import { callLLM } from "../../../lib/llm";
import { parseTable, buildTablePrompt } from "../../../lib/table";
import { buildSystemPrompt } from "../../../lib/systemPrompt";
import { extractJson } from "../../../lib/json";

export const runtime = "nodejs";

let cachedSystem: string | null = null;
function systemPrompt(): string {
  if (!cachedSystem) cachedSystem = buildSystemPrompt(buildTablePrompt(parseTable()));
  return cachedSystem;
}

export async function POST(request: Request) {
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "query가 필요합니다" }, { status: 400 });
  }
  try {
    const raw = await callLLM(systemPrompt(), [{ role: "user", content: query }]);
    const result = extractJson(raw);
    return NextResponse.json({ result });
  } catch (e) {
    console.error("lookup 오류:", e);
    return NextResponse.json({ error: "결과 생성 실패. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
