import { describe, it, expect } from "vitest";
import { buildAnthropicParams, buildOpenAIParams, type ChatMessage } from "../lib/llm";

const msgs: ChatMessage[] = [{ role: "user", content: "출장보고 누구 전결?" }];

describe("buildAnthropicParams", () => {
  const p = buildAnthropicParams("SYS", msgs, "claude-sonnet-4-6");
  it("system을 캐시 블록으로 넣는다", () => {
    expect(p.system?.[0]).toMatchObject({
      type: "text", text: "SYS", cache_control: { type: "ephemeral" },
    });
  });
  it("messages를 그대로 전달한다", () => {
    expect(p.messages[0]).toEqual({ role: "user", content: "출장보고 누구 전결?" });
  });
});

describe("buildOpenAIParams", () => {
  const p = buildOpenAIParams("SYS", msgs, "gpt-4o");
  it("system을 첫 메시지로 넣는다", () => {
    expect(p.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(p.messages[1]).toEqual({ role: "user", content: "출장보고 누구 전결?" });
  });
});
