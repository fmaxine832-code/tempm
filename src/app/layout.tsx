import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "云端接码 - 临时邮箱",
  description: "免费临时邮箱，极速接收验证码和登录链接",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
