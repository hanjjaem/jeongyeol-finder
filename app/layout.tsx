import "./globals.css";
export const metadata = { title: "동구 전결 도우미", description: "위임전결규정 안내 챗봇" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <footer style={{ textAlign: "center", fontSize: 12, color: "#888", padding: "12px" }}>
          위임전결규정 기반 참고용입니다. 최종 확인은 원규정/담당부서.
        </footer>
      </body>
    </html>
  );
}
