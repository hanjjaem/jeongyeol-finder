import { describe, it, expect } from "vitest";
import { parseTable } from "../lib/table";
import { buildIndex, resolveLocal } from "../lib/resolve";

const index = buildIndex(parseTable());
const r = (q: string) => resolveLocal(q, index);

describe("resolveLocal — 로컬에서 즉시 처리(정확/명확한 경우)", () => {
  it("'예산의 변경' → 분기없이 국·소장", () => {
    const res = r("예산의 변경");
    expect(res?.found).toBe(true);
    expect(res?.needsChoice).toBe(false);
    expect(res?.approver).toBe("국·소장");
  });

  it("'병가' → 직급만 선택(공통 '1일 이상'·번호 제거)", () => {
    const res = r("병가");
    expect(res?.found).toBe(true);
    expect(res?.needsChoice).toBe(true);
    expect(res?.question).toBe("기안자의 직급을 알려주세요");
    const labels = res?.options.map((o) => o.label) ?? [];
    // 공통 '1일 이상'과 '(N)' 번호가 빠지고 직급만 남는다
    expect(labels.every((l) => !l.includes("1일"))).toBe(true);
    expect(labels.every((l) => !/\(\d+\)/.test(l))).toBe(true);
    expect(labels).toContain("6급 이하 직원");
  });

  it("'경미한 출장보고' → 경미 자동확정 → 실·단·과장", () => {
    const res = r("경미한 출장보고");
    expect(res?.found).toBe(true);
    expect(res?.needsChoice).toBe(false);
    expect(res?.approver).toBe("실·단·과장");
  });

  it("'1500만 공사' → 금액 구간 자동확정 → 실·단·과장", () => {
    const res = r("1500만 공사");
    expect(res?.found).toBe(true);
    expect(res?.needsChoice).toBe(false);
    expect(res?.approver).toBe("실·단·과장");
  });

  it("'동장 조퇴' → 직급 분기 자동확정 → 국·소장", () => {
    const res = r("동장 조퇴");
    expect(res?.found).toBe(true);
    expect(res?.needsChoice).toBe(false);
    expect(res?.approver).toBe("국·소장");
  });

  it("'표창 추천' → 분기(되물음)로 매칭", () => {
    const res = r("표창 추천");
    expect(res?.found).toBe(true);
  });
});

describe("resolveLocal — 모호/무관하면 null(→ LLM 폴백)", () => {
  it("'공사'만으로는 모호 → null", () => {
    expect(r("공사")).toBeNull();
  });
  it("관련 없는 질의 → null", () => {
    expect(r("점심 뭐 먹지")).toBeNull();
  });
});
