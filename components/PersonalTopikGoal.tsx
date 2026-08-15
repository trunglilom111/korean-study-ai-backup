"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/utils/api-client";
import { speakKorean } from "@/utils/speech";
import {
  TOPIK_FIRST_MONTH_DAYS,
  TOPIK_TARGET_ACCURACY,
  emptyTopikDailyProgress,
  getSeoulDate,
  type TopikDailyProgress,
  type TopikPersonalPlanResponse,
} from "@/utils/topik-personal-plan";

const START_DATE_KEY = "topik-personal-plan-start-date";

function lessonCacheKey(date: string) {
  return `topik-personal-lesson-${date}`;
}

function progressCacheKey(date: string) {
  return `topik-personal-progress-${date}`;
}

function readJson<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The server remains the primary store when local storage is unavailable.
  }
}

export default function PersonalTopikGoal() {
  const [plan, setPlan] = useState<TopikPersonalPlanResponse | null>(null);
  const [progress, setProgress] = useState<TopikDailyProgress>(emptyTopikDailyProgress);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showListeningScript, setShowListeningScript] = useState(false);
  const [showListeningAnswer, setShowListeningAnswer] = useState(false);
  const [showReadingAnswer, setShowReadingAnswer] = useState(false);
  const [showWritingGuide, setShowWritingGuide] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTodayLesson() {
      const today = getSeoulDate();
      let startDate = window.localStorage.getItem(START_DATE_KEY);
      if (!startDate) {
        startDate = today;
        window.localStorage.setItem(START_DATE_KEY, startDate);
      }

      const cachedPlan = readJson<TopikPersonalPlanResponse>(lessonCacheKey(today));
      const cachedProgress = readJson<TopikDailyProgress>(progressCacheKey(today));
      if (cachedPlan?.ok && !cancelled) {
        setPlan(cachedPlan);
        setProgress(cachedProgress || cachedPlan.progress || emptyTopikDailyProgress);
        setLoading(false);
        if (!cachedPlan.persisted) return;
      }

      try {
        const response = await apiFetch(`/api/topik/personal-plan?start=${encodeURIComponent(startDate)}`);
        const data = (await response.json()) as TopikPersonalPlanResponse;
        if (!response.ok || !data.ok) throw new Error(data.error || "Chưa thể chuẩn bị bài TOPIK hôm nay.");
        if (cancelled) return;

        window.localStorage.setItem(START_DATE_KEY, data.startDate);
        writeJson(lessonCacheKey(data.studyDate), data);
        const localProgress = readJson<TopikDailyProgress>(progressCacheKey(data.studyDate));
        setPlan(data);
        setProgress(localProgress || data.progress || emptyTopikDailyProgress);
        setError("");
      } catch (loadError) {
        if (!cancelled && !cachedPlan) {
          setError(loadError instanceof Error ? loadError.message : "Chưa thể tải bài TOPIK hôm nay.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTodayLesson();
    return () => {
      cancelled = true;
    };
  }, []);

  const completion = useMemo(() => {
    if (!plan) return 0;
    const lesson = plan.lesson;
    const contentTotal = lesson.vocabulary.length + lesson.grammar.length;
    const contentDone = progress.vocabularyCompleted.length + progress.grammarCompleted.length;
    const skillTotal = plan.phase === "topik-i" ? 2 : 1;
    const skillDone = plan.phase === "topik-i"
      ? Number(progress.listeningScore > 0) + Number(progress.readingScore > 0)
      : plan.phase === "reading"
        ? Number(progress.readingScore > 0)
        : plan.phase === "listening"
          ? Number(progress.listeningScore > 0)
          : Number(progress.writingCompleted);

    return Math.round(((contentDone + skillDone) / Math.max(1, contentTotal + skillTotal)) * 100);
  }, [plan, progress]);

  function saveProgress(next: TopikDailyProgress) {
    if (!plan) return;
    setProgress(next);
    writeJson(progressCacheKey(plan.studyDate), next);
    void apiFetch("/api/topik/personal-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyDate: plan.studyDate, progress: next }),
    });
  }

  function toggleVocabulary(word: string) {
    const current = progress.vocabularyCompleted;
    saveProgress({
      ...progress,
      vocabularyCompleted: current.includes(word) ? current.filter((item) => item !== word) : [...current, word],
    });
  }

  function toggleGrammar(pattern: string) {
    const current = progress.grammarCompleted;
    saveProgress({
      ...progress,
      grammarCompleted: current.includes(pattern) ? current.filter((item) => item !== pattern) : [...current, pattern],
    });
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6">
        <p className="animate-pulse font-semibold text-amber-200">Đang tự chuẩn bị bài TOPIK hôm nay...</p>
        <p className="mt-2 text-sm text-slate-500">Hệ thống đang chọn từ mới, ngữ pháp và bài luyện theo đúng ngày trong lộ trình.</p>
      </section>
    );
  }

  if (error || !plan) {
    return (
      <section className="mt-6 rounded-3xl border border-rose-400/25 bg-rose-400/5 p-6">
        <p className="font-bold text-rose-200">Chưa tạo được bài học tự động hôm nay.</p>
        <p className="mt-2 text-sm text-slate-400">{error || "Hãy tải lại trang sau ít phút."}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl border border-rose-300/30 px-4 py-2 text-sm font-bold text-rose-200">Thử lại</button>
      </section>
    );
  }

  const monthProgress = Math.min(100, Math.round((plan.dayNumber / TOPIK_FIRST_MONTH_DAYS) * 100));
  const lesson = plan.lesson;

  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(120,53,15,0.28),rgba(15,23,42,0.98)_48%,rgba(30,41,59,0.96))] shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-200">MỤC TIÊU RIÊNG · ADMIN</span>
              <span className="rounded-full border border-slate-600 bg-slate-950/40 px-3 py-1 text-xs font-bold text-slate-300">Ngày {plan.dayNumber}</span>
              <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">{plan.phaseLabel}</span>
            </div>
            <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">{lesson.title}</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-300">{lesson.objective}</p>
          </div>
          <div className="min-w-[190px] rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Hoàn thành hôm nay</p>
            <p className="mt-2 text-4xl font-black text-amber-300">{completion}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${completion}%` }} /></div>
          </div>
        </div>

        {plan.dayNumber <= TOPIK_FIRST_MONTH_DAYS ? (
          <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-emerald-200">Tháng đầu: đạt TOPIK I cấp 2</p><p className="mt-1 text-sm text-slate-400">Mục tiêu nghe và đọc hiểu: tối thiểu {plan.targetAccuracy}%.</p></div><strong className="text-2xl text-emerald-300">{monthProgress}% tháng</strong></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${monthProgress}%` }} /></div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-400/5 p-4"><p className="font-bold text-violet-200">Giai đoạn TOPIK II</p><p className="mt-1 text-sm text-slate-400">Hệ thống đang đi lần lượt theo chu kỳ 10 ngày đọc → 10 ngày nghe → 10 ngày viết.</p></div>
        )}

        {!plan.persisted && <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100/80">Bài hôm nay vẫn dùng được và đang lưu trên thiết bị. Chạy migration mới để đồng bộ bài và tiến độ theo tài khoản trên mọi thiết bị.</p>}
      </div>

      <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">TỪ VỰNG HÔM NAY</p><h3 className="mt-1 text-2xl font-black text-white">{lesson.vocabulary.length} từ mới</h3></div><span className="text-sm text-slate-500">{progress.vocabularyCompleted.length}/{lesson.vocabulary.length} đã ôn</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {lesson.vocabulary.map((word) => {
              const done = progress.vocabularyCompleted.includes(word.korean);
              return (
                <article key={word.korean} className={`rounded-2xl border p-4 transition ${done ? "border-emerald-300/30 bg-emerald-400/8" : "border-slate-800 bg-slate-950/50"}`}>
                  <div className="flex items-start justify-between gap-3"><div><p lang="ko" className="text-2xl font-black text-white">{word.korean}</p><p className="mt-1 text-sm font-semibold text-amber-200">{word.meaning}</p></div><button type="button" onClick={() => speakKorean(word.korean)} aria-label={`Nghe ${word.korean}`} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm">🔊</button></div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-600">{word.partOfSpeech}</p>
                  <p lang="ko" className="mt-2 text-sm text-slate-300">{word.exampleKorean}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{word.exampleVietnamese}</p>
                  <button type="button" onClick={() => toggleVocabulary(word.korean)} className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs font-bold ${done ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-slate-700 text-slate-400"}`}>{done ? "✓ Đã ôn" : "Đánh dấu đã ôn"}</button>
                </article>
              );
            })}
          </div>
        </div>

        <div>
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">NGỮ PHÁP HÔM NAY</p><h3 className="mt-1 text-2xl font-black text-white">{lesson.grammar.length} mẫu cần dùng được</h3></div>
          <div className="mt-4 space-y-3">
            {lesson.grammar.map((grammar) => {
              const done = progress.grammarCompleted.includes(grammar.pattern);
              return (
                <article key={grammar.pattern} className={`rounded-2xl border p-4 ${done ? "border-emerald-300/30 bg-emerald-400/8" : "border-slate-800 bg-slate-950/50"}`}>
                  <div className="flex items-start justify-between gap-3"><div><p lang="ko" className="text-xl font-black text-violet-200">{grammar.pattern}</p><p className="mt-1 font-semibold text-white">{grammar.meaning}</p></div><button type="button" onClick={() => toggleGrammar(grammar.pattern)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${done ? "border-emerald-300/30 text-emerald-200" : "border-slate-700 text-slate-400"}`}>{done ? "✓ Xong" : "Đã học"}</button></div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{grammar.usage}</p>
                  <div className="mt-3 rounded-xl bg-slate-950/70 p-3"><p lang="ko" className="text-sm text-slate-200">{grammar.exampleKorean}</p><p className="mt-1 text-xs text-slate-500">{grammar.exampleVietnamese}</p></div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">LUYỆN KỸ NĂNG TRONG NGÀY</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <SkillPracticeCard title="Nghe" accent="sky" task={lesson.listening} showContent={showListeningScript} showAnswer={showListeningAnswer} onToggleContent={() => setShowListeningScript((value) => !value)} onToggleAnswer={() => setShowListeningAnswer((value) => !value)} onSpeak={() => speakKorean(lesson.listening.content, { rate: 0.85 })} score={progress.listeningScore} onScore={(value) => saveProgress({ ...progress, listeningScore: value })} target={TOPIK_TARGET_ACCURACY} />
          <SkillPracticeCard title="Đọc" accent="emerald" task={lesson.reading} showContent showAnswer={showReadingAnswer} onToggleAnswer={() => setShowReadingAnswer((value) => !value)} score={progress.readingScore} onScore={(value) => saveProgress({ ...progress, readingScore: value })} target={TOPIK_TARGET_ACCURACY} />
          <article className={`rounded-2xl border p-5 ${plan.phase === "writing" ? "border-violet-300/35 bg-violet-400/10" : "border-slate-800 bg-slate-950/45"}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-300">VIẾT {plan.phase === "writing" ? "· TRỌNG TÂM" : "· CỦNG CỐ"}</p>
            <h4 className="mt-2 text-lg font-bold text-white">{lesson.writing.title}</h4>
            <p className="mt-3 text-sm leading-6 text-slate-300">{lesson.writing.question}</p>
            <button type="button" onClick={() => setShowWritingGuide((value) => !value)} className="mt-4 text-sm font-bold text-violet-300">{showWritingGuide ? "Ẩn hướng dẫn" : "Xem khung tự chấm"}</button>
            {showWritingGuide && <div className="mt-3 rounded-xl bg-slate-950/70 p-3 text-sm leading-6 text-slate-400"><p>{lesson.writing.content}</p><p className="mt-2 border-t border-slate-800 pt-2 text-violet-200">{lesson.writing.answerGuide}</p></div>}
            <button type="button" onClick={() => saveProgress({ ...progress, writingCompleted: !progress.writingCompleted })} className={`mt-4 w-full rounded-xl border px-3 py-2.5 text-sm font-bold ${progress.writingCompleted ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-slate-700 text-slate-400"}`}>{progress.writingCompleted ? "✓ Đã hoàn thành bài viết" : "Đánh dấu đã viết"}</button>
          </article>
        </div>
      </div>
    </section>
  );
}

function SkillPracticeCard({
  title,
  accent,
  task,
  showContent,
  showAnswer,
  onToggleContent,
  onToggleAnswer,
  onSpeak,
  score,
  onScore,
  target,
}: {
  title: string;
  accent: "sky" | "emerald";
  task: TopikPersonalPlanResponse["lesson"]["listening"];
  showContent: boolean;
  showAnswer: boolean;
  onToggleContent?: () => void;
  onToggleAnswer: () => void;
  onSpeak?: () => void;
  score: number;
  onScore: (value: number) => void;
  target: number;
}) {
  const color = accent === "sky" ? "text-sky-300 border-sky-300/30 bg-sky-400/10" : "text-emerald-300 border-emerald-300/30 bg-emerald-400/10";
  return (
    <article className={`rounded-2xl border p-5 ${score >= target ? color : "border-slate-800 bg-slate-950/45"}`}>
      <div className="flex items-center justify-between gap-3"><p className={`text-xs font-bold uppercase tracking-wider ${accent === "sky" ? "text-sky-300" : "text-emerald-300"}`}>{title}</p>{score > 0 && <strong className={score >= target ? "text-emerald-300" : "text-amber-300"}>{score}%</strong>}</div>
      <h4 className="mt-2 text-lg font-bold text-white">{task.title}</h4>
      <p className="mt-3 text-sm leading-6 text-slate-300">{task.question}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {onSpeak && <button type="button" onClick={onSpeak} className="rounded-lg border border-sky-300/30 px-3 py-2 text-xs font-bold text-sky-200">🔊 Nghe bài</button>}
        {onToggleContent && <button type="button" onClick={onToggleContent} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">{showContent ? "Ẩn kịch bản" : "Hiện kịch bản"}</button>}
      </div>
      {showContent && <p lang="ko" className="mt-4 rounded-xl bg-slate-950/70 p-3 text-sm leading-7 text-slate-300">{task.content}</p>}
      <button type="button" onClick={onToggleAnswer} className="mt-4 text-xs font-bold text-amber-300">{showAnswer ? "Ẩn đáp án" : "Xem hướng dẫn đáp án"}</button>
      {showAnswer && <p className="mt-2 rounded-xl bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/80">{task.answerGuide}</p>}
      <div className="mt-4 border-t border-slate-800 pt-4"><p className="text-xs text-slate-500">Tự chấm mức hiểu</p><div className="mt-2 grid grid-cols-5 gap-1.5">{[60, 70, 80, 90, 100].map((value) => <button key={value} type="button" onClick={() => onScore(value)} className={`rounded-lg border px-1 py-2 text-xs font-bold ${score === value ? color : "border-slate-800 text-slate-500"}`}>{value}</button>)}</div></div>
    </article>
  );
}
