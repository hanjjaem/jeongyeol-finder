import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  delayRender,
  continueRender,
} from "remotion";

export const FPS = 30;
export const DURATION = 270; // 9s

const FONT = "'Pretendard Variable', Pretendard, -apple-system, sans-serif";
const QUERY = "예산의 변경";
const RANKS = ["담당자", "팀장", "실·단·과장", "국·소장", "부구청장", "구청장"];
const DRAFTER = "담당자";
const APPROVER = "국·소장";
const UNIT = "예산운영에 관한 사항";

// ── helpers ──────────────────────────────────────────────
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function reveal(frame: number, start: number, dur = 14) {
  const p = interpolate(frame, [start, start + dur], [0, 1], clamp);
  return { opacity: p, transform: `translateY(${(1 - p) * 18}px)` };
}

function useFont() {
  const [handle] = useState(() => delayRender("pretendard"));
  useEffect(() => {
    const f = new FontFace(
      "Pretendard Variable",
      "url(https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2) format('woff2')"
    );
    f.load()
      .then((loaded) => {
        document.fonts.add(loaded);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle]);
}

// ── main ─────────────────────────────────────────────────
export const Demo: React.FC = () => {
  useFont();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // entrance springs
  const enter = spring({ frame, fps, config: { damping: 16, mass: 0.7 } });
  const titleY = interpolate(enter, [0, 1], [26, 0]);
  const titleScale = interpolate(enter, [0, 1], [0.92, 1]);

  // typing 40..40+6*8
  const typed = Math.max(0, Math.min(QUERY.length, Math.floor((frame - 40) / 8)));
  const queryText = QUERY.slice(0, typed);
  const typingActive = frame >= 36 && frame < 96;
  const caretOn = Math.floor(frame / 16) % 2 === 0;

  // search button press ~92..104
  const press = interpolate(frame, [92, 98, 104], [1, 0.9, 1], clamp);

  // modal
  const mEnter = spring({ frame: frame - 100, fps, config: { damping: 18, mass: 0.8 } });
  const mExit = interpolate(frame, [248, 268], [0, 1], clamp);
  const backdrop = interpolate(frame, [100, 114], [0, 1], clamp) * (1 - mExit);
  const modalY = interpolate(mEnter, [0, 1], [54, 0]) + mExit * 70;
  const modalScale = interpolate(mEnter, [0, 1], [0.95, 1]);
  const modalOpacity = Math.min(mEnter, 1) * (1 - mExit);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: "#fbfcff" }}>
      <Background />

      {/* ── 앱 화면(히어로) ── */}
      <AbsoluteFill style={{ padding: "54px 60px", display: "flex", flexDirection: "column" }}>
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 13, opacity: enter }}>
          <Mark size={48} radius={16} font={24} />
          <span style={{ color: "#263d5b", fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>
            결재자를 단순하게
          </span>
        </div>

        {/* center */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            transform: "translateY(-30px)",
          }}
        >
          <div
            style={{
              fontSize: 132,
              lineHeight: 1.02,
              letterSpacing: "-.05em",
              fontWeight: 900,
              transform: `translateY(${titleY}px) scale(${titleScale})`,
              opacity: enter,
              ...gradientText("118deg,#0f55d8 0%,#3182f6 34%,#7c3aed 68%,#db2777 100%"),
            }}
          >
            누가 결재?
          </div>

          <div
            style={{
              marginTop: 26,
              color: "#7b8798",
              fontSize: 27,
              lineHeight: 1.6,
              letterSpacing: "-.025em",
              opacity: interpolate(frame, [8, 26], [0, 1], clamp),
            }}
          >
            처리할 업무를 입력하면,
            <br />
            위임전결규정 기준으로 결재받을 사람을 알려드려요.
          </div>

          {/* search card */}
          <div
            style={{
              position: "relative",
              marginTop: 46,
              width: 760,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 12px 12px 24px",
              borderRadius: 26,
              background: "#fff",
              boxShadow:
                "0 30px 90px rgba(28,45,74,.13), 0 0 26px rgba(91,90,255,.30), 0 0 60px rgba(124,58,237,.16)",
              opacity: interpolate(frame, [14, 32], [0, 1], clamp),
              transform: `translateY(${interpolate(frame, [14, 32], [16, 0], clamp)}px)`,
            }}
          >
            <NeonBorder radius={26} />
            <div
              style={{
                flex: 1,
                textAlign: "left",
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-.03em",
                color: queryText ? "#10233f" : "#aeb8c6",
                whiteSpace: "nowrap",
              }}
            >
              {queryText || "예: 경미한 출장보고, 3천만원 공사"}
              {typingActive && caretOn && (
                <span
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: 32,
                    marginLeft: 2,
                    verticalAlign: "-6px",
                    background: "linear-gradient(180deg,#2563eb,#7c3aed)",
                    borderRadius: 2,
                  }}
                />
              )}
            </div>
            <div
              style={{
                flex: "0 0 auto",
                height: 64,
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "0 26px",
                borderRadius: 17,
                color: "#fff",
                fontSize: 22,
                fontWeight: 850,
                letterSpacing: "-.02em",
                background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                boxShadow: "0 12px 24px rgba(89,87,255,.26)",
                transform: `scale(${press})`,
              }}
            >
              <SearchIcon />
              검색
            </div>
          </div>

          {/* example chips */}
          <div
            style={{
              marginTop: 22,
              display: "flex",
              gap: 10,
              opacity: interpolate(frame, [20, 36], [0, 1], clamp) * (1 - backdrop * 0.6),
            }}
          >
            {["병가", "예산의 변경", "관내출장"].map((ex) => (
              <span
                key={ex}
                style={{
                  border: "1px solid rgba(17,24,39,.10)",
                  background: "rgba(255,255,255,.7)",
                  color: ex === QUERY ? "#2563eb" : "#475569",
                  borderColor: ex === QUERY ? "rgba(52,120,246,.42)" : "rgba(17,24,39,.10)",
                  borderRadius: 999,
                  padding: "12px 18px",
                  fontSize: 19,
                  fontWeight: 800,
                  letterSpacing: "-.02em",
                }}
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      </AbsoluteFill>

      {/* ── 결과 모달 ── */}
      {frame >= 100 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 50,
            background: `rgba(15,23,42,${0.42 * backdrop})`,
            backdropFilter: `blur(${12 * backdrop}px)`,
          }}
        >
          <div
            style={{
              width: 860,
              background: "rgba(255,255,255,.98)",
              border: "1px solid rgba(255,255,255,.8)",
              borderRadius: 32,
              boxShadow: "0 48px 120px rgba(15,23,42,.30)",
              padding: "30px 40px 40px",
              opacity: modalOpacity,
              transform: `translateY(${modalY}px) scale(${modalScale})`,
            }}
          >
            <div
              style={{
                textAlign: "center",
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "-.04em",
                color: "#64748b",
                ...reveal(frame, 110),
              }}
            >
              {QUERY}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 22 }}>
              <Rbox tab="기안" tabStyle={{ color: "#5a6b88", background: "#e9eef5" }} value={DRAFTER} small style={reveal(frame, 122)} />
              <Rbox
                tab="전결권자"
                tabStyle={{ color: "#fff", background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
                value={APPROVER}
                style={reveal(frame, 134)}
              />
              <Rbox
                tab="근거"
                tabStyle={{ color: "#0e7a54", background: "#dff2e8" }}
                value={`${UNIT} · ${QUERY}`}
                small
                style={reveal(frame, 148)}
              />
            </div>

            <MiniExcel style={reveal(frame, 164)} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ── pieces ───────────────────────────────────────────────
const gradientText = (g: string): React.CSSProperties => ({
  backgroundImage: `linear-gradient(${g})`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

const Mark: React.FC<{ size: number; radius: number; font: number }> = ({ size, radius, font }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius,
      display: "grid",
      placeItems: "center",
      color: "#fff",
      fontWeight: 900,
      fontSize: font,
      letterSpacing: "-.04em",
      background: "linear-gradient(135deg,#111827,#2563eb)",
      boxShadow: "0 12px 28px rgba(52,120,246,.30)",
    }}
  >
    결
  </div>
);

const NeonBorder: React.FC<{ radius: number }> = ({ radius }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: radius,
      padding: 2,
      background: "linear-gradient(120deg,#2563eb,#7c3aed,#db2777,#2563eb)",
      WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
      WebkitMaskComposite: "xor",
      maskComposite: "exclude",
      pointerEvents: "none",
    }}
  />
);

const Rbox: React.FC<{
  tab: string;
  tabStyle: React.CSSProperties;
  value: string;
  small?: boolean;
  style?: React.CSSProperties;
}> = ({ tab, tabStyle, value, small, style }) => (
  <div
    style={{
      position: "relative",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: small ? 78 : 108,
      background: "#fff",
      border: "1px solid #eef1f6",
      borderRadius: 18,
      boxShadow: "0 8px 24px rgba(31,56,88,.05)",
      textAlign: "center",
      ...style,
    }}
  >
    <span
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        fontSize: 16,
        fontWeight: 900,
        letterSpacing: "-.02em",
        padding: "10px 20px",
        borderRadius: "18px 0 14px 0",
        ...tabStyle,
      }}
    >
      {tab}
    </span>
    <span
      style={{
        color: "#12233e",
        fontSize: small ? 22 : 44,
        fontWeight: small ? 750 : 900,
        letterSpacing: "-.03em",
      }}
    >
      {value}
    </span>
  </div>
);

const MiniExcel: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div style={{ marginTop: 22, ...style }}>
    <div
      style={{
        textAlign: "center",
        color: "#94a3b8",
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: "-.02em",
        margin: "0 0 12px",
      }}
    >
      사무전결사항 [별표 2]
    </div>
    <div style={{ border: "1px solid #e6eaf1", borderRadius: 12, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          background: "#f6f8fb",
          borderBottom: "1px solid #e6eaf1",
          color: "#6b7890",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <span style={{ color: "#1d8a4e" }}>▦</span>
        (별표 2) 사무전결사항(제4조관련).xlsx
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#fafbfd", color: "#94a3b8" }}>
            <th style={thMini}>단위사무</th>
            <th style={thMini}>세부사무</th>
            {RANKS.map((r) => (
              <th key={r} style={{ ...thMini, fontSize: 12 }}>
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...tdMini, color: "#475569", fontWeight: 700 }}>{UNIT}</td>
            <td style={{ ...tdMini, color: "#111827", fontWeight: 800 }}>{QUERY}</td>
            {RANKS.map((r) => (
              <td key={r} style={{ ...tdMini, textAlign: "center", fontSize: 16 }}>
                {(r === DRAFTER ? "★" : "") + (r === APPROVER ? "●" : "")}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
    <div style={{ marginTop: 10, color: "#9aa6b6", fontSize: 13, fontWeight: 700 }}>
      ★ 기안 · ● 전결
    </div>
  </div>
);

const thMini: React.CSSProperties = {
  border: "1px solid #edf0f5",
  padding: "8px 8px",
  fontWeight: 800,
  letterSpacing: "-.02em",
  whiteSpace: "nowrap",
};
const tdMini: React.CSSProperties = {
  border: "1px solid #edf0f5",
  padding: "10px 8px",
  letterSpacing: "-.02em",
};

const Background: React.FC = () => (
  <>
    <AbsoluteFill
      style={{
        backgroundImage:
          "radial-gradient(circle at 12% 10%, rgba(52,120,246,.20), transparent 32%)," +
          "radial-gradient(circle at 88% 14%, rgba(184,92,246,.18), transparent 34%)," +
          "radial-gradient(circle at 60% 96%, rgba(219,39,119,.10), transparent 38%)," +
          "linear-gradient(160deg,#fbfcff 0%,#f1f6ff 100%)",
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(rgba(16,35,63,.04) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(16,35,63,.04) 1px, transparent 1px)",
        backgroundSize: "46px 46px",
        WebkitMaskImage: "radial-gradient(circle at 50% 42%, black 0%, black 52%, transparent 88%)",
        maskImage: "radial-gradient(circle at 50% 42%, black 0%, black 52%, transparent 88%)",
      }}
    />
  </>
);

const SearchIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width={21} height={21} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.2-4.2" />
  </svg>
);
