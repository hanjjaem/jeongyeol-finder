import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "결재자를 단순하게",
  description: "업무명을 입력하면 위임전결규정 기준 결재(전결)받을 사람을 알려드립니다.",
};
export const viewport: Viewport = { themeColor: "#f1f6ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
