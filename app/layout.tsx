import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meetly | 최적의 약속 장소 도출 서비스",
  description: "대중교통 이동 시간을 고려한 공평한 약속 장소 추천 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}