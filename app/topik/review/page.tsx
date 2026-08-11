"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { createClient } from "@/utils/supabase/client";

type Rating = "again" | "hard" | "good" | "easy";
type Mistake = {
  id: string;
  exam_id: string;
  prompt: string;
  selected_answer: string;
  correct_answer: string;
  explanation: string;
  review_count: number;
  correct_count: number;
  wrong_count: number;
  interval_days: number;
  next_review_at: string | null;
  difficulty: Rating | null;
};

const RATINGS: { value: Rating; label: string; hint: string }[] = [
  { value: "again", label: "Again", hint: "10 phút" },
  { value: "hard", label: "Hard", hint: "1 ngày" },
  { value: "good", label: "Good", hint: "theo lịch" },
  { value: "easy", label: "Easy", hint: "dài hơn" },
];

function isDue(item: Mistake) {
  return !item.next_review_at || new Date(item.next_review_at).getTime() <= Date.now();
}

function nextInterval(rating: Rating, current: number) {
  if (rating === "again") return 10 / (60 * 24);
  if (rating === "hard") return Math.max(1, current * 1.5 || 1);
  if (rating === "easy") return Math.max(4, current * 3 || 4);
  return Math.max(1, current * 2 || 1);
}

export default function TopikReviewPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Mistake[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("topik_mistakes")
          .select("id,exam_id,prompt,selected_answer,correct_answer,explanation,review_count,correct_count,wrong_count,interval_days,next_review_at,difficulty")
          .eq("user_id", user.id)
          .order("next_review_at", { ascending: true, nullsFirst: true });

        if (cancelled) return;
        if (error) {
          setMessage("Hãy chạy migration TOPIK để bật bộ ôn câu sai.");
        } else {
          setItems((data || []) as Mistake[]);
        }
        setLoading(false);
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router, supabase]);

  const dueItems = items.filter(isDue);
  const current = dueItems[0];

  async function rate(rating: Rating) {
    if (!current || saving) return;

    setSaving(true);
    const interval = nextInterval(rating, Number(current.interval_days) || 0);
    const nextReviewDate = new Date();
    nextReviewDate.setTime(nextReviewDate.getTime() + interval * 24 * 60 * 60 * 1000);
    const nextReview = nextReviewDate.toISOString();
    const { error } = await supabase
      .from("topik_mistakes")
      .update({
        review_count: current.review_count + 1,
        correct_count: current.correct_count + (rating === "again" ? 0 : 1),
        wrong_count: current.wrong_count + (rating === "again" ? 1 : 0),
        last_reviewed_at: new Date().toISOString(),
        next_review_at: nextReview,
        interval_days: interval,
        difficulty: rating,
      })
      .eq("id", current.id);

    if (error) {
      setMessage(error.message);
    } else {
      setRevealed(false);
      setItems((old) => old.map((item) => item.id === current.id ? { ...item, next_review_at: nextReview, interval_days: interval, difficulty: rating, review_count: item.review_count + 1 } : item));
      setMessage("Đã ghi nhận lượt ôn câu sai.");
    }
    setSaving(false);
  }

  if (loading) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center text-slate-400">Đang tải bộ ôn TOPIK...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-rose-300">🧠 Spaced repetition</p>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">Ôn câu TOPIK sai</h1>
          <p className="mt-2 text-slate-500">Các câu trả lời sai được lưu riêng để bạn sửa đúng theo từng lần ôn.</p>
        </div>
        <Link href="/topik" className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300">← Về TOPIK</Link>
      </div>

      {message && <p className="mb-5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300" role="status">{message}</p>}

      {!current ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-4 text-xl font-bold">Hôm nay đã hết câu sai cần ôn</h2>
          <p className="mt-2 text-sm text-slate-400">Làm thêm đề TOPIK hoặc quay lại sau khi câu tiếp theo đến lịch.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-8">
          <div className="flex items-center justify-between text-sm text-slate-500"><span>1 / {dueItems.length}</span><span>{current.review_count} lượt ôn</span></div>
          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-6 md:p-10">
            <p className="text-xl font-bold text-white md:text-2xl">{current.prompt}</p>
            {!revealed ? (
              <button type="button" onClick={() => setRevealed(true)} className="mt-8 rounded-xl bg-white px-6 py-3 font-bold text-black">Hiện đáp án</button>
            ) : (
              <div className="mt-6 space-y-3 text-sm">
                <p className="text-rose-200">Bạn đã chọn: {current.selected_answer || "Chưa trả lời"}</p>
                <p className="text-emerald-200">Đáp án đúng: {current.correct_answer}</p>
                <p className="whitespace-pre-wrap leading-6 text-slate-300">{current.explanation || "Chưa có giải thích."}</p>
              </div>
            )}
          </div>
          {revealed && <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">{RATINGS.map((rating) => <button key={rating.value} type="button" disabled={saving} onClick={() => void rate(rating.value)} className="rounded-xl border border-slate-700 px-3 py-3 text-sm font-semibold hover:border-slate-400 disabled:opacity-50"><span className="block">{rating.label}</span><span className="text-xs text-slate-500">{rating.hint}</span></button>)}</div>}
        </div>
      )}
    </AppShell>
  );
}
