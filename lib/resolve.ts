import type { Row } from "./table";

export type Option = { label: string; approver: string; drafter: string; note: string };
export type Result = {
  found: boolean;
  task: string;
  needsChoice: boolean;
  question: string;
  options: Option[];
  approver: string;
  drafter: string;
  reason: string;
  note: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[\s·,()>＞"'`\-–—.·]/g, "");

type Item = { num: string; key: string; cat: string; tokens: string[]; rows: Row[] };
export type Index = { items: Item[] };

export function buildIndex(rows: Row[]): Index {
  const map = new Map<string, Item>();
  for (const r of rows) {
    const id = r["대분류번호"] + "|" + r["검색키"];
    let it = map.get(id);
    if (!it) {
      it = { num: r["대분류번호"], key: r["검색키"], cat: r["대분류명"], tokens: [], rows: [] };
      map.set(id, it);
    }
    it.rows.push(r);
  }
  for (const it of map.values()) {
    const set = new Set<string>();
    for (const t of it.key.split(/\s+/)) if (t.length >= 2) set.add(norm(t));
    for (const r of it.rows)
      for (const t of (r["검색키워드"] || "").split(/\s+/)) if (t.length >= 2) set.add(norm(t));
    it.tokens = [...set].filter(Boolean);
  }
  return { items: [...map.values()] };
}

function questionFor(branch: string): string {
  if (branch === "금액") return "해당 금액 구간을 선택하세요";
  if (branch === "중요도") return "사안의 중요도를 선택하세요";
  if (branch === "부서수") return "관련 부서 수를 선택하세요";
  if (branch === "조건") return "해당하는 경우를 선택하세요";
  if (branch === "직급") return "직급(대상)을 선택하세요";
  return "기간·직급을 선택하세요"; // 기간+직급
}

function direct(it: Item, r: Row): Result {
  return {
    found: true,
    task: it.key,
    needsChoice: false,
    question: "",
    options: [],
    approver: r["전결권자"],
    drafter: r["기안권자"],
    reason: `${it.cat} · ${it.key}`,
    note: r["비고"] || "",
  };
}

function buildResult(it: Item, query: string): Result {
  if (it.rows.length === 1) return direct(it, it.rows[0]);

  const branch = it.rows[0]["분기기준"];
  const nq = norm(query);

  // 중요도 분기는 질의에 '경미'/'중요'가 있으면 바로 확정
  if (branch === "중요도") {
    if (nq.includes("경미")) {
      const r = it.rows.find((x) => (x["분기조건"] || "").includes("경미"));
      if (r) return direct(it, r);
    }
    if (nq.includes("중요")) {
      const r = it.rows.find((x) => (x["분기조건"] || "").includes("중요"));
      if (r) return direct(it, r);
    }
  }

  if (branch.includes("직급")) {
    const mentionedRanks = ["보건소장", "국장", "실장", "단장", "과장", "동장", "팀장", "6급"];
    for (const rank of mentionedRanks) {
      if (!nq.includes(norm(rank))) continue;
      const rows = it.rows.filter((x) => norm(x["분기조건"] || "").includes(norm(rank)));
      const approvers = new Set(rows.map((x) => x["전결권자"]));
      if (rows.length === 1 || approvers.size === 1) return direct(it, rows[0]);
    }
  }

  const options = cleanOptions(it.rows);
  // 기간이 공통이라 라벨에서 빠졌으면 '직급'만 묻는다.
  let question = questionFor(branch);
  if (branch === "기간+직급") {
    question = options.some((o) => /\d\s*일/.test(o.label))
      ? "기간·직급을 알려주세요"
      : "기안자의 직급을 알려주세요";
  }

  return {
    found: true,
    task: it.key,
    needsChoice: true,
    question,
    options,
    approver: "",
    drafter: "",
    reason: `${it.cat} · ${it.key}`,
    note: "",
  };
}

function parseAmount(query: string): number | null {
  const compact = query.replace(/\s+/g, "");
  let amount = 0;
  let matched = false;

  for (const m of compact.matchAll(/(\d+(?:\.\d+)?)억/g)) {
    amount += Number(m[1]) * 100_000_000;
    matched = true;
  }
  for (const m of compact.matchAll(/(\d+(?:\.\d+)?)천만(?:원)?/g)) {
    amount += Number(m[1]) * 10_000_000;
    matched = true;
  }
  for (const m of compact.matchAll(/(\d+(?:\.\d+)?)만(?:원)?/g)) {
    if (m[0].includes("천만")) continue;
    amount += Number(m[1]) * 10_000;
    matched = true;
  }

  if (matched) return amount;
  const plain = compact.match(/(\d{5,})원?/);
  return plain ? Number(plain[1]) : null;
}

function inAmountRange(r: Row, amount: number): boolean {
  const lowerText = r["금액하한"];
  const upperText = r["금액상한"];
  const lower = lowerText ? Number(lowerText) : Number.NEGATIVE_INFINITY;
  const upper = upperText ? Number(upperText) : Number.POSITIVE_INFINITY;
  const passesLower = lower > 0 ? amount > lower : amount >= lower;
  return passesLower && amount <= upper;
}

function resolveAmount(query: string, index: Index): Result | null {
  const amount = parseAmount(query);
  if (amount === null) return null;

  const nq = norm(query);
  const matches: Array<{ item: Item; row: Row; score: number }> = [];
  for (const item of index.items) {
    if (item.rows[0]?.["분기기준"] !== "금액") continue;
    const itemScore = score(item, nq);
    if (itemScore <= 0) continue;
    for (const row of item.rows) {
      if (inAmountRange(row, amount)) matches.push({ item, row, score: itemScore });
    }
  }
  if (matches.length === 0) return null;

  const approvers = new Set(matches.map((m) => m.row["전결권자"]));
  if (approvers.size === 1) {
    matches.sort((a, b) => b.score - a.score);
    return direct(matches[0].item, matches[0].row);
  }

  matches.sort((a, b) => b.score - a.score);
  if (matches[0].score - matches[1].score >= 80) return direct(matches[0].item, matches[0].row);
  return null;
}

// 분기조건에서 모든 옵션에 공통인 부분(예: "1일 이상")과 번호 "(N)"를 제거해
// 실제로 갈리는 부분만 라벨로 남긴다.
function cleanOptions(rows: Row[]): Option[] {
  const SEP = /\s+[·/]\s+/;
  const partsList = rows.map((r) => (r["분기조건"] || "").split(SEP).map((s) => s.trim()));
  const len = partsList[0]?.length ?? 0;
  const uniform = len > 1 && partsList.every((p) => p.length === len);

  let keep: number[] = [];
  if (uniform) {
    for (let i = 0; i < len; i++) {
      const common = partsList.every((p) => p[i] === partsList[0][i]);
      if (!common) keep.push(i);
    }
    if (keep.length === 0) keep = [len - 1];
  }

  return rows.map((r, ri) => {
    const parts = partsList[ri];
    const picked = uniform ? keep.map((i) => parts[i]) : parts;
    const label = picked.join(" · ").replace(/\(\d+\)\s*/g, "").trim();
    return { label, approver: r["전결권자"], drafter: r["기안권자"], note: r["비고"] || "" };
  });
}

function score(it: Item, nq: string): number {
  const nkey = norm(it.key);
  if (nq === nkey) return 1000;
  let s = 0;
  if (nkey.length >= 2 && nq.includes(nkey)) s += 120;
  if (nkey.length >= 3 && (nq.includes(nkey) || nkey.includes(nq))) s += 200;
  for (const t of it.tokens) if (nq.includes(t)) s += t.length >= 3 ? 3 : 1;
  return s;
}

// 확실할 때만 결과 반환, 모호하면 null(→ LLM 폴백).
export function resolveLocal(query: string, index: Index): Result | null {
  const nq = norm(query);
  if (nq.length < 1) return null;
  const amountResult = resolveAmount(query, index);
  if (amountResult) return amountResult;

  let best: Item | null = null;
  let bestScore = 0;
  let second = 0;
  for (const it of index.items) {
    const s = score(it, nq);
    if (s > bestScore) {
      second = bestScore;
      bestScore = s;
      best = it;
    } else if (s > second) second = s;
  }
  if (!best) return null;
  const margin = bestScore - second;
  const exact = bestScore >= 1000;
  const strongUnique = bestScore >= 200 && margin >= 80; // 검색키 부분일치 + 비모호
  const keywordUnique = bestScore >= 8 && margin >= 6; // 키워드 강하게 일치 + 비모호
  if (exact || strongUnique || keywordUnique) return buildResult(best, query);
  return null;
}
