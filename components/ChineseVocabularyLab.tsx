"use client";

import { useEffect, useMemo, useState } from "react";
import {
  chineseLevelOptions,
  chineseVocabulary,
  type ChineseVocabularyLevel,
  type ChineseVocabularyWord,
} from "@/data/chinese-vocabulary";
import { speakChinese } from "@/utils/chinese-speech";

type StudyMode = "library" | "flashcards" | "quiz";

const STORAGE_KEY = "korean-study-chinese-mastered-v1";

function buildQuizOptions(
  word: ChineseVocabularyWord | undefined,
  source: ChineseVocabularyWord[],
  index: number
) {
  if (!word) return [];

  const distractors = source.filter((item) => item.id !== word.id);
  const selected = Array.from({ length: Math.min(3, distractors.length) }, (_, offset) =>
    distractors[(index * 3 + offset) % distractors.length]
  );
  const options = [word, ...selected];
  const rotation = index % options.length;

  return [...options.slice(rotation), ...options.slice(0, rotation)];
}

export default function ChineseVocabularyLab() {
  const [level, setLevel] = useState<ChineseVocabularyLevel>("foundation");
  const [topic, setTopic] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<StudyMode>("library");
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [masteredIds, setMasteredIds] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) setMasteredIds(parsed.filter((id): id is string => typeof id === "string"));
      } catch {
        // Learning still works when local storage is unavailable.
      } finally {
        setStorageReady(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(masteredIds));
    } catch {
      // Ignore storage errors in private browsing.
    }
  }, [masteredIds, storageReady]);

  const levelWords = useMemo(
    () => chineseVocabulary.filter((word) => word.level === level),
    [level]
  );
  const topics = useMemo(
    () => ["Tất cả", ...Array.from(new Set(levelWords.map((word) => word.topic)))],
    [levelWords]
  );
  const visibleWords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");

    return levelWords.filter((word) => {
      const matchesTopic = topic === "Tất cả" || word.topic === topic;
      const matchesQuery =
        !normalizedQuery ||
        [word.hanzi, word.pinyin, word.meaning, word.topic].some((value) =>
          value.toLocaleLowerCase("vi").includes(normalizedQuery)
        );

      return matchesTopic && matchesQuery;
    });
  }, [levelWords, query, topic]);

  const safeIndex = visibleWords.length ? activeIndex % visibleWords.length : 0;
  const currentWord = visibleWords[safeIndex];
  const currentLevel = chineseLevelOptions.find((item) => item.id === level) ?? chineseLevelOptions[0];
  const masteredInLevel = levelWords.filter((word) => masteredIds.includes(word.id)).length;
  const progress = levelWords.length ? Math.round((masteredInLevel / levelWords.length) * 100) : 0;
  const quizOptions = useMemo(
    () => buildQuizOptions(currentWord, levelWords, safeIndex),
    [currentWord, levelWords, safeIndex]
  );

  function resetCard() {
    setActiveIndex(0);
    setShowAnswer(false);
    setSelectedAnswer(null);
  }

  function selectLevel(nextLevel: ChineseVocabularyLevel) {
    setLevel(nextLevel);
    setTopic("Tất cả");
    setQuery("");
    resetCard();
  }

  function openWord(word: ChineseVocabularyWord) {
    const index = visibleWords.findIndex((item) => item.id === word.id);
    setActiveIndex(Math.max(0, index));
    setShowAnswer(false);
    setSelectedAnswer(null);
    setMode("flashcards");
  }

  function nextWord() {
    setActiveIndex((current) => (visibleWords.length ? (current + 1) % visibleWords.length : 0));
    setShowAnswer(false);
    setSelectedAnswer(null);
  }

  function toggleMastered(wordId: string) {
    setMasteredIds((current) =>
      current.includes(wordId) ? current.filter((id) => id !== wordId) : [...current, wordId]
    );
  }

  function answerQuiz(answerId: string) {
    if (!currentWord || selectedAnswer) return;
    setSelectedAnswer(answerId);
    setQuizTotal((value) => value + 1);
    if (answerId === currentWord.id) setQuizScore((value) => value + 1);
  }

  return (
    <section id="kho-tu" className="border-y border-cyan-300/15 bg-[#091225]">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-300">KHO HỌC TỪ VỰNG</p>
            <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">75 từ cốt lõi, tăng dần theo 5 cấp độ.</h2>
            <p className="mt-3 leading-7 text-slate-400">Mỗi từ có pinyin, phát âm, câu ví dụ và nghĩa tiếng Việt. Tiến độ đã thuộc được lưu ngay trên thiết bị này.</p>
          </div>
          <div className="grid min-w-[250px] grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3"><strong className="block text-xl text-white">{levelWords.length}</strong><span className="text-slate-500">Trong mức</span></div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3"><strong className="block text-xl text-emerald-200">{masteredInLevel}</strong><span className="text-slate-500">Đã thuộc</span></div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3"><strong className="block text-xl text-cyan-200">{progress}%</strong><span className="text-slate-500">Tiến độ</span></div>
          </div>
        </div>

        <div className="mt-8 grid gap-2 sm:grid-cols-5">
          {chineseLevelOptions.map((item) => (
            <button key={item.id} type="button" onClick={() => selectLevel(item.id)} className={`rounded-2xl border p-4 text-left transition ${level === item.id ? "border-cyan-300 bg-cyan-400/15 text-white" : "border-slate-800 bg-slate-950/45 text-slate-400 hover:border-slate-600"}`}>
              <strong className="block text-base">{item.label}</strong>
              <span className="mt-1 block text-xs leading-5 opacity-75">{item.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/65 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">{currentLevel.label}</p>
              <p className="mt-1 text-sm text-slate-400">{currentLevel.description}</p>
            </div>
            <div className="flex rounded-xl bg-slate-950 p-1">
              {([
                ["library", "Kho từ"],
                ["flashcards", "Thẻ học"],
                ["quiz", "Kiểm tra"],
              ] as Array<[StudyMode, string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => { setMode(value); resetCard(); }} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${mode === value ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:text-white"}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
            <input value={query} onChange={(event) => { setQuery(event.target.value); resetCard(); }} placeholder="Tìm chữ Hán, pinyin hoặc nghĩa tiếng Việt..." className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-300" />
            <select value={topic} onChange={(event) => { setTopic(event.target.value); resetCard(); }} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-300">
              {topics.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          {visibleWords.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-400">Không tìm thấy từ phù hợp. Hãy đổi từ khóa hoặc chủ đề.</div>
          ) : mode === "library" ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {visibleWords.map((word) => {
                const mastered = masteredIds.includes(word.id);
                return (
                  <button key={word.id} type="button" onClick={() => openWord(word)} className="group rounded-2xl border border-slate-800 bg-slate-950/55 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/60">
                    <div className="flex items-start justify-between gap-2">
                      <span lang="zh" className="chinese-text text-3xl font-black text-white">{word.hanzi}</span>
                      {mastered && <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-300">ĐÃ THUỘC</span>}
                    </div>
                    <p className="mt-2 font-semibold text-cyan-200">{word.pinyin}</p>
                    <p className="mt-2 text-sm text-slate-400">{word.meaning}</p>
                    <span className="mt-4 block text-[11px] uppercase tracking-wide text-slate-600 group-hover:text-cyan-300">{word.topic} · Mở thẻ →</span>
                  </button>
                );
              })}
            </div>
          ) : mode === "flashcards" && currentWord ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
              <aside className="rounded-2xl border border-slate-800 bg-slate-950/45 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">BỘ ĐANG HỌC</p>
                <p className="mt-2 text-2xl font-black text-white">{visibleWords.length} từ</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Hãy tự đọc và đoán nghĩa trước khi lật thẻ. Bấm “Đã thuộc” để lưu tiến độ.</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${((safeIndex + 1) / visibleWords.length) * 100}%` }} /></div>
                <p className="mt-2 text-xs text-slate-500">Thẻ {safeIndex + 1}/{visibleWords.length}</p>
              </aside>
              <article className="rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_80%_15%,rgba(34,211,238,0.16),transparent_35%),#070d1c] p-6 md:p-9">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p lang="zh" className="chinese-text text-6xl font-black text-white md:text-7xl">{currentWord.hanzi}</p><p className="mt-3 text-2xl font-bold text-cyan-200">{currentWord.pinyin}</p><p className="mt-2 text-xs uppercase tracking-wider text-slate-500">{currentWord.topic}</p></div>
                  <button type="button" onClick={() => speakChinese(currentWord.hanzi)} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2.5 font-bold text-cyan-100">🔊 Nghe phát âm</button>
                </div>
                {showAnswer ? (
                  <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/65 p-5">
                    <p className="text-xl font-bold text-white">{currentWord.meaning}</p>
                    <p lang="zh" className="chinese-text mt-4 text-lg text-slate-100">{currentWord.example}</p>
                    <p className="mt-2 text-sm text-slate-400">{currentWord.translation}</p>
                  </div>
                ) : <p className="mt-10 text-sm text-slate-500">Đọc thành tiếng và tự đoán nghĩa trước khi xem đáp án.</p>}
                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setShowAnswer((value) => !value)} className="rounded-xl bg-white px-4 py-3 font-bold text-slate-950">{showAnswer ? "Ẩn đáp án" : "Lật đáp án"}</button>
                  <button type="button" onClick={() => toggleMastered(currentWord.id)} className={`rounded-xl border px-4 py-3 font-bold ${masteredIds.includes(currentWord.id) ? "border-emerald-300 bg-emerald-400/15 text-emerald-200" : "border-slate-700 text-slate-300"}`}>{masteredIds.includes(currentWord.id) ? "✓ Đã thuộc" : "Đánh dấu đã thuộc"}</button>
                  <button type="button" onClick={nextWord} className="rounded-xl border border-cyan-300/30 px-4 py-3 font-bold text-cyan-100">Từ tiếp theo →</button>
                </div>
              </article>
            </div>
          ) : currentWord ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
              <aside className="rounded-2xl border border-slate-800 bg-slate-950/45 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">ĐIỂM LUYỆN TẬP</p>
                <p className="mt-3 text-4xl font-black text-white">{quizScore}/{quizTotal}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">Chọn nghĩa đúng. Sai cũng không bị trừ điểm; hệ thống sẽ hiện đáp án để bạn nhớ lại.</p>
              </aside>
              <article className="rounded-3xl border border-amber-300/20 bg-slate-950/65 p-6 md:p-9">
                <p className="text-sm font-semibold text-slate-400">Từ này có nghĩa là gì?</p>
                <div className="mt-5 flex flex-wrap items-center gap-4"><p lang="zh" className="chinese-text text-6xl font-black text-white">{currentWord.hanzi}</p><div><p className="text-xl font-bold text-amber-200">{currentWord.pinyin}</p><button type="button" onClick={() => speakChinese(currentWord.hanzi)} className="mt-2 text-sm font-semibold text-cyan-300">🔊 Nghe lại</button></div></div>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {quizOptions.map((option) => {
                    const isCorrect = option.id === currentWord.id;
                    const isSelected = selectedAnswer === option.id;
                    const stateClass = selectedAnswer ? isCorrect ? "border-emerald-300 bg-emerald-400/15 text-emerald-100" : isSelected ? "border-rose-300 bg-rose-400/15 text-rose-100" : "border-slate-800 text-slate-500" : "border-slate-700 bg-slate-900 text-slate-200 hover:border-amber-300";
                    return <button key={option.id} type="button" onClick={() => answerQuiz(option.id)} className={`rounded-xl border px-4 py-4 text-left font-semibold transition ${stateClass}`}>{option.meaning}</button>;
                  })}
                </div>
                {selectedAnswer && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className={selectedAnswer === currentWord.id ? "font-bold text-emerald-300" : "font-bold text-rose-300"}>{selectedAnswer === currentWord.id ? "Chính xác!" : `Đáp án đúng: ${currentWord.meaning}`}</p><button type="button" onClick={nextWord} className="rounded-xl bg-amber-300 px-4 py-2.5 font-bold text-slate-950">Câu tiếp theo →</button></div>}
              </article>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
