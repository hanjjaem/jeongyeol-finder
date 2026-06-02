"use client";
import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "안녕하세요. 어떤 업무의 전결권자를 찾으세요? (예: 출장보고, 3천만원 공사, 병가)" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json();
      const reply = json.reply ?? json.error ?? "오류가 발생했습니다.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "네트워크 오류. 다시 시도해 주세요." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: 16, minHeight: "90vh", display: "flex", flexDirection: "column" }}>
      <h1 style={{ fontSize: 20 }}>동구 전결 도우미</h1>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
            background: m.role === "user" ? "#2563eb" : "#fff", color: m.role === "user" ? "#fff" : "#1a1a1a",
            border: "1px solid #e5e7eb", borderRadius: 12, padding: "8px 12px", whiteSpace: "pre-wrap" }}>
            {m.content}
          </div>
        ))}
        {loading && <div style={{ color: "#888", fontSize: 13 }}>답변 작성 중…</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} placeholder="업무를 입력하세요"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }} />
        <button onClick={send} disabled={loading}
          style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", cursor: "pointer" }}>
          전송
        </button>
      </div>
    </main>
  );
}
