"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { createClient } from "@/utils/supabase/client";

type Level = "sơ cấp" | "trung cấp" | "cao cấp";

type ShadowingSentence = {
  korean: string;
  vietnamese: string;
  romanization: string;
  focusPoint: string;
};

type ShadowingLesson = {
  title: string;
  description: string;
  level: string;
  sentences: ShadowingSentence[];
};

type ShadowingResponse = {
  ok: boolean;
  title?: string;
  description?: string;
  level?: string;
  sentences?: ShadowingSentence[];
  error?: string;
};

const samples: ShadowingSentence[] = [
  {
    korean: "안녕하세요. 만나서 반갑습니다.",
    vietnamese: "Xin chào. Rất vui được gặp bạn.",
    romanization: "Annyeonghaseyo. Mannaseo bangapseumnida.",
    focusPoint: "Nói liền 만나서 반갑습니다, nhấn nhẹ ở 반갑.",
  },
  {
    korean: "오늘 뭐 할 거예요?",
    vietnamese: "Hôm nay bạn sẽ làm gì?",
    romanization: "Oneul mwo hal geoyeyo?",
    focusPoint: "Đuôi câu 예요 lên giọng nhẹ vì đây là câu hỏi.",
  },
  {
    korean: "저는 한국어를 공부하고 있어요.",
    vietnamese: "Tôi đang học tiếng Hàn.",
    romanization: "Jeoneun hangugeoreul gongbuhago isseoyo.",
    focusPoint: "Nối 하고 있어요 thật mềm, không ngắt từng từ.",
  },
  {
    korean: "은행 계좌를 만들고 싶어요.",
    vietnamese: "Tôi muốn mở tài khoản ngân hàng.",
    romanization: "Eunhaeng gyejwaleul mandeulgo sipeoyo.",
    focusPoint: "Đọc 싶어요 gần như 시퍼요 trong tốc độ nói tự nhiên.",
  },
];

const topicSuggestions = [
  "Gọi món ở nhà hàng",
  "Đi khám bệnh",
  "Phỏng vấn xin việc",
  "Giới thiệu bản thân",
  "Hỏi đường ở Seoul",
  "Nói chuyện với bạn bè",
];

export default function ShadowingPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [authReady, setAuthReady] = useState(false);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("sơ cấp");
  const [count, setCount] = useState(5);
  const [lesson, setLesson] = useState<ShadowingLesson | null>(null);
  const [manualText, setManualText] = useState(samples[0].korean);
  const [activeIndex, setActiveIndex] = useState(0);
  const [speed, setSpeed] = useState(0.85);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const playbackId = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function checkUser() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setAuthReady(true);
    }

    checkUser();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    return () => {
      playbackId.current += 1;
      window.speechSynthesis.cancel();
    };
  }, []);

  const sentences =
    lesson && lesson.sentences.length > 0
      ? lesson.sentences
      : [
          {
            korean: manualText.trim() || samples[0].korean,
            vietnamese: "Câu tự nhập để luyện phát âm.",
            romanization: "",
            focusPoint: "Nghe chậm trước, sau đó nhại lại theo nhịp câu.",
          },
        ];

  const currentSentence = sentences[activeIndex] || sentences[0];

  function stopPlayback() {
    playbackId.current += 1;
    window.speechSynthesis.cancel();
    setIsPlayingAll(false);
  }

  function makeUtterance(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    const koreanVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("ko"));

    utterance.lang = "ko-KR";
    utterance.rate = speed;

    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    return utterance;
  }

  function speakSentence(sentence: ShadowingSentence) {
    stopPlayback();
    window.speechSynthesis.speak(makeUtterance(sentence.korean));
  }

  function playAll(startIndex = activeIndex) {
    stopPlayback();

    const currentPlaybackId = playbackId.current;
    setIsPlayingAll(true);

    function playNext(index: number) {
      if (currentPlaybackId !== playbackId.current) {
        return;
      }

      if (index >= sentences.length) {
        setIsPlayingAll(false);
        return;
      }

      setActiveIndex(index);

      const utterance = makeUtterance(sentences[index].korean);

      utterance.onend = () => {
        window.setTimeout(() => playNext(index + 1), 650);
      };

      utterance.onerror = () => {
        if (currentPlaybackId === playbackId.current) {
          setIsPlayingAll(false);
        }
      };

      window.speechSynthesis.speak(utterance);
    }

    playNext(startIndex);
  }

  async function generateLesson() {
    if (!topic.trim()) {
      setError("Hãy nhập chủ đề muốn luyện.");
      return;
    }

    stopPlayback();
    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/ai/shadowing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic.trim(),
          level,
          count,
        }),
      });

      const data = (await response.json()) as ShadowingResponse;

      if (!response.ok || !data.ok) {
        setError(data.error || "Không thể tạo bài shadowing.");
        return;
      }

      if (!data.sentences || data.sentences.length === 0) {
        setError("AI chưa tạo được câu luyện. Hãy thử lại với chủ đề khác.");
        return;
      }

      setLesson({
        title: data.title || "Bài shadowing mới",
        description: data.description || "Luyện nghe và nhại theo từng câu.",
        level: data.level || level,
        sentences: data.sentences,
      });
      setActiveIndex(0);
    } catch (requestError) {
      console.error(requestError);
      setError("Không kết nối được AI. Hãy thử lại sau.");
    } finally {
      setGenerating(false);
    }
  }

  function useSample(sample: ShadowingSentence) {
    stopPlayback();
    setLesson(null);
    setManualText(sample.korean);
    setActiveIndex(0);
    setError("");
  }

  function useManualText() {
    stopPlayback();
    setLesson(null);
    setActiveIndex(0);
    setError("");
  }

  if (!authReady) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center text-center">
          <div>
            <div className="text-5xl">🎧</div>
            <p className="mt-4 font-semibold">Đang chuẩn bị bài shadowing...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-slate-400">쉐도잉</p>
        <h1 className="text-3xl font-bold md:text-4xl">🎧 Shadowing</h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Nghe, nhại lại và luyện nhịp nói như người Hàn qua những bài ngắn
          theo đúng chủ đề bạn cần.
        </p>
      </div>

      <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm text-slate-500">✨ Shadowing AI</p>
            <h2 className="mt-1 text-xl font-bold">Tạo bài theo chủ đề</h2>
          </div>
          <span className="w-fit rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
            Gemini · {level}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_120px]">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                generateLesson();
              }
            }}
            maxLength={160}
            placeholder="Ví dụ: Gọi món ở quán cà phê"
            className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500"
          />

          <select
            value={level}
            onChange={(event) => setLevel(event.target.value as Level)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
          >
            <option value="sơ cấp">🌱 Sơ cấp</option>
            <option value="trung cấp">🌿 Trung cấp</option>
            <option value="cao cấp">🌳 Cao cấp</option>
          </select>

          <select
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
            aria-label="Số câu luyện"
          >
            <option value={3}>3 câu</option>
            <option value={5}>5 câu</option>
            <option value={8}>8 câu</option>
            <option value={10}>10 câu</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {topicSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setTopic(suggestion)}
              className="rounded-full bg-slate-950 px-3 py-2 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              {suggestion}
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
          onClick={generateLesson}
          disabled={generating}
          className="mt-5 w-full rounded-2xl bg-white py-4 font-bold text-black transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
        >
          {generating ? "✨ AI đang tạo bài..." : "✨ Tạo bài shadowing"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm text-slate-500">
              {lesson ? `${lesson.level} · ${sentences.length} câu` : "Luyện câu tự nhập"}
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {lesson ? lesson.title : "Câu luyện của bạn"}
            </h2>
            {lesson?.description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {lesson.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-950 p-1">
            {[0.7, 0.85, 1].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => {
                  stopPlayback();
                  setSpeed(rate);
                }}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  speed === rate ? "bg-white text-black" : "text-slate-400 hover:text-white"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7 rounded-3xl bg-slate-950 p-5 text-center md:p-8">
          <p className="text-sm text-slate-500">
            Câu {Math.min(activeIndex + 1, sentences.length)} / {sentences.length}
          </p>
          <p className="mt-4 break-words text-3xl font-bold leading-relaxed md:text-4xl">
            {currentSentence.korean}
          </p>

          {currentSentence.romanization && (
            <p className="mt-4 text-sm italic text-slate-500">
              {currentSentence.romanization}
            </p>
          )}

          <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
            🇻🇳 {currentSentence.vietnamese}
          </p>

          <div className="mt-5 rounded-2xl bg-slate-900 px-4 py-3 text-left text-sm leading-6 text-slate-400">
            💡 {currentSentence.focusPoint}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:justify-center">
            <button
              type="button"
              onClick={() => speakSentence(currentSentence)}
              className="rounded-xl bg-white px-5 py-3 font-bold text-black transition hover:bg-slate-200"
            >
              🔊 Nghe câu
            </button>
            <button
              type="button"
              onClick={() => {
                if (isPlayingAll) {
                  stopPlayback();
                } else {
                  playAll();
                }
              }}
              className="rounded-xl bg-slate-800 px-5 py-3 font-semibold transition hover:bg-slate-700"
            >
              {isPlayingAll ? "■ Dừng" : "▶ Đọc từ đây"}
            </button>
          </div>
        </div>

        {sentences.length > 1 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:justify-between">
            <button
              type="button"
              onClick={() => {
                stopPlayback();
                setActiveIndex((index) => Math.max(0, index - 1));
              }}
              disabled={activeIndex === 0}
              className="rounded-xl border border-slate-700 px-4 py-3 font-semibold transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Câu trước
            </button>
            <button
              type="button"
              onClick={() => {
                stopPlayback();
                setActiveIndex((index) => Math.min(sentences.length - 1, index + 1));
              }}
              disabled={activeIndex === sentences.length - 1}
              className="rounded-xl border border-slate-700 px-4 py-3 font-semibold transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Câu tiếp →
            </button>
          </div>
        )}

        {lesson && (
          <div className="mt-7">
            <p className="mb-3 text-sm font-semibold text-slate-400">Chọn câu để luyện</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {sentences.map((sentence, index) => (
                <button
                  key={`${sentence.korean}-${index}`}
                  type="button"
                  onClick={() => {
                    stopPlayback();
                    setActiveIndex(index);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    activeIndex === index
                      ? "border-slate-300 bg-slate-800"
                      : "border-slate-800 bg-slate-950 hover:bg-slate-800"
                  }`}
                >
                  <span className="text-xs text-slate-500">{index + 1}. </span>
                  <span className="font-semibold leading-6">{sentence.korean}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">
        <p className="text-sm text-slate-500">✍️ Tự nhập câu</p>
        <h2 className="mt-1 text-xl font-bold">Luyện câu của riêng bạn</h2>
        <textarea
          value={manualText}
          onChange={(event) => setManualText(event.target.value)}
          rows={3}
          placeholder="Dán câu tiếng Hàn bạn muốn luyện vào đây..."
          className="mt-5 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 text-lg leading-8 outline-none focus:border-slate-500"
        />
        <button
          type="button"
          onClick={useManualText}
          className="mt-3 rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold transition hover:bg-slate-700"
        >
          🎧 Luyện câu này
        </button>

        <div className="mt-6 border-t border-slate-800 pt-5">
          <p className="mb-3 text-sm text-slate-500">Câu mẫu có sẵn</p>
          <div className="flex flex-wrap gap-2">
            {samples.map((sample) => (
              <button
                key={sample.korean}
                type="button"
                onClick={() => useSample(sample)}
                className="rounded-xl bg-slate-950 px-3 py-2 text-sm transition hover:bg-slate-800"
              >
                {sample.korean}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 text-sm leading-7 text-slate-400">
        <p className="font-semibold text-white">Cách luyện hiệu quả</p>
        <p className="mt-2">
          ① Nghe chậm 2 lần → ② đọc đuổi theo âm thanh → ③ lặp lại mà không nhìn chữ → ④ tăng lên 1.0x khi đã quen.
        </p>
      </div>
    </AppShell>
  );
}
