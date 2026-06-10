import { describe, it, expect } from "vitest";
import {
  buildAnthropicParams,
  toGeminiContents,
  providerForKey,
  type ChatMessage,
} from "../lib/llm";

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

describe("providerForKey", () => {
  it("키 접두로 제공자를 판별하고, 그 외는 unsupported", () => {
    expect(providerForKey("sk-ant-abc")).toBe("anthropic");
    expect(providerForKey("AIzaSyAbc")).toBe("gemini");
    expect(providerForKey("sk-proj-xyz")).toBe("unsupported");
  });
});

describe("toGeminiContents", () => {
  it("assistant는 model로, user는 user로 매핑하고 parts에 텍스트를 담는다", () => {
    const c = toGeminiContents([
      { role: "user", content: "안녕" },
      { role: "assistant", content: "응" },
    ]);
    expect(c[0]).toEqual({ role: "user", parts: [{ text: "안녕" }] });
    expect(c[1]).toEqual({ role: "model", parts: [{ text: "응" }] });
  });
});
