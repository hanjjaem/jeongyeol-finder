"use client";
import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "경미한 출장보고는 누구 전결?",
  "3천만원짜리 공사 집행 전결권자는?",
  "병가 1일 쓰는데 누구한테 받아?",
  "예산 변경 결재 누구한테?",
];

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "안녕하세요. 어떤 업무의 전결권자를 찾으세요? 아래 예시를 눌러보거나 직접 입력하세요." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
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
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>동구 전결 도우미</h1>
      <p style={{ margin: "0 0 8px", color: "#555", fontSize: 14 }}>
        위임전결규정을 바탕으로 <b>“내가 이 업무를 할 때 누구에게 전결(결재)받는지”</b>를 안내합니다.
      </p>

      <details style={{ marginBottom: 10, fontSize: 13, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }}>
        <summary style={{ cursor: "pointer", color: "#2563eb" }}>사용법 · 안내 보기</summary>
        <div style={{ marginTop: 8, color: "#444", lineHeight: 1.6 }}>
          <p style={{ margin: "4px 0" }}><b>무엇을 묻나요?</b> 처리하려는 업무를 자연스럽게 입력하세요(예: 휴가, 출장보고, 공사 집행, 예산 변경, 표창 추천).</p>
          <p style={{ margin: "4px 0" }}><b>되물을 수 있어요.</b> 금액·직급·중요도에 따라 전결권자가 갈리는 업무는 “금액이 얼마인가요?”처럼 한 번 더 물을 수 있습니다.</p>
          <p style={{ margin: "4px 0" }}><b>데이터 범위.</b> 동구 위임전결규정 169개 항목 기반입니다. 규정에 없는 사항은 “원문 미규정”으로 안내합니다.</p>
          <p style={{ margin: "4px 0", color: "#b45309" }}><b>주의.</b> 참고용 안내입니다. 최종 확인은 원규정·담당부서에 하세요.</p>
        </div>
      </details>

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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => send(ex)} disabled={loading}
            style={{ fontSize: 12, color: "#2563eb", background: "#eef2ff", border: "1px solid #c7d2fe",
              borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} placeholder="업무를 입력하세요"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }} />
        <button onClick={() => send()} disabled={loading}
          style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", cursor: "pointer" }}>
          전송
        </button>
      </div>
    </main>
  );
}
