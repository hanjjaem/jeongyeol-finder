import { describe, expect, it } from "vitest";
import { lookup } from "../lib/lookup";
import { parseTable } from "../lib/table";

describe("lookup() — 전체 원문 후보와 근거", () => {
  it("부서를 지정하면 원문 행과 표시를 반환한다", async () => {
    const response = await lookup("예산의 변경", "공통사항");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.source).toBe("full");
      expect(response.result.fullSearch).toBe(true);
      expect(response.result.evidence?.[0]).toMatchObject({
        sourceSheet: "공통사항",
        sourceRow: 14,
        taskRaw: "5. 예산의 변경",
      });
      expect(response.result.evidence?.[0]?.approver).toEqual(["국∙소장"]);
    }
  });

  it("여러 원문 행은 임의로 합치지 않고 선택지로 남긴다", async () => {
    const response = await lookup("병가", "공통사항");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.needsChoice).toBe(true);
      expect(response.result.options.length).toBeGreaterThan(1);
      expect(response.result.options.every((option) => option.evidence?.sourceSheet === "공통사항")).toBe(true);
    }
  });

  it("기존 169건 결과에도 원문 근거를 붙인다", async () => {
    const response = await lookup("예산의 변경");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.source).toBe("local");
      expect(response.result.evidence?.map((evidence) => evidence.id)).toContain("공통사항:14");
    }
  });

  it("전체 검색은 부서 범위를 지킨다", async () => {
    const response = await lookup("자료 수집", "기획감사실");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.fullSearch).toBe(true);
      expect(response.result.evidence?.every((evidence) => evidence.sourceSheet === "기획감사실")).toBe(true);
    }
  });

  it("부서를 지정해도 금액 분기는 결정형 규칙을 적용한다", async () => {
    const response = await lookup("5628만원 행사 용역", "건설과");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.source).toBe("local");
      expect(response.result.approver).toBe("부구청장");
    }
  });

  it.each([
    ["3천1백만원 행사 용역", "국·소장", 27],
    ["5628만원 행사 용역", "부구청장", 26],
  ])("금액 결과 '%s'에 정확한 세부 원문 행을 연결한다", async (query, approver, sourceRow) => {
    const response = await lookup(query);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.approver).toBe(approver);
      expect(response.result.evidence?.[0]?.sourceRow).toBe(sourceRow);
    }
  });
});

describe("lookup() — 원문에 없는 말 표시", () => {
  it("일부 단어만 맞으면 원문에 없는 말을 알려준다", async () => {
    const response = await lookup("5천만원 이하 용역 제안서 평가 심의 결과 보고");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.approver).toBe("국·소장");
      expect(response.result.unmatched).toEqual(["제안서", "평가", "심의", "결과", "보고"]);
    }
  });

  it.each(["병가", "예산의 변경", "4천만원 용역"])("'%s'처럼 원문과 맞는 질문에는 표시하지 않는다", async (query) => {
    const response = await lookup(query);
    expect(response.ok).toBe(true);
    if (response.ok) expect(response.result.unmatched).toBeUndefined();
  });

  it("찾지 못한 질문에는 표시하지 않는다", async () => {
    const response = await lookup("도무지모르겠는 xyz123 질의");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.found).toBe(false);
      expect(response.result.unmatched).toBeUndefined();
    }
  });
});

describe("lookup() — 원문 후보 정리", () => {
  it("여러 검색키에 걸리면 공통사항 검색키를 먼저 묻고 다른 부서 원문을 붙인다", async () => {
    const response = await lookup("출장");
    expect(response.ok).toBe(true);
    if (response.ok) {
      const options = response.result.options;
      expect(options.slice(0, 3).map((option) => option.query)).toEqual(["관내출장", "관외출장", "출장보고"]);
      expect(options.slice(3).every((option) => option.evidence?.sourceSheet !== "공통사항")).toBe(true);
      expect(options.slice(3).some((option) => option.evidence?.sourceSheet === "보건행정과")).toBe(true);
    }
  });

  it("결재 표시 없는 제목 행은 빼고, 선택지에 바로 위 제목을 붙인다", async () => {
    const response = await lookup("휴가 출장");
    expect(response.ok).toBe(true);
    if (response.ok) {
      const options = response.result.options;
      expect(options.every((option) => option.approver)).toBe(true);
      expect(options.map((option) => option.label)).toContain("공통사항 · 가. 1일 이상 휴가(연가, 병가, 공가, 특별휴가 등), 관외출장 › (1) 국장, 보건소장");
      expect(options[0].reason).toContain("가. 1일 이상 휴가");
    }
  });

  it("최상위 제목에만 걸린 행은 후보에서 뺀다", async () => {
    const response = await lookup("휴가 출장");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.options.some((option) => option.label.includes("시간외 및 공휴일"))).toBe(false);
    }
  });
});

describe("lookup() — 169행 결과의 원문행 연결", () => {
  it("외출은 1일 미만(나목) 원문 행에 연결된다", async () => {
    const response = await lookup("외출");
    expect(response.ok).toBe(true);
    if (response.ok) expect(response.result.options.map((option) => option.evidence?.id)).toEqual(["공통사항:62", "공통사항:63", "공통사항:64", "공통사항:65", "공통사항:66"]);
  });

  it("관내출장은 다른 부서가 아니라 공통사항 나목을 준용한 해석으로 표시한다", async () => {
    const response = await lookup("관내출장");
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.evidence?.every((evidence) => evidence.sourceSheet === "공통사항")).toBe(true);
      expect(response.result.options.every((option) => option.basis === "해석")).toBe(true);
    }
  });

  it("169행 검색키의 모든 결과에 공통사항 원문 행이 붙는다", async () => {
    const keys = [...new Set(parseTable().map((row) => row["검색키"]))];
    const missing: string[] = [];
    for (const key of keys) {
      const response = await lookup(key);
      if (!response.ok || !response.result.found) { missing.push(key); continue; }
      const evidences = response.result.options.length ? response.result.options.map((option) => option.evidence) : [response.result.evidence?.[0]];
      if (evidences.some((evidence) => evidence?.sourceSheet !== "공통사항")) missing.push(key);
    }
    expect(missing).toEqual([]);
  });
});
