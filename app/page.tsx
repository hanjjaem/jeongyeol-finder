"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "경미한 출장보고는 누구 전결?",
  "3천만원짜리 공사 집행 전결권자는?",
  "병가 1일 쓰는데 누구한테 받아?",
  "예산 변경 결재 누구한테?",
];

function renderRich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "안녕하세요. 어떤 업무의 전결권자를 찾으세요? 아래 예시를 눌러보거나 직접 입력하세요." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const t = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    setTheme(t);
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch {}
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark">전</div>
          <div>
            <div className="brand__title">동구 전결 도우미</div>
            <div className="brand__sub">위임전결규정 안내</div>
          </div>
        </div>
        <button className="theme-btn" onClick={toggleTheme} aria-label="테마 전환">
          {mounted && (theme === "dark" ? <MoonIcon /> : <SunIcon />)}
        </button>
      </header>

      <p className="lead">
        이 업무, <b>누구에게 전결받지?</b>
        <br />
        <span className="lead__hint">위임전결규정을 바탕으로 결재 받을 사람을 알려드려요.</span>
      </p>

      <details className="guide">
        <summary>사용법 · 안내</summary>
        <div className="guide__body">
          <p><b>무엇을 묻나요?</b> 처리하려는 업무를 자연스럽게 입력하세요(예: 휴가, 출장보고, 공사 집행, 예산 변경, 표창 추천).</p>
          <p><b>되물을 수 있어요.</b> 금액·직급·중요도에 따라 갈리는 업무는 “금액이 얼마인가요?”처럼 한 번 더 물을 수 있습니다.</p>
          <p><b>데이터 범위.</b> 동구 위임전결규정 169개 항목 기반. 규정에 없으면 “원문 미규정”으로 안내합니다.</p>
          <p className="warn"><b>주의.</b> 참고용 안내입니다. 최종 확인은 원규정·담당부서에 하세요.</p>
        </div>
      </details>

      <div className="thread" ref={threadRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "msg msg--user" : "msg msg--bot"}>
            {m.role === "assistant" ? renderRich(m.content) : m.content}
          </div>
        ))}
        {loading && (
          <div className="typing" aria-label="답변 작성 중">
            <i /><i /><i />
          </div>
        )}
      </div>

      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => send(ex)} disabled={loading}>
            {ex}
          </button>
        ))}
      </div>

      <div className="composer">
        <input
          className="field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="업무를 입력하세요"
        />
        <button className="send" onClick={() => send()} disabled={loading}>전송</button>
      </div>

      <p className="foot">위임전결규정 기반 참고용입니다. 최종 확인은 원규정/담당부서.</p>
    </main>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
