"use client";
import { useState } from "react";
import { lookup } from "../lib/lookup";
import { withBase } from "../lib/basePath";

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
export default function Home() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  async function search(q?: string) {
    const text = (q ?? query).trim();
    if (!text || loading) return;
    if (q) setQuery(q);
    setOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    setChosen(null);
    try {
      const r = await lookup(text);
      if (r.ok) {
        setResult(r.result as Result);
      } else {
        setError(r.error);
      }
    } catch {
      setError("검색 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
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
                      <a className="wonmun__link" href={withBase("/byeolpyo2-samujeongyeol.xlsx")} target="_blank" rel="noopener noreferrer">원문 엑셀 열기 ↗</a>
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
