"use client";

import { useEffect, useRef, useState } from "react";

import { preloadSpeechVoices, speakKorean } from "@/utils/speech";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  vietnamese?: string;
  feedback?: string;
  correction?: {
    original: string;
    corrected: string;
    reason: string;
  };
  vocabulary?: { korean: string; meaning: string }[];
};

type ChatResponse = {
  ok: boolean;
  reply?: string;
  replyVietnamese?: string;
  feedback?: string;
  correction?: {
    original: string;
    corrected: string;
    reason: string;
  };
  vocabulary?: { korean: string; meaning: string }[];
  followUpQuestion?: string;
  error?: string;
};

const SCENARIOS = [
  { id: "free", label: "💬 Tự do", desc: "Trò chuyện thoải mái" },
  { id: "cafe", label: "☕ Quán cà phê", desc: "Gọi món, thanh toán" },
  { id: "shopping", label: "🛍️ Mua sắm", desc: "Hỏi giá, thử đồ" },
  { id: "interview", label: "💼 Phỏng vấn", desc: "Xin việc part-time" },
  { id: "hospital", label: "🏥 Khám bệnh", desc: "Mô tả triệu chứng" },
  { id: "friends", label: "👋 Bạn bè", desc: "Trò chuyện thân mật" },
  { id: "travel", label: "✈️ Du lịch", desc: "Hỏi đường, đặt phòng" },
];

const LEVELS = ["sơ cấp", "trung cấp", "cao cấp"] as const;

const STARTER_MESSAGES: Record<string, string> = {
  free: "안녕하세요! 오늘 기분이 어때요?",
  cafe: "어서 오세요! 뭐 드시겠어요?",
  shopping: "안녕하세요, 뭐 찾으세요?",
  interview: "안녕하세요. 먼저 자기소개 부탁드립니다.",
  hospital: "안녕하세요. 어디가 아프세요?",
  friends: "야, 오랜만이야! 요즘 어때?",
  travel: "안녕하세요! 어디로 가고 싶으세요?",
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AiChat() {
  const [scenario, setScenario] = useState("free");
  const [level, setLevel] =
    useState<(typeof LEVELS)[number]>("trung cấp");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    preloadSpeechVoices();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function startConversation(nextScenario = scenario) {
    setMessages([
      {
        id: createId(),
        role: "assistant",
        content:
          STARTER_MESSAGES[nextScenario] ||
          STARTER_MESSAGES.free,
        vietnamese: getStarterVietnamese(nextScenario),
      },
    ]);
    setError("");
    setInput("");
  }

  async function sendMessage() {
    const trimmed = input.trim();

    if (!trimmed || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "conversation",
          scenario,
          level,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok || !data.ok) {
        setError(data.error || "Không gửi được tin nhắn.");
        return;
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: data.reply || "...",
        vietnamese: data.replyVietnamese,
        feedback: data.feedback,
        correction: data.correction?.corrected
          ? data.correction
          : undefined,
        vocabulary: data.vocabulary,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (requestError) {
      console.error(requestError);
      setError("Không kết nối được AI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-500">🗣️ Hội thoại AI</p>
        <h2 className="mt-1 text-2xl font-bold">
          Luyện nói với giáo viên Hàn
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Chọn tình huống, trả lời bằng tiếng Hàn hoặc tiếng Việt. AI sẽ phản hồi,
          sửa lỗi và gợi ý từ vựng.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <select
            value={scenario}
            onChange={(event) => {
              const next = event.target.value;
              setScenario(next);
              startConversation(next);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
          >
            {SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} — {item.desc}
              </option>
            ))}
          </select>

          <select
            value={level}
            onChange={(event) =>
              setLevel(event.target.value as (typeof LEVELS)[number])
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
          >
            {LEVELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startConversation()}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold transition hover:bg-slate-700"
          >
            🔄 Bắt đầu mới
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {messages.length === 0 && (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
              <div className="text-5xl">🗣️</div>
              <p className="mt-4 font-semibold">
                Nhấn &quot;Bắt đầu mới&quot; để mở hội thoại
              </p>
              <button
                type="button"
                onClick={() => startConversation()}
                className="mt-4 rounded-2xl bg-white px-6 py-3 font-bold text-black"
              >
                Bắt đầu hội thoại
              </button>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-slate-400">
                ✨ AI đang suy nghĩ...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="mx-4 mb-2 rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="border-t border-slate-800 p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading || messages.length === 0}
              placeholder={
                messages.length === 0
                  ? "Bắt đầu hội thoại trước..."
                  : "Viết câu trả lời (Hàn hoặc Việt)..."
              }
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim() || messages.length === 0}
              className="shrink-0 rounded-xl bg-white px-5 py-3 font-bold text-black disabled:opacity-50"
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 md:max-w-[75%] ${
          isUser
            ? "bg-white text-black"
            : "bg-slate-950 text-slate-100"
        }`}
      >
        <p className="whitespace-pre-line text-base leading-7">
          {message.content}
        </p>

        {!isUser && message.vietnamese && (
          <p className="mt-2 text-sm leading-6 text-slate-400">
            🇻🇳 {message.vietnamese}
          </p>
        )}

        {!isUser && (
          <button
            type="button"
            onClick={() => speakKorean(message.content)}
            className="mt-2 text-xs text-slate-500 hover:text-white"
          >
            🔊 Nghe
          </button>
        )}

        {!isUser && message.feedback && (
          <p className="mt-3 rounded-xl bg-slate-900 px-3 py-2 text-sm text-amber-200">
            💡 {message.feedback}
          </p>
        )}

        {!isUser && message.correction?.corrected && (
          <div className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-sm">
            <p className="font-semibold text-emerald-300">
              ✓ {message.correction.corrected}
            </p>
            {message.correction.reason && (
              <p className="mt-1 text-slate-400">
                {message.correction.reason}
              </p>
            )}
          </div>
        )}

        {!isUser &&
          message.vocabulary &&
          message.vocabulary.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.vocabulary.map((word) => (
                <button
                  key={word.korean}
                  type="button"
                  onClick={() => speakKorean(word.korean)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs transition hover:bg-slate-800"
                >
                  <span className="font-bold">{word.korean}</span>
                  <span className="ml-1 text-slate-500">{word.meaning}</span>
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

function getStarterVietnamese(scenario: string) {
  switch (scenario) {
    case "cafe":
      return "Xin chào! Bạn muốn uống gì?";
    case "shopping":
      return "Xin chào, bạn đang tìm gì?";
    case "interview":
      return "Xin chào. Xin hãy giới thiệu bản thân trước.";
    case "hospital":
      return "Xin chào. Bạn đau ở đâu?";
    case "friends":
      return "Ê, lâu rồi không gặp! Dạo này thế nào?";
    case "travel":
      return "Xin chào! Bạn muốn đi đâu?";
    default:
      return "Xin chào! Hôm nay bạn thế nào?";
  }
}
