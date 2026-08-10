import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-korean",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Korean Study AI",
    template: "%s | Korean Study AI",
  },
  description: "Học tiếng Hàn có lộ trình cùng từ vựng, ngữ pháp và AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`h-full antialiased ${notoSansKr.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
