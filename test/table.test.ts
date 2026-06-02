import { describe, it, expect } from "vitest";
import { parseTable, buildTablePrompt } from "../lib/table";

describe("parseTable", () => {
  it("169개 행을 파싱한다", () => {
    const rows = parseTable();
    expect(rows.length).toBe(169);
  });
  it("각 행에 핵심 컬럼이 있다", () => {
    const r = parseTable()[0];
    expect(r).toHaveProperty("검색키");
    expect(r).toHaveProperty("분기기준");
    expect(r).toHaveProperty("전결권자");
  });
  it("예산의 변경은 국·소장 전결", () => {
    const rows = parseTable();
    const hit = rows.find((r) => r["검색키"] === "예산의 변경");
    expect(hit?.["전결권자"]).toBe("국·소장");
  });
});

describe("buildTablePrompt", () => {
  it("전결권자 값을 포함한 텍스트를 만든다", () => {
    const text = buildTablePrompt(parseTable());
    expect(text).toContain("국·소장");
    expect(text).toContain("관내출장");
  });
});
