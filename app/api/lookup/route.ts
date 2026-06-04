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

  // 2) 표에서 못 풀린 모호한 자연어만 LLM 폴백 — 비용 발생 지점.
  //    BYOK: 사용자가 가져온 키로만 호출한다(서버 키 안 씀). 키는 저장·로깅하지 않는다.
  const userKey = request.headers.get("x-llm-key")?.trim() ?? "";
  if (!userKey) {
    return NextResponse.json(
      { error: "이 질문은 정밀 분석(LLM)이 필요해요. 본인 API 키를 입력해 주세요.", needsKey: true },
      { status: 401 }
    );
  }

  try {
    const raw = await callLLM(systemPrompt(), [{ role: "user", content: query }], userKey);
    const result = extractJson(raw);
    if (cache.size > 500) cache.clear();
    cache.set(ck, result);
    return NextResponse.json({ result, source: "llm" });
  } catch (e) {
    const err = e as { status?: number; code?: string; message?: string };
    const status = err?.status;
    const code = (err?.code ?? "").toLowerCase();
    const msg = (err?.message ?? "").toLowerCase();

    // 1) 잘못된/권한 없는 키 (Gemini는 400 + "API key not valid")
    if (
      status === 401 ||
      status === 403 ||
      msg.includes("api key not valid") ||
      msg.includes("api_key_invalid")
    ) {
      return NextResponse.json(
        { error: "API 키가 올바르지 않거나 권한이 없어요. 키를 다시 확인해 주세요.", needsKey: true },
        { status: 401 }
      );
    }
    // 2) 크레딧·잔액 없음 (OpenAI insufficient_quota / Anthropic credit balance too low)
    if (
      code === "insufficient_quota" ||
      msg.includes("insufficient_quota") ||
      msg.includes("credit balance") ||
      msg.includes("billing")
    ) {
      return NextResponse.json(
        {
          error: "이 키는 크레딧(잔액)이 없어요. 결제·충전 후 쓰거나, 잔액 있는 다른 키를 넣어주세요.",
          needsKey: true,
        },
        { status: 402 }
      );
    }
    // 3) 요청이 잠깐 몰림 (rate limit) — 키 문제 아님, 잠시 후 재시도
    if (status === 429) {
      return NextResponse.json(
        { error: "요청이 잠깐 몰렸어요. 몇 초 뒤 다시 시도해 주세요." },
        { status: 429 }
      );
    }
    console.error("lookup 오류:", e);
    return NextResponse.json({ error: "결과 생성 실패. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
