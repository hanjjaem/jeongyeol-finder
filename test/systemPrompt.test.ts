import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../lib/systemPrompt";

describe("buildSystemPrompt", () => {
  const sp = buildSystemPrompt("대분류번호|...표내용...");
  it("표 내용을 포함한다", () => {
    expect(sp).toContain("표내용");
  });
  it("JSON으로 답하라고 지시한다", () => {
    expect(sp).toContain("JSON");
    expect(sp).toContain("needsChoice");
  });
  it("근거 규칙(지어내지 않기)을 명시한다", () => {
    expect(sp).toContain("지어내지");
  });
  it("금액 구간 규칙을 명시한다", () => {
    expect(sp).toContain("금액하한");
  });
});
