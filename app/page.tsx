"use client";
import { useState, useEffect } from "react";

type Option = { label: string; approver: string; drafter?: string; note?: string };

const RANKS = ["담당자", "팀장", "실·단·과장", "국·소장", "부구청장", "구청장"];
function rankMark(rank: string, drafter?: string, approver?: string) {
  const drafters = (drafter ?? "").split(",").map((s) => s.trim());
  return `${drafters.includes(rank) ? "★" : ""}${approver === rank ? "●" : ""}`;
}
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

const EXAMPLES = ["병가", "경미한 출장보고", "예산의 변경", "관내출장"];
// 못 찾았을 때 제시할 '표에 실제로 있는' 항목(로컬로 풀려 키 없이 즉시 동작)
const SUGGESTIONS = ["병가", "연가", "시간외근무", "예산의 변경", "관내출장"];
// BYOK 지원 제공자 (키 입력 모달에서 안내) + 키 발급 페이지
const PROVIDERS = [
  {
    src: "/logos/claude.svg",
    label: "Claude",
    hint: "sk-ant-…",
    url: "https://console.anthropic.com/settings/keys",
  },
  {
    src: "/logos/openai.svg",
    label: "OpenAI",
    hint: "sk-…",
    url: "https://platform.openai.com/api-keys",
  },
  {
    src: "/logos/gemini.svg",
    label: "Gemini",
    hint: "AIza…",
    url: "https://aistudio.google.com/apikey",
  },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needKey, setNeedKey] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");

  useEffect(() => {
    setApiKey(localStorage.getItem("llmKey") ?? "");
  }, []);

  function saveKey(k: string) {
    const v = k.trim();
    setApiKey(v);
    if (v) localStorage.setItem("llmKey", v);
    else localStorage.removeItem("llmKey");
  }

  async function search(q?: string, keyOverride?: string) {
    const text = (q ?? query).trim();
    if (!text || loading) return;
    if (q) setQuery(q);
    const useKey = (keyOverride ?? apiKey).trim();
    setOpen(true);
    setLoading(true);
    setError(null);
    setNeedKey(false);
    setResult(null);
    setChosen(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(useKey ? { "x-llm-key": useKey } : {}),
        },
        body: JSON.stringify({ query: text }),
      });
      const json = await res.json();
      if (res.status === 401 || json.needsKey) {
        setNeedKey(true);
        setError(json.error ?? "API 키가 필요합니다.");
      } else if (json.result) setResult(json.result as Result);
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
  const drafter = chosen !== null ? opts[chosen]?.drafter : result?.drafter;
  const unit = (result?.reason ?? "").split(" · ")[0] ?? "";
  const detail = result?.task ?? "";

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="brand-mark">결</div>
          <span>결재자를 단순하게</span>
        </div>
        <button
          onClick={() => setKeyOpen(true)}
          title="API 키 설정"
          style={{
            marginLeft: "auto",
            border: apiKey ? "1px solid rgba(37,99,235,.35)" : "1px solid rgba(17,24,39,.12)",
            background: apiKey ? "rgba(37,99,235,.08)" : "#fff",
            color: apiKey ? "#2563eb" : "#475569",
            borderRadius: 10,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          🔑 {apiKey ? "키 설정됨" : "API 키"}
        </button>
      </header>

      <main className="main">
        <h1 className="hero-title">
          <span>누가 결재?</span>
        </h1>
        <p className="sub">
          처리할 업무를 입력하면, 위임전결규정 기준으로
          <br />
          결재(전결)받을 사람을 알려드려요.
        </p>

        <div className="search-card">
          <input
            className={query ? undefined : "is-empty"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="예: 경미한 출장보고, 3천만원 공사"
            aria-label="업무 입력"
          />
          {!query && <span className="caret" aria-hidden />}
          <button className="go" onClick={() => search()} disabled={loading} aria-label="검색">
            <SearchIcon />
            <span className="go__label">{loading ? "검색 중…" : "검색"}</span>
          </button>
        </div>

        <div className="examples">
          {EXAMPLES.map((ex) => (
            <button className="ex" key={ex} onClick={() => search(ex)} disabled={loading}>
              {ex}
            </button>
          ))}
        </div>
      </main>

      <p className="foot">위임전결규정 기반 참고용입니다. 최종 확인은 원규정/담당부서.</p>

      {keyOpen && (
        <div className="modal-backdrop" onClick={() => setKeyOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-head">
              <div className="modal-title">API 키 입력 (BYOK)</div>
              <button className="close" onClick={() => setKeyOpen(false)} aria-label="닫기">×</button>
            </div>
            <div className="modal-body" style={{ textAlign: "left" }}>
              <div
                style={{
                  fontSize: 14,
                  color: "#475569",
                  lineHeight: 1.7,
                  margin: "4px 0 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span>
                  표에 없는 <b>모호한&nbsp;질문</b>만 LLM이 답하며, 이때 <b>본인&nbsp;API&nbsp;키</b>로
                  호출돼요.
                </span>
                <span>요금도 본인&nbsp;키로 청구됩니다.</span>
              </div>

              <div
                style={{
                  border: "1px solid rgba(17,24,39,.08)",
                  borderRadius: 14,
                  overflow: "hidden",
                  marginBottom: 16,
                }}
              >
                {PROVIDERS.map((p, i) => (
                  <div
                    key={p.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 14px",
                      borderTop: i === 0 ? undefined : "1px solid rgba(17,24,39,.06)",
                      background: "rgba(255,255,255,.45)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt={p.label} width={18} height={18} style={{ flex: "0 0 auto" }} />
                    <span style={{ fontSize: 13.5, fontWeight: 750, color: "#334155" }}>
                      {p.label}
                    </span>
                    <code
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#64748b",
                        background: "rgba(17,24,39,.05)",
                        padding: "3px 9px",
                        borderRadius: 7,
                      }}
                    >
                      {p.hint}
                    </code>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        fontWeight: 750,
                        color: "#2563eb",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      키 받기 ↗
                    </a>
                  </div>
                ))}
              </div>

              <input
                id="apikey-input"
                type="password"
                defaultValue={apiKey}
                placeholder="키 붙여넣기 (sk-ant-… / sk-… / AIza…)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveKey((e.target as HTMLInputElement).value);
                    setKeyOpen(false);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(17,24,39,.15)",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  outline: "none",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  margin: "10px 2px 0",
                  fontSize: 12,
                  color: "#94a3b8",
                  letterSpacing: "-.01em",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  style={{ flex: "0 0 auto" }}
                >
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                키는 이 브라우저에만 저장돼요. 서버에 저장·로깅하지 않습니다.
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => {
                    const el = document.getElementById("apikey-input") as HTMLInputElement | null;
                    saveKey(el?.value ?? "");
                    setKeyOpen(false);
                  }}
                  style={{
                    flex: 1,
                    border: 0,
                    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                    color: "#fff",
                    borderRadius: 12,
                    padding: "12px",
                    fontSize: 14,
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  저장
                </button>
                {apiKey && (
                  <button
                    onClick={() => {
                      saveKey("");
                      setKeyOpen(false);
                    }}
                    style={{
                      border: "1px solid rgba(17,24,39,.15)",
                      background: "#fff",
                      color: "#64748b",
                      borderRadius: 12,
                      padding: "12px 16px",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{result?.task || query}</div>
              <button className="close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
            </div>
            <div className="modal-body">
              {loading && <div className="no-result">결재자를 찾는 중…</div>}

              {!loading && error && (
                <div className="no-result">
                  {error}
                  {needKey && (
                    <div
                      style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      <input
                        type="password"
                        value={keyDraft}
                        onChange={(e) => setKeyDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && keyDraft.trim()) {
                            saveKey(keyDraft);
                            search(undefined, keyDraft);
                          }
                        }}
                        placeholder="sk-ant-… (Claude) / sk-… (OpenAI) / AIza… (Gemini)"
                        autoFocus
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid rgba(17,24,39,.15)",
                          fontSize: 14,
                          fontWeight: 600,
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => {
                          if (keyDraft.trim()) {
                            saveKey(keyDraft);
                            search(undefined, keyDraft);
                          }
                        }}
                        disabled={!keyDraft.trim()}
                        style={{
                          border: 0,
                          background: keyDraft.trim()
                            ? "linear-gradient(135deg,#2563eb,#7c3aed)"
                            : "#cbd5e1",
                          color: "#fff",
                          borderRadius: 12,
                          padding: "12px 18px",
                          fontSize: 14,
                          fontWeight: 850,
                          cursor: keyDraft.trim() ? "pointer" : "default",
                          boxShadow: "0 10px 22px rgba(89,87,255,.24)",
                        }}
                      >
                        🔑 저장하고 다시 검색
                      </button>
                      <span style={{ fontSize: 11.5, color: "#9aa6b6", letterSpacing: "-.01em" }}>
                        키는 이 브라우저에만 저장돼요(서버 저장 안 함). Claude · OpenAI · Gemini 지원.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!loading && !error && result && !result.found && (
                <div className="no-result">
                  <div style={{ fontSize: 16, fontWeight: 850, color: "#334155", marginBottom: 8 }}>
                    「{result?.task || query}」은(는) 위임전결규정 별표2에 없는 항목이에요.
                  </div>
                  <div style={{ fontSize: 14, color: "#7b8798", lineHeight: 1.75, marginBottom: 18 }}>
                    이 도구는 <b>별표2에 실린 업무</b>의 전결권자만 알려드려요. 표에 없는 사항은
                    별도 규정·지침이나 담당부서 소관일 수 있어요. (표현을 바꿔 다시 검색해도 좋아요.)
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", marginBottom: 10 }}>
                    이런 업무는 바로 검색돼요 ↓
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                    {SUGGESTIONS.map((ex) => (
                      <button className="ex" key={ex} onClick={() => search(ex)} disabled={loading}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!loading && !error && result?.found && result.needsChoice && chosen === null && (
                <div className="ask">
                  <h3>{result.question || "조건을 선택하세요"}</h3>
                  <div className="choices">
                    {opts.map((o, i) => (
                      <button className="choice" key={i} onClick={() => setChosen(i)}>
                        <span className="choice__label">{o.label}</span>
                        <span className="choice__arrow" aria-hidden>›</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!loading && !error && showResult && (
                <>
                  <div className="result-group">
                    {drafter && (
                      <div className="rbox">
                        <span className="rbox__tab rbox__tab--draft">기안</span>
                        <span className="rbox__v">{drafter}</span>
                      </div>
                    )}
                    <div className="rbox rbox--answer">
                      <span className="rbox__tab rbox__tab--answer">전결권자</span>
                      <span className="rbox__v">{approver || "—"}</span>
                    </div>
                    {result.reason && (
                      <div className="rbox">
                        <span className="rbox__tab rbox__tab--reason">근거</span>
                        <span className="rbox__v">{result.reason}</span>
                      </div>
                    )}
                    {noteText && (
                      <div className="rbox">
                        <span className="rbox__tab rbox__tab--note">참고</span>
                        <span className="rbox__v">{noteText}</span>
                      </div>
                    )}
                  </div>

                  <div className="wonmun">
                    <div className="wonmun__divider">사무전결사항 [별표 2]</div>
                    <div className="xl">
                      <div className="xl__bar">
                        <span className="xl__glyph">▦</span>
                        <span className="xl__file">(별표 2) 사무전결사항(제4조관련).xlsx</span>
                      </div>
                      <div className="xl__sheet">
                        <table className="xl__table">
                          <thead>
                            <tr className="xl__letters">
                              <th className="xl__corner" />
                              {["A", "B", "C", "D", "E", "F", "G", "H"].map((c) => <th key={c}>{c}</th>)}
                            </tr>
                            <tr>
                              <th className="xl__rownum">1</th>
                              <th rowSpan={2} className="xl__h">단위사무</th>
                              <th rowSpan={2} className="xl__h">세부사무</th>
                              <th colSpan={RANKS.length} className="xl__h">기안자 · 전결권자</th>
                            </tr>
                            <tr>
                              <th className="xl__rownum">2</th>
                              {RANKS.map((rk) => <th key={rk} className="xl__h xl__rank">{rk}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <th className="xl__rownum">3</th>
                              <td className="xl__unit">{unit}</td>
                              <td className="xl__detail">{detail}</td>
                              {RANKS.map((rk) => (
                                <td key={rk} className="xl__mark">{rankMark(rk, drafter, approver)}</td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="xl__tabs">
                        <span className="xl__tab xl__tab--active">공통사항</span>
                      </div>
                    </div>
                    <div className="wonmun__foot">
                      <span className="wonmun__legend">★ 기안 · ● 전결</span>
                      <a className="wonmun__link" href="/byeolpyo2-samujeongyeol.xlsx" target="_blank" rel="noopener noreferrer">원문 엑셀 열기 ↗</a>
                    </div>
                  </div>
                </>
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.2-4.2" />
    </svg>
  );
}
