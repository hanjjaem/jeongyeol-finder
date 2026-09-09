import { describe, it, expect } from "vitest";
import { lookup } from "../lib/lookup";

describe("lookup() — 결정형 로컬 검색", () => {
  it("정확히 일치하면 로컬 결과를 반환한다", async () => {
    const r = await lookup("예산의 변경");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("local");
      expect(r.result.approver).toBe("국·소장");
    }
  });

  it("찾지 못한 질문은 LLM 호출 없이 미등록 결과를 반환한다", async () => {
    const r = await lookup("도무지모르겠는 xyz123 질의");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("none");
      expect(r.result.found).toBe(false);
      expect(r.result.task).toBe("도무지모르겠는 xyz123 질의");
    }
  });

  it("반복 질의는 로컬 캐시 결과를 반환한다", async () => {
    await lookup("예산의 변경");
    const r = await lookup("예산의 변경");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("cache");
  });

  it("query가 없으면 400", async () => {
    const r = await lookup("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});
