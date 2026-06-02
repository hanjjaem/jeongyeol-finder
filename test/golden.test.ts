import { describe, it, expect } from "vitest";
import { callLLM } from "../lib/llm";
import { parseTable, buildTablePrompt } from "../lib/table";
import { buildSystemPrompt } from "../lib/systemPrompt";

const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
const sys = buildSystemPrompt(buildTablePrompt(parseTable()));

// 키가 없으면 라이브 호출 skip (CI/로컬 키 없을 때 통과)
describe.skipIf(!hasKey)("골든 회귀 (라이브 LLM)", () => {
  const cases: Array<[string, string]> = [
    ["출장 다녀와서 경미한 출장보고 올리는데 누구 전결이야?", "실·단·과장"],
    ["예산 변경 결재 누구한테 받아?", "국·소장"],
    ["3천만원짜리 공사 집행(추정금액) 전결권자?", "국·소장"],
  ];
  it.each(cases)("%s → %s", async (q, expected) => {
    const reply = await callLLM(sys, [{ role: "user", content: q }]);
    expect(reply).toContain(expected);
  }, 30000);
});
