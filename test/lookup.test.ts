import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/llm", () => ({
  callLLM: vi.fn(
    async () =>
      '여기 결과입니다: {"found":true,"task":"예산의 변경","needsChoice":false,"question":"","options":[],"approver":"국·소장","drafter":"담당자","reason":"예산운영","note":""} 끝.'
  ),
}));

import { POST } from "../app/api/lookup/route";
import { extractJson } from "../lib/json";

function req(body: unknown) {
  return new Request("http://localhost/api/lookup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("extractJson", () => {
  it("앞뒤 텍스트가 있어도 JSON만 뽑는다", () => {
    const o = extractJson('머리말 {"approver":"국·소장"} 꼬리말') as { approver: string };
    expect(o.approver).toBe("국·소장");
  });
});

describe("POST /api/lookup", () => {
  beforeEach(() => vi.clearAllMocks());
  it("로컬에서 못 풀면 LLM 폴백으로 구조화 결과를 반환한다", async () => {
    const res = await POST(req({ query: "도무지모르겠는 xyz123 질의" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe("llm");
    expect(json.result.approver).toBe("국·소장");
  });
  it("정확히 일치하면 로컬에서 처리하고 LLM을 호출하지 않는다", async () => {
    const res = await POST(req({ query: "예산의 변경" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe("local");
    expect(json.result.approver).toBe("국·소장");
  });
  it("query가 없으면 400", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
