// query → 결정형 전결 조회. 외부 네트워크·LLM 호출 없이 로컬 표만 사용한다.
import { parseTable } from "./table";
import { buildIndex, resolveLocal, type Index, type Result } from "./resolve";

export type LookupResponse =
  | { ok: true; result: Result; source: "local" | "cache" | "none" }
  | { ok: false; error: string; status: number };

let _index: Index | null = null;
function getIndex(): Index {
  if (!_index) _index = buildIndex(parseTable());
  return _index;
}

const cache = new Map<string, Result>();
const keyOf = (q: string) => q.trim().toLowerCase().replace(/\s+/g, "");

function notFound(task: string): Result {
  return {
    found: false,
    task,
    needsChoice: false,
    question: "",
    options: [],
    approver: "",
    drafter: "",
    reason: "",
    note: "",
  };
}

export async function lookup(query: string): Promise<LookupResponse> {
  const q = (query ?? "").trim();
  if (!q) return { ok: false, error: "query가 필요합니다", status: 400 };

  const ck = keyOf(q);
  const cached = cache.get(ck);
  if (cached) return { ok: true, result: cached, source: "cache" };

  const local = resolveLocal(q, getIndex());
  const result = local ?? notFound(q);
  cache.set(ck, result);
  return { ok: true, result, source: local ? "local" : "none" };
}
