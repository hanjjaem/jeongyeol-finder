// query → 결과 오케스트레이션. route.ts에서 이식한 순수 async 함수(브라우저/노드 공용).
// 로컬 표 매칭 우선 → 모듈 캐시 → BYOK LLM 폴백 → 에러 분류.
import { callLLM } from "./llm";
import { parseTable, buildTablePrompt } from "./table";
import { buildSystemPrompt } from "./systemPrompt";
import { extractJson } from "./json";
import { buildIndex, resolveLocal, type Index, type Result } from "./resolve";

export type LookupResponse =
  | { ok: true; result: Result; source: "local" | "llm" | "cache" }
  | { ok: false; error: string; needsKey?: boolean; status: number };

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

const cache = new Map<string, Result>();
const keyOf = (q: string) => q.trim().toLowerCase().replace(/\s+/g, "");

export async function lookup(query: string, userKey: string): Promise<LookupResponse> {
  const q = (query ?? "").trim();
  if (!q) return { ok: false, error: "query가 필요합니다", status: 400 };

  const ck = keyOf(q);
  const cached = cache.get(ck);
  if (cached) return { ok: true, result: cached, source: "cache" };

  // 1) 로컬 우선 — 표에서 바로 해결되면 LLM 안 씀
  const local = resolveLocal(q, getIndex());
  if (local) {
    cache.set(ck, local);
    return { ok: true, result: local, source: "local" };
  }

  // 2) 표에서 못 푼 모호 질의만 LLM 폴백 — 사용자 키로만 호출(BYOK)
  const key = (userKey ?? "").trim();
  if (!key) {
    return {
      ok: false,
      error: "이 질문은 정밀 분석(LLM)이 필요해요. 본인 API 키를 입력해 주세요.",
      needsKey: true,
      status: 401,
    };
  }

  try {
    const raw = await callLLM(systemPrompt(), [{ role: "user", content: q }], key);
    const result = extractJson(raw) as Result;
    if (cache.size > 500) cache.clear();
    cache.set(ck, result);
    return { ok: true, result, source: "llm" };
  } catch (e) {
    const err = e as { status?: number; code?: string; message?: string };
    const status = err?.status;
    const code = (err?.code ?? "").toLowerCase();
    const msg = (err?.message ?? "").toLowerCase();

    // 미지원 제공자(OpenAI 등) — llm.ts가 code:"unsupported_provider"로 throw
    if (code === "unsupported_provider") {
      return { ok: false, error: err.message ?? "지원하지 않는 키", needsKey: true, status: 400 };
    }
    // 잘못된/권한 없는 키
    if (status === 401 || status === 403 || msg.includes("api key not valid") || msg.includes("api_key_invalid")) {
      return { ok: false, error: "API 키가 올바르지 않거나 권한이 없어요. 키를 다시 확인해 주세요.", needsKey: true, status: 401 };
    }
    // 크레딧·잔액 없음
    if (code === "insufficient_quota" || msg.includes("insufficient_quota") || msg.includes("credit balance") || msg.includes("billing")) {
      return { ok: false, error: "이 키는 크레딧(잔액)이 없어요. 결제·충전 후 쓰거나, 잔액 있는 다른 키를 넣어주세요.", needsKey: true, status: 402 };
    }
    // 레이트리밋
    if (status === 429) {
      return { ok: false, error: "요청이 잠깐 몰렸어요. 몇 초 뒤 다시 시도해 주세요.", status: 429 };
    }
    // 모델 없음/미지원
    if (status === 404 || msg.includes("not found") || msg.includes("is not supported") || msg.includes("not supported for")) {
      return { ok: false, error: "지금 설정된 AI 모델을 쓸 수 없어요(관리자 확인 필요). 키 문제는 아닙니다.", status: 502 };
    }
    return { ok: false, error: "결과 생성 실패. 잠시 후 다시 시도해 주세요.", status: 502 };
  }
}
