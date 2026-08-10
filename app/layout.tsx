import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
