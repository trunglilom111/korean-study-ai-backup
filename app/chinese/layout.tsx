import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tiếng Trung cho người mới",
  description: "Lộ trình nhập môn tiếng Trung với pinyin, thanh điệu và từ vựng đầu tiên.",
};

export default function ChineseLayout({ children }: LayoutProps<"/chinese">) {
  return <>{children}</>;
}
