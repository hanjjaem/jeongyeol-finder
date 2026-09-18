// query → 결정형 전결 조회. 외부 네트워크·LLM 호출 없이 로컬 표만 사용한다.
import { parseTable } from "./table";
import { buildIndex, resolveLocal, type Index, type Result } from "./resolve";
import { getFullRecords, type FullRecord } from "./fullData";

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

export type EnrichedResult = Result & {
  evidence?: SourceEvidence[];
  department?: string;
  departments?: string[];
  fullSearch?: boolean;
};

export type LookupResponse =
  | { ok: true; result: EnrichedResult; source: "local" | "cache" | "full" | "none" }
  | { ok: false; error: string; status: number };

let _index: Index | null = null;
function getIndex(): Index {
  if (!_index) _index = buildIndex(parseTable());
  return _index;
}

const cache = new Map<string, Result>();
const fullRecords = getFullRecords();
const fullIndex = fullRecords.map((record) => ({ record, text: compact([record.category.text, ...record.path.map((entry) => entry.text), record.task_raw].join(" ")) }));
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

function fullMatches(query: string, department?: string): FullRecord[] {
  const tokens = query.split(/\s+/).map(compact).filter(Boolean);
  return fullIndex
    .filter(({ record, text }) => (!department || record.department_scope === department) && tokens.every((token) => text.includes(token)))
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
    reason: `${record.category.text} · ${record.task}`,
    note: "",
    evidence: [toEvidence(record)],
    department: record.department_scope,
    departments: [record.department_scope],
    fullSearch: true,
  };
}

function fullResult(query: string, records: FullRecord[]): EnrichedResult {
  if (records.length === 0) return notFound(query);
  if (records.length === 1) return directFull(records[0]);

  const options = records.slice(0, 50).map((record) => ({
    label: `${record.department_scope} · ${record.task}`,
    approver: record.approver.join(", "),
    drafter: record.drafter.join(", "),
    note: record.issues.length ? `검토 필요: ${record.issues.join(", ")}` : "",
    evidence: toEvidence(record),
  }));
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

function enrichLegacy(result: Result, query: string, department?: string): EnrichedResult {
  const records = fullMatches(result.task, department);
  const sameRole = (record: FullRecord) => {
    const approver = record.approver.join(",");
    const drafter = record.drafter.join(",");
    return compact(approver) === compact(result.approver) && compact(drafter) === compact(result.drafter);
  };
  const conditionNeedle = compact((result.condition || "").split("/")[0].replace(/^\s*[가-힣]\.\s*/, ""));
  const sameCondition = (record: FullRecord) => {
    if (!conditionNeedle) return false;
    const evidenceText = compact([record.task_raw, ...record.path.map((entry) => entry.text)].join(" "));
    return evidenceText.includes(conditionNeedle);
  };
  const ordered = [...records].sort((a, b) => {
    const priority = (record: FullRecord) => sameCondition(record) && sameRole(record) ? 0 : sameCondition(record) ? 1 : sameRole(record) ? 2 : 3;
    return priority(a) - priority(b);
  });
  const options = result.options.map((option) => {
    const label = compact(option.label);
    const candidate = records.find((record) => compact([record.task_raw, ...record.path.map((entry) => entry.text)].join(" ")).includes(label) && compact(record.approver.join(",")) === compact(option.approver));
    return candidate ? { ...option, evidence: toEvidence(candidate) } : option;
  });
  return {
    ...result,
    options,
    evidence: ordered.slice(0, 50).map(toEvidence),
    departments: [...new Set(ordered.map((record) => record.department_scope))],
    department,
  };
}

export async function lookup(query: string, department?: string): Promise<LookupResponse> {
  const q = (query ?? "").trim();
  if (!q) return { ok: false, error: "query가 필요합니다", status: 400 };

  const ck = keyOf(q, department);
  const cached = cache.get(ck);
  if (cached) return { ok: true, result: cached as EnrichedResult, source: "cache" };

  const local = resolveLocal(q, getIndex());
  if (local && (!department || local.branch === "금액")) {
    const result = enrichLegacy(local, q, department);
    cache.set(ck, result);
    return { ok: true, result, source: "local" };
  }
  const scopedResult = fullResult(q, fullMatches(q, department));
  cache.set(ck, scopedResult);
  return { ok: true, result: scopedResult, source: scopedResult.found ? "full" : "none" };
}
