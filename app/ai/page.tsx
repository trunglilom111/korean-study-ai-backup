"use client";

import { useState } from "react";

import AppShell from "@/components/AppShell";
import AiChat from "@/components/AiChat";
import AiTranslate from "@/components/AiTranslate";
import AiWritingPractice from "@/components/AiWritingPractice";

type AiTab = "translate" | "chat" | "writing";

const TABS: { id: AiTab; icon: string; label: string; korean: string }[] = [
  { id: "translate", icon: "✍️", label: "Dịch & Sửa", korean: "번역" },
  { id: "chat", icon: "🗣️", label: "Hội thoại", korean: "대화" },
  { id: "writing", icon: "📝", label: "Luyện viết", korean: "쓰기" },
];

export default function AIPage() {
  const [activeTab, setActiveTab] = useState<AiTab>("translate");

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-slate-400">한국어 AI 선생님</p>
        <h1 className="text-3xl font-bold md:text-4xl">🤖 AI Tutor</h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Dịch, hội thoại thực tế và luyện viết — tất cả với Gemini.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-white text-black"
                : "bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {tab.icon} {tab.label}
            <span className="ml-1 text-xs opacity-60">{tab.korean}</span>
          </button>
        ))}
      </div>

      {activeTab === "translate" && <AiTranslate />}
      {activeTab === "chat" && <AiChat />}
      {activeTab === "writing" && <AiWritingPractice />}
    </AppShell>
  );
}
