import { NextResponse } from "next/server";
import { callLLM } from "../../../lib/llm";
import { parseTable, buildTablePrompt } from "../../../lib/table";
import { buildSystemPrompt } from "../../../lib/systemPrompt";
import { extractJson } from "../../../lib/json";
import { buildIndex, resolveLocal, type Index } from "../../../lib/resolve";

export const runtime = "nodejs";

let _index: Index | null = null;
let _system: string | null = null;
function getIndex(): Index {
  if (!_index) _index = buildIndex(parseTable());
  return _index;
}
function systemPrompt(): string {
  if (!_system) _system = buildSystemPrompt(buildTablePrompt(parseTable()));
  return _system;
}

const cache = new Map<string, unknown>();
const keyOf = (q: string) => q.trim().toLowerCase().replace(/\s+/g, "");

export async function POST(request: Request) {
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query가 필요합니다" }, { status: 400 });

  const ck = keyOf(query);
  if (cache.has(ck)) return NextResponse.json({ result: cache.get(ck), source: "cache" });

  // 1) 로컬 우선 — 표에서 바로 해결되면 LLM 안 씀
  const local = resolveLocal(query, getIndex());
  if (local) {
    cache.set(ck, local);
    return NextResponse.json({ result: local, source: "local" });
  }

  // 2) 모호한 자연어만 LLM 폴백
  try {
    const raw = await callLLM(systemPrompt(), [{ role: "user", content: query }]);
    const result = extractJson(raw);
    if (cache.size > 500) cache.clear();
    cache.set(ck, result);
    return NextResponse.json({ result, source: "llm" });
  } catch (e) {
    console.error("lookup 오류:", e);
    return NextResponse.json({ error: "결과 생성 실패. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
