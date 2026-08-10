"use client";

import Link from "next/link";
import { useState } from "react";

type Tone = {
  label: string;
  mark: string;
  example: string;
  pinyin: string;
  meaning: string;
  description: string;
  className: string;
};

type StarterWord = {
  hanzi: string;
  pinyin: string;
  meaning: string;
  example: string;
};

const tones: Tone[] = [
  {
    label: "Thanh 1",
    mark: "¯",
    example: "mā",
    pinyin: "mā",
    meaning: "mẹ",
    description: "Giữ giọng cao và đều, như đang ngân dài.",
    className: "border-sky-300 bg-sky-950/70 text-sky-100",
  },
  {
    label: "Thanh 2",
    mark: "ˊ",
    example: "má",
    pinyin: "má",
    meaning: "cây gai / tê",
    description: "Đi từ thấp lên cao, giống lúc bạn hỏi lại “hả?”.",
    className: "border-emerald-300 bg-emerald-950/70 text-emerald-100",
  },
  {
    label: "Thanh 3",
    mark: "ˇ",
    example: "mǎ",
    pinyin: "mǎ",
    meaning: "ngựa",
    description: "Hạ giọng rồi nhấc lên. Khi nói nhanh thường chỉ nghe phần hạ.",
    className: "border-amber-300 bg-amber-950/70 text-amber-100",
  },
  {
    label: "Thanh 4",
    mark: "ˋ",
    example: "mà",
    pinyin: "mà",
    meaning: "mắng",
    description: "Rơi mạnh từ cao xuống thấp, dứt khoát.",
    className: "border-rose-300 bg-rose-950/70 text-rose-100",
  },
  {
    label: "Thanh nhẹ",
    mark: "·",
    example: "ma",
    pinyin: "ma",
    meaning: "trợ từ hỏi",
    description: "Ngắn, nhẹ và không nhấn. Ví dụ: 吗 ma trong câu hỏi.",
    className: "border-violet-300 bg-violet-950/70 text-violet-100",
  },
];

const starterWords: StarterWord[] = [
  { hanzi: "你好", pinyin: "nǐ hǎo", meaning: "xin chào", example: "你好！Nǐ hǎo!" },
  { hanzi: "谢谢", pinyin: "xiè xie", meaning: "cảm ơn", example: "谢谢你。Xiè xie nǐ." },
  { hanzi: "再见", pinyin: "zài jiàn", meaning: "tạm biệt", example: "明天见！Míngtiān jiàn!" },
  { hanzi: "我", pinyin: "wǒ", meaning: "tôi / mình", example: "我是学生。Wǒ shì xuéshēng." },
  { hanzi: "你", pinyin: "nǐ", meaning: "bạn", example: "你好吗？Nǐ hǎo ma?" },
  { hanzi: "是", pinyin: "shì", meaning: "là", example: "我是越南人。Wǒ shì Yuènán rén." },
];

const lessonSteps = [
  { day: "Ngày 1–3", title: "Làm quen với tiếng Trung", text: "Pinyin, 4 thanh điệu, chào hỏi và số 0–10.", icon: "01" },
  { day: "Ngày 4–7", title: "Tự giới thiệu", text: "Tên, quốc tịch, nghề nghiệp và những câu hỏi cơ bản.", icon: "02" },
  { day: "Tuần 2", title: "Nói câu ngắn", text: "Trật tự câu, phủ định, câu hỏi và 80 từ thông dụng.", icon: "03" },
  { day: "Tuần 3–4", title: "Dùng được hằng ngày", text: "Thời gian, mua sắm, ăn uống và hội thoại mini.", icon: "04" },
];

const quizOptions = ["nǐ hǎo", "xiè xie", "zài jiàn", "wǒ shì"];

export default function ChineseStudyPage() {
  const [activeTone, setActiveTone] = useState(0);
  const [selectedWord, setSelectedWord] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);

  const currentTone = tones[activeTone];
  const currentWord = starterWords[selectedWord];

  function speakChinese(text: string) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.78;
    window.speechSynthesis.speak(utterance);
  }

  function chooseWord(index: number) {
    setSelectedWord(index);
    setShowMeaning(false);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080d1d] text-slate-100">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_12%_12%,rgba(220,38,38,0.32),transparent_32%),radial-gradient(circle_at_83%_24%,rgba(251,191,36,0.16),transparent_28%),linear-gradient(180deg,#151126_0%,#080d1d_72%)]" />

        <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-10 md:py-7">
          <Link href="/chinese" className="flex items-center gap-3 font-bold tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500 text-xl shadow-lg shadow-red-950/50">中</span>
            <span>
              Chinese Start
              <span className="mt-0.5 block text-xs font-normal text-slate-400">Tiếng Trung cho người mới</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 text-sm">
            <nav className="hidden items-center gap-5 text-slate-400 md:flex">
              <a href="#bat-dau" className="transition hover:text-white">Bắt đầu</a>
              <a href="#pinyin" className="transition hover:text-white">Pinyin</a>
              <a href="#tu-vung" className="transition hover:text-white">Từ đầu tiên</a>
            </nav>
            <Link href="/" className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">
              KR · Tiếng Hàn
            </Link>
          </div>
        </header>

        <section id="bat-dau" className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 md:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-24 lg:pt-16">
          <div>
            <p className="inline-flex rounded-full border border-red-400/35 bg-red-950/40 px-3 py-1.5 text-xs font-semibold tracking-wide text-red-200">LỘ TRÌNH NHẬP MÔN · 20 PHÚT MỖI NGÀY</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-white md:text-6xl">
              Bắt đầu tiếng Trung từ <span className="text-red-400">con số 0.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">Không cần biết chữ Hán trước. Đi theo thứ tự nghe → pinyin → thanh điệu → câu ngắn, và bạn sẽ nói được những câu đầu tiên ngay hôm nay.</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#thanh-dieu" className="rounded-xl bg-red-500 px-5 py-3 font-bold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400">Học bài đầu tiên</a>
              <a href="#lo-trinh" className="rounded-xl border border-slate-600 bg-slate-900/70 px-5 py-3 font-semibold text-slate-200 transition hover:border-slate-400">Xem lộ trình 4 tuần</a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400">
              <span>✓ Không cần API</span>
              <span>✓ Học trên điện thoại</span>
              <span>✓ Có nghe phát âm</span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-300/15 bg-slate-950/55 p-5 shadow-2xl shadow-black/30 backdrop-blur md:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Bài học hôm nay</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Ngày 1: Chào hỏi</h2>
              </div>
              <div className="rounded-2xl bg-red-500/15 px-3 py-2 text-sm font-bold text-red-200">20 phút</div>
            </div>

            <div className="mt-7 space-y-3">
              {[
                ["01", "Nghe 4 thanh điệu", "5 phút"],
                ["02", "Đọc 6 từ đầu tiên", "8 phút"],
                ["03", "Nói 3 câu chào", "7 phút"],
              ].map(([number, label, time], index) => (
                <a key={number} href={index === 0 ? "#thanh-dieu" : index === 1 ? "#tu-vung" : "#kiem-tra"} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition hover:border-red-400/60 hover:bg-slate-800">
                  <span className="text-sm font-bold text-red-300">{number}</span>
                  <span className="flex-1 font-medium">{label}</span>
                  <span className="text-xs text-slate-500">{time}</span>
                  <span className="text-slate-500">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section id="lo-trinh" className="border-y border-slate-800/90 bg-slate-900/35">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-300">Lộ trình dễ theo</p>
            <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">4 tuần đầu tiên, học đúng thứ tự.</h2>
            <p className="mt-3 leading-7 text-slate-400">Tập trung giao tiếp cơ bản trước, chữ Hán đi cùng từ vựng thay vì học rời rạc.</p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {lessonSteps.map((step) => (
              <article key={step.icon} className="rounded-3xl border border-slate-800 bg-[#0b1122] p-6">
                <span className="text-sm font-black text-red-300">{step.icon}</span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">{step.day}</p>
                <h3 className="mt-2 text-xl font-bold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="thanh-dieu" className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-300">Bài 1 · Quan trọng nhất</p>
            <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">Thanh điệu làm đổi nghĩa của từ.</h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">Cùng một âm <span className="font-semibold text-white">ma</span> nhưng đổi thanh sẽ thành mẹ, ngựa hoặc mắng. Bấm từng ô để xem cách đọc và thử nghe.</p>

            <div className="mt-7 rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mẹo cho người mới</p>
              <p className="mt-3 leading-7 text-slate-300">Đừng cố nhớ bằng mắt. Hãy nghe – lặp lại – thu âm giọng của mình. Mỗi lần chỉ luyện một thanh trong 2–3 phút.</p>
            </div>
          </div>

          <div>
            <div className="grid gap-3 sm:grid-cols-5">
              {tones.map((tone, index) => (
                <button key={tone.label} type="button" onClick={() => setActiveTone(index)} className={`rounded-2xl border p-4 text-left transition ${index === activeTone ? `${tone.className} ring-2 ring-white/60` : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"}`}>
                  <span className="block text-xs font-semibold">{tone.label}</span>
                  <span className="mt-4 block text-3xl font-black">{tone.mark}</span>
                </button>
              ))}
            </div>

            <div className={`mt-4 rounded-3xl border p-6 transition ${currentTone.className}`}>
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold opacity-70">{currentTone.label}</p>
                  <p className="chinese-text mt-1 text-5xl font-black">{currentTone.example}</p>
                  <p className="mt-2 text-sm">Nghĩa: <span className="font-bold">{currentTone.meaning}</span></p>
                </div>
                <button type="button" onClick={() => speakChinese(currentTone.pinyin)} className="inline-flex items-center justify-center rounded-xl bg-white/15 px-4 py-3 font-bold transition hover:bg-white/25" aria-label={`Nghe ${currentTone.pinyin}`}>
                  Phát âm
                </button>
              </div>
              <p className="mt-5 border-t border-current/20 pt-4 text-sm leading-6 opacity-90">{currentTone.description}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pinyin" className="bg-[#0d1427]">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">Công cụ đọc</p>
              <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">Pinyin là “bản đồ phát âm”.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-400">Hãy đọc pinyin trước khi nhìn cách viết chữ Hán. Một âm tiết gồm phụ âm đầu + vần + thanh điệu.</p>
          </div>

          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
              <h3 className="font-bold text-white">Nguyên âm / vần thường gặp</h3>
              <div className="mt-5 flex flex-wrap gap-2">
                {["a", "o", "e", "i", "u", "ü", "ai", "ei", "ao", "ou", "an", "en", "ang", "eng", "ong"].map((item) => <span key={item} className="rounded-lg bg-slate-800 px-3 py-2 font-mono text-sm text-emerald-200">{item}</span>)}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
              <h3 className="font-bold text-white">Phụ âm đầu cần chú ý</h3>
              <div className="mt-5 flex flex-wrap gap-2">
                {["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "zh", "ch", "sh", "r", "z", "c", "s"].map((item) => <span key={item} className="rounded-lg bg-slate-800 px-3 py-2 font-mono text-sm text-amber-200">{item}</span>)}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Lưu ý: đây là bảng làm quen. Các âm j/q/x, zh/ch/sh/r và ü sẽ được luyện riêng ở các bài tiếp theo.</p>
        </div>
      </section>

      <section id="tu-vung" className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
        <div className="grid gap-9 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-300">6 từ đầu tiên</p>
            <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">Chạm để học, bấm nghe để luyện.</h2>
            <p className="mt-4 leading-7 text-slate-400">Hãy chọn một thẻ, tự đoán nghĩa rồi lật đáp án. Đừng lo nếu chưa nhớ chữ Hán — hiện tại pinyin và âm thanh quan trọng hơn.</p>

            <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {starterWords.map((word, index) => (
                <button key={word.hanzi} type="button" onClick={() => chooseWord(index)} className={`rounded-xl border px-4 py-3 text-left transition ${index === selectedWord ? "border-violet-300 bg-violet-500/15 text-white" : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"}`}>
                  <span className="chinese-text text-xl font-bold">{word.hanzi}</span>
                  <span className="ml-2 text-xs">{word.pinyin}</span>
                </button>
              ))}
            </div>
          </div>

          <article className="min-h-[340px] rounded-[2rem] border border-violet-300/20 bg-[linear-gradient(135deg,rgba(109,40,217,0.26),rgba(15,23,42,0.92)_55%)] p-7 shadow-xl shadow-violet-950/15 md:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">Thẻ từ vựng {selectedWord + 1}/6</p>
            <p className="chinese-text mt-8 text-7xl font-black text-white md:text-8xl">{currentWord.hanzi}</p>
            <p className="mt-3 text-2xl font-semibold text-violet-200">{currentWord.pinyin}</p>

            {showMeaning ? (
              <div className="mt-8 rounded-2xl bg-black/25 p-5">
                <p className="text-xl font-bold text-white">{currentWord.meaning}</p>
                <p className="chinese-text mt-2 text-sm leading-6 text-slate-300">{currentWord.example}</p>
              </div>
            ) : <p className="mt-8 text-sm text-slate-400">Bạn đoán nghĩa của từ này là gì?</p>}

            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => setShowMeaning((value) => !value)} className="rounded-xl bg-white px-4 py-3 font-bold text-slate-900 transition hover:bg-violet-100">{showMeaning ? "Ẩn đáp án" : "Lật đáp án"}</button>
              <button type="button" onClick={() => speakChinese(currentWord.hanzi)} className="rounded-xl border border-violet-200/30 bg-violet-950/30 px-4 py-3 font-bold text-violet-100 transition hover:bg-violet-900/50">Phát âm</button>
            </div>
          </article>
        </div>
      </section>

      <section id="kiem-tra" className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-5 py-14 text-center md:px-10 md:py-20">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-300">Kiểm tra 10 giây</p>
          <h2 className="mt-2 text-3xl font-black text-white">“你好” đọc là gì?</h2>
          <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            {quizOptions.map((option) => {
              const isCorrect = option === "nǐ hǎo";
              const isSelected = quizAnswer === option;
              const color = !isSelected ? "border-slate-700 bg-slate-900 hover:border-amber-300" : isCorrect ? "border-emerald-300 bg-emerald-500/15 text-emerald-100" : "border-rose-300 bg-rose-500/15 text-rose-100";

              return <button key={option} type="button" onClick={() => setQuizAnswer(option)} className={`rounded-2xl border px-4 py-4 font-semibold transition ${color}`}>{option}</button>;
            })}
          </div>
          {quizAnswer && <p className={`mt-6 font-semibold ${quizAnswer === "nǐ hǎo" ? "text-emerald-300" : "text-rose-300"}`}>{quizAnswer === "nǐ hǎo" ? "Chính xác! 你好 (nǐ hǎo) nghĩa là xin chào." : "Chưa đúng. Hãy thử lại: 你好 = nǐ hǎo."}</p>}
          <p className="mt-8 text-sm text-slate-500">Phần nghe dùng giọng nói có sẵn trên thiết bị. Trang hiện chưa cần API tiếng Trung; API chỉ cần khi bạn muốn thêm tra từ, AI hội thoại hoặc chấm phát âm.</p>
        </div>
      </section>
    </main>
  );
}
