// query → 결정형 전결 조회. 외부 네트워크·LLM 호출 없이 로컬 표만 사용한다.
import { parseTable } from "./table";
import { ambiguousKeys, buildIndex, resolveLocal, type Index, type Option, type Result } from "./resolve";
import { loadFullRecords, type FullRecord } from "./fullData";

export type SourceEvidence = {
  id: string;
  sourceSheet: string;
  sourceRow: number;
  sourceRange: string;
  category: string;
  taskRaw: string;
  task: string;
  path: string[];
  marks: FullRecord["marks"];
  drafter: string[];
  approver: string[];
  status: string;
  issues: string[];
};

export type EnrichedOption = Option & { evidence?: SourceEvidence };
export type EnrichedResult = Omit<Result, "options"> & {
  options: EnrichedOption[];
  evidence?: SourceEvidence[];
  department?: string;
  departments?: string[];
  fullSearch?: boolean;
  unmatched?: string[]; // 질문 중 근거 원문에 없는 말 — 가장 가까운 규정으로 안내했다는 표시
};

// 금액·비교어·흔한 조사는 원문과 대조하지 않는다.
const IGNORED_WORDS = new Set(["이하", "이상", "초과", "미만", "관련", "대한", "위한", "경우", "및", "등", "건"]);
const PARTICLE = /(에서|으로|에게|에|의|을|를|은|는|이|가|로|와|과|도)$/;

function unmatchedWords(query: string, result: EnrichedResult): string[] {
  const haystack = compact([
    result.task,
    result.reason,
    result.condition ?? "",
    result.note,
    ...result.options.map((option) => option.label),
    ...(result.evidence ?? []).flatMap((evidence) => [evidence.category, evidence.taskRaw, ...evidence.path]),
  ].join(" "));
  return query.split(/\s+/).filter((word) => {
    if (!word || /\d/.test(word) || IGNORED_WORDS.has(word)) return false;
    const token = compact(word);
    if (!token || haystack.includes(token)) return false;
    const stem = token.replace(PARTICLE, "");
    return !(stem && haystack.includes(stem));
  });
}

function withUnmatched(query: string, result: EnrichedResult): EnrichedResult {
  if (!result.found) return result;
  const unmatched = unmatchedWords(query, result);
  return unmatched.length ? { ...result, unmatched } : result;
}

export type LookupResponse =
  | { ok: true; result: EnrichedResult; source: "local" | "cache" | "full" | "none" }
  | { ok: false; error: string; status: number };

let _index: Index | null = null;
function getIndex(): Index {
  if (!_index) _index = buildIndex(parseTable());
  return _index;
}

const cache = new Map<string, Result>();
// text: 대분류·전체 경로·행 원문, near: 행 원문과 바로 위 제목
type FullIndex = { record: FullRecord; text: string; near: string }[];
let _fullIndex: FullIndex | null = null;
async function getFullIndex(): Promise<FullIndex> {
  if (!_fullIndex) _fullIndex = (await loadFullRecords()).map((record) => ({
    record,
    text: compact([record.category.text, ...record.path.map((entry) => entry.text), record.task_raw].join(" ")),
    near: compact([parentText(record), record.task_raw].join(" ")),
  }));
  return _fullIndex;
}

function parentText(record: FullRecord): string {
  return record.path.length >= 2 ? record.path[record.path.length - 2].text.trim() : "";
}

const ISSUE_TEXT: Record<string, string> = {
  no_marks: "원문에 결재 표시가 없는 행",
  no_drafter_mark: "원문에 기안자(★) 표시가 없음",
  unrecognized_hierarchy: "원문 항목 단계를 확인하지 못함",
};

function issueNote(record: FullRecord): string {
  return record.issues.length ? `원문 확인 필요: ${record.issues.map((issue) => ISSUE_TEXT[issue] ?? issue).join(", ")}` : "";
}

function recordReason(record: FullRecord): string {
  return `${record.category.text} · ${record.path.map((entry) => entry.text.trim()).join(" › ")}`;
}
const keyOf = (q: string, department?: string) => `${department ?? ""}|${q.trim().toLowerCase().replace(/\s+/g, "")}`;

function compact(value: string): string {
  return value.toLowerCase().replace(/[\s·∙,()>＞"'`\-–—.·]/g, "");
}

function toEvidence(record: FullRecord): SourceEvidence {
  return {
    id: record.id,
    sourceSheet: record.source_sheet,
    sourceRow: record.source_row_start,
    sourceRange: record.source_range,
    category: record.category.text,
    taskRaw: record.task_raw,
    task: record.task,
    path: record.path.map((entry) => entry.text),
    marks: record.marks,
    drafter: record.drafter,
    approver: record.approver,
    status: record.status,
    issues: record.issues,
  };
}

function fullMatches(fullIndex: FullIndex, query: string, department?: string): FullRecord[] {
  const tokens = query.split(/\s+/).map(compact).filter(Boolean);
  return fullIndex
    // 최상위 제목에만 걸린 행(예: "휴가, 출장, 특근 등" 밑의 시간외근무)은 빼려고, 한 단어 이상은 행 자신이나 바로 위 제목에 있어야 한다.
    .filter(({ record, text, near }) => (!department || record.department_scope === department) && tokens.every((token) => text.includes(token)) && tokens.some((token) => near.includes(token)))
    .map(({ record }) => record);
}

function notFound(task: string): EnrichedResult {
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
    fullSearch: true,
  };
}

function directFull(record: FullRecord): EnrichedResult {
  return {
    found: true,
    task: record.task,
    needsChoice: false,
    question: "",
    options: [],
    approver: record.approver.join(", "),
    drafter: record.drafter.join(", "),
    reason: recordReason(record),
    note: issueNote(record),
    evidence: [toEvidence(record)],
    department: record.department_scope,
    departments: [record.department_scope],
    fullSearch: true,
  };
}

function fullOption(record: FullRecord) {
  const parent = parentText(record);
  return {
    label: `${record.department_scope} · ${parent ? `${parent} › ` : ""}${record.task}`,
    approver: record.approver.join(", "),
    drafter: record.drafter.join(", "),
    note: issueNote(record),
    reason: recordReason(record),
    evidence: toEvidence(record),
  };
}

function fullResult(query: string, matched: FullRecord[]): EnrichedResult {
  // 결재 표시(★○)가 없는 제목 행은 고를 수 있는 결과가 아니므로 뺀다.
  const records = matched.filter((record) => record.marks.length > 0);
  if (records.length === 0) return notFound(query);
  if (records.length === 1) return directFull(records[0]);

  const options = records.slice(0, 50).map(fullOption);
  return {
    found: true,
    task: query,
    needsChoice: true,
    question: `원문 후보 ${records.length}건 중 하나를 선택하세요`,
    options,
    approver: "",
    drafter: "",
    reason: `${new Set(records.map((record) => record.department_scope)).size}개 부서 · ${records.length}개 원문 행`,
    note: records.length > options.length ? `후보가 많아 상위 ${options.length}건만 표시합니다.` : "",
    evidence: records.slice(0, 50).map(toEvidence),
    departments: [...new Set(records.map((record) => record.department_scope))],
    fullSearch: true,
  };
}

// 공통사항 검색키 선택지(고르면 그 검색키로 다시 검색, option.query) 뒤에 다른 부서 원문 후보를 붙인다.
// 169행 검색표가 공통사항 시트를 옮긴 것이라 공통사항 원문 행은 중복으로 보고 뺀다.
function keyChoice(query: string, keys: string[], matched: FullRecord[]): EnrichedResult {
  const others = matched.filter((record) => record.marks.length > 0 && record.department_scope !== "공통사항");
  const keyOptions = keys.map((key) => ({ label: `공통사항 · ${key}`, approver: "", drafter: "", note: "", query: key }));
  return {
    found: true,
    task: query,
    needsChoice: true,
    question: "어떤 업무인가요?",
    options: [...keyOptions, ...others.slice(0, 50 - keyOptions.length).map(fullOption)],
    approver: "",
    drafter: "",
    reason: "",
    note: "",
  };
}

// 169행 결과에는 검색표에 적힌 원문행(source)을 그대로 근거로 붙인다. 글자 맞추기로 추측하지 않는다.
function enrichLegacy(fullIndex: FullIndex, result: Result, department?: string): EnrichedResult {
  const recordOf = (id?: string) => (id ? fullIndex.find(({ record }) => record.id === id)?.record : undefined);
  const options = result.options.map((option) => {
    const record = recordOf(option.source);
    return record ? { ...option, evidence: toEvidence(record) } : option;
  });
  const records = [recordOf(result.source), ...options.map((option) => recordOf(option.source))]
    .filter((record): record is FullRecord => Boolean(record))
    .filter((record, index, list) => list.findIndex((other) => other.id === record.id) === index);
  return {
    ...result,
    options,
    evidence: records.map(toEvidence),
    departments: [...new Set(records.map((record) => record.department_scope))],
    department,
  };
}

export async function lookup(query: string, department?: string): Promise<LookupResponse> {
  const q = (query ?? "").trim();
  if (!q) return { ok: false, error: "query가 필요합니다", status: 400 };

  const ck = keyOf(q, department);
  const cached = cache.get(ck);
  if (cached) return { ok: true, result: cached as EnrichedResult, source: "cache" };

  const fullIndex = await getFullIndex();
  const local = resolveLocal(q, getIndex());
  if (local && (!department || local.branch === "금액")) {
    const result = withUnmatched(q, enrichLegacy(fullIndex, local, department));
    cache.set(ck, result);
    return { ok: true, result, source: "local" };
  }
  const keys = department ? [] : ambiguousKeys(q, getIndex());
  if (keys.length) {
    const result = keyChoice(q, keys, fullMatches(fullIndex, q));
    cache.set(ck, result);
    return { ok: true, result, source: "local" };
  }
  const scopedResult = withUnmatched(q, fullResult(q, fullMatches(fullIndex, q, department)));
  cache.set(ck, scopedResult);
  return { ok: true, result: scopedResult, source: scopedResult.found ? "full" : "none" };
}
