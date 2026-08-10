import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tiếng Trung từ nền tảng đến HSK 4",
  description: "Lộ trình học tiếng Trung có pinyin, thanh điệu, ôn tập HSK 1–4 và học liệu Gemini.",
};

export default function ChineseLayout({ children }: LayoutProps<"/chinese">) {
  return <>{children}</>;
}
