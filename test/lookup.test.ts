import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/llm", () => ({
  callLLM: vi.fn(
    async () =>
      '여기 결과입니다: {"found":true,"task":"예산의 변경","needsChoice":false,"question":"","options":[],"approver":"국·소장","drafter":"담당자","reason":"예산운영","note":""} 끝.'
  ),
}));

import { lookup } from "../lib/lookup";

describe("lookup()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("로컬에서 못 풀고 키가 있으면 LLM 폴백으로 구조화 결과를 반환한다", async () => {
    const r = await lookup("도무지모르겠는 xyz123 질의", "sk-ant-test");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("llm");
      expect(r.result.approver).toBe("국·소장");
    }
  });

  it("로컬에서 못 풀고 키가 없으면 needsKey(401)", async () => {
    const r = await lookup("또다른 모르는 abc987 질의", "");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
      expect(r.needsKey).toBe(true);
    }
  });

  it("정확히 일치하면 로컬에서 처리하고 LLM을 호출하지 않는다", async () => {
    const r = await lookup("예산의 변경", "");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("local");
      expect(r.result.approver).toBe("국·소장");
    }
  });

  it("query가 없으면 400", async () => {
    const r = await lookup("", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});
