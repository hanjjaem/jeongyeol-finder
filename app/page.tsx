"use client";
import { useState } from "react";

type Option = { label: string; approver: string; note?: string };
type Result = {
  found: boolean;
  task?: string;
  needsChoice?: boolean;
  question?: string;
  options?: Option[];
  approver?: string;
  drafter?: string;
  reason?: string;
  note?: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  async function search() {
    const text = query.trim();
    if (!text || loading) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    setChosen(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const json = await res.json();
      if (json.result) setResult(json.result as Result);
      else setError(json.error ?? "결과를 가져오지 못했습니다.");
    } catch {
      setError("네트워크 오류. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const opts = result?.options ?? [];
  const showResult =
    result?.found && (!result.needsChoice || chosen !== null);
  const approver = chosen !== null ? opts[chosen]?.approver : result?.approver;
  const noteText = chosen !== null ? opts[chosen]?.note : result?.note;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="brand-mark">결</div>
          <span>결재자를 단순하게</span>
        </div>
      </header>

      <main className="main">
        <h1>
          이 업무,
          <br />
          <span>누구 결재?</span>
        </h1>
        <p className="sub">
          처리할 업무를 입력하면, 위임전결규정 기준으로
          <br />
          결재(전결)받을 사람을 알려드려요.
        </p>

        <div className="search-card">
          <div className="search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="예: 경미한 출장보고, 3천만원 공사, 병가"
              aria-label="업무 입력"
            />
            <button onClick={search} disabled={loading}>
              {loading ? "검색 중…" : "검색"}
            </button>
          </div>
        </div>
      </main>

      <p className="foot">위임전결규정 기반 참고용입니다. 최종 확인은 원규정/담당부서.</p>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{result?.task || query}</div>
              <button className="close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
            </div>
            <div className="modal-body">
              {loading && <div className="no-result">결재자를 찾는 중…</div>}

              {!loading && error && <div className="no-result">{error}</div>}

              {!loading && !error && result && !result.found && (
                <div className="no-result">
                  위임전결규정 표에서 해당 업무를 찾지 못했습니다.
                  다른 표현으로 검색하거나 담당부서에 확인해 주세요.
                </div>
              )}

              {!loading && !error && result?.found && result.needsChoice && chosen === null && (
                <div className="ask">
                  <h3>{result.question || "조건을 선택하세요"}</h3>
                  <div className="choices">
                    {opts.map((o, i) => (
                      <button className="choice" key={i} onClick={() => setChosen(i)}>
                        <span className="choice__label">{o.label}</span>
                        <span className="choice__approver">{o.approver}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!loading && !error && showResult && (
                <div className="result-card">
                  <div className="result-hero">
                    <div className="result-icon"><SealIcon /></div>
                    <div className="result-copy">
                      <div className="result-kicker">전결권자</div>
                      <div className="result-label">{approver || "—"}</div>
                      <div className="result-action">{approver}께 결재 받으세요</div>
                    </div>
                  </div>

                  {result.drafter && (
                    <div className="item-block">
                      <span>기안(상신)</span>
                      <strong>{result.drafter}</strong>
                    </div>
                  )}

                  {result.reason && (
                    <div className="section">
                      <h3>근거</h3>
                      <div className="reason">{result.reason}</div>
                    </div>
                  )}

                  {noteText && (
                    <div className="section">
                      <h3>참고</h3>
                      <div className="reason">{noteText}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="secondary" onClick={() => setOpen(false)}>닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SealIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 1.8 3-.2 1 2.8 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8L3.2 16l.9-2.9-.9-2.9 2.4-1.8 1-2.8 3 .2z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
