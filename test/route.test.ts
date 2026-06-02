import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/llm", () => ({
  callLLM: vi.fn(async () => "실·단·과장께 전결 받으시면 됩니다."),
}));

import { POST } from "../app/api/chat/route";

function req(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => vi.clearAllMocks());
  it("messages를 받아 reply를 반환한다", async () => {
    const res = await POST(req({ messages: [{ role: "user", content: "출장보고?" }] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toContain("실·단·과장");
  });
  it("messages가 없으면 400", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
