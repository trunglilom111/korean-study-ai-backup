"use client";

import { useState } from "react";

import { speakKorean } from "@/utils/speech";

type WritingResponse = {
  ok: boolean;
  wasCorrect?: boolean;
  correctedText?: string;
  score?: number;
  feedback?: string;
  grammarNotes?: { pattern: string; explanation: string }[];
  naturalAlternative?: string;
  encouragement?: string;
  error?: string;
};

const PROMPTS = [
  "Viết câu giới thiệu bản thân (3 câu).",
  "Viết email xin nghỉ ốm gửi sếp.",
  "Mô tả thói quen hàng ngày của bạn.",
  "Viết câu hỏi đường đến ga tàu điện ngầm.",
  "Kể về chuyến du lịch gần đây.",
];

export default function AiWritingPractice() {
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WritingResponse | null>(null);
  const [error, setError] = useState("");

  async function checkWriting() {
    if (!text.trim()) {
      setError("Hãy viết câu tiếng Hàn trước.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "writing",
          text: text.trim(),
          prompt: prompt.trim(),
        }),
      });

      const data = (await response.json()) as WritingResponse;

      if (!response.ok || !data.ok) {
        setError(data.error || "Không kiểm tra được bài viết.");
        return;
      }

      setResult(data);
    } catch (requestError) {
      console.error(requestError);
      setError("Không kết nối được AI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-500">✍️ Luyện viết</p>
        <h2 className="mt-1 text-2xl font-bold">
          Viết và được AI chấm điểm
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Viết câu hoặc đoạn tiếng Hàn, AI sẽ chấm điểm, sửa lỗi và giải thích
          ngữ pháp.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">
        <label className="mb-2 block text-sm text-slate-400">
          Chủ đề / yêu cầu (tuỳ chọn)
        </label>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ví dụ: Viết diary về ngày hôm nay..."
          className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500"
        />

        <label className="mb-2 block text-sm text-slate-400">
          Bài viết tiếng Hàn
        </label>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          placeholder="Viết câu hoặc đoạn tiếng Hàn ở đây..."
          className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-lg leading-8 outline-none focus:border-slate-500"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {PROMPTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPrompt(item)}
              className="rounded-full bg-slate-950 px-3 py-2 text-xs text-slate-400 transition hover:bg-slate-800"
            >
              {item}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={checkWriting}
          disabled={loading}
          className="mt-5 w-full rounded-2xl bg-white py-4 text-lg font-bold text-black disabled:opacity-50"
        >
          {loading ? "✨ AI đang chấm..." : "✍️ Chấm bài viết"}
        </button>
      </div>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Điểm số</p>
                <p className="text-4xl font-bold">{result.score ?? 0}/100</p>
              </div>
              <div
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  result.wasCorrect
                    ? "bg-emerald-950 text-emerald-300"
                    : "bg-amber-950 text-amber-300"
                }`}
              >
                {result.wasCorrect ? "✅ Rất tốt!" : "🛠️ Cần sửa"}
              </div>
            </div>

            {result.correctedText && (
              <div className="mt-5">
                <p className="text-sm text-slate-500">Câu đúng / tự nhiên</p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <p className="text-2xl font-bold leading-relaxed">
                    {result.correctedText}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      speakKorean(result.correctedText || "")
                    }
                    className="shrink-0 rounded-xl bg-slate-800 px-3 py-2"
                  >
                    🔊
                  </button>
                </div>
              </div>
            )}

            {result.feedback && (
              <p className="mt-4 leading-7 text-slate-300">{result.feedback}</p>
            )}

            {result.encouragement && (
              <p className="mt-3 text-sm text-emerald-400">
                {result.encouragement}
              </p>
            )}
          </div>

          {result.grammarNotes && result.grammarNotes.length > 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="mb-4 text-lg font-bold">🧩 Ngữ pháp cần chú ý</h3>
              <div className="space-y-3">
                {result.grammarNotes.map((note, index) => (
                  <div
                    key={`${note.pattern}-${index}`}
                    className="rounded-2xl bg-slate-950 p-4"
                  >
                    <p className="font-bold">{note.pattern}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {note.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.naturalAlternative &&
            result.naturalAlternative !== result.correctedText && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="mb-2 text-lg font-bold">💬 Cách nói tự nhiên hơn</h3>
                <p className="text-lg leading-7">{result.naturalAlternative}</p>
              </div>
            )}

          <button
            type="button"
            onClick={() => {
              setResult(null);
              setText("");
            }}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-4 font-semibold hover:bg-slate-800"
          >
            ✍️ Viết bài mới
          </button>
        </div>
      )}
    </div>
  );
}
