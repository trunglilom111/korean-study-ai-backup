"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/utils/api-client";

type Rating = "again" | "hard" | "good" | "easy";
type ProgressRow = {
  vocabulary_id: string;
  status: string;
  next_review_at: string | null;
};

export type CollectionStudyItem = {
  vocabularyId: string;
  vocabulary?: {
    korean?: string;
    meaning?: string;
    pronunciation?: string;
    examples?: string[];
  };
};

const RATINGS: { value: Rating; label: string; hint: string }[] = [
  { value: "again", label: "Again", hint: "10 phút" },
  { value: "hard", label: "Hard", hint: "1 ngày" },
  { value: "good", label: "Good", hint: "theo lịch" },
  { value: "easy", label: "Easy", hint: "dài hơn" },
];

export default function CollectionStudy({
  collectionId,
  title,
  items,
  onClose,
}: {
  collectionId: string;
  title: string;
  items: CollectionStudyItem[];
  onClose: () => void;
}) {
  const [deck, setDeck] = useState(items);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const current = deck[0];

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void apiFetch(`/api/collections/${collectionId}/progress`)
        .then(async (response) => {
          if (!response.ok) return;
          const payload = (await response.json()) as { progress?: ProgressRow[] };
          const progressByWord = new Map((payload.progress || []).map((item) => [item.vocabulary_id, item]));
          const now = Date.now();
          if (active) {
            setDeck(items.filter((item) => {
              const progress = progressByWord.get(item.vocabularyId);
              return !progress || progress.status !== "mastered" && (!progress.next_review_at || new Date(progress.next_review_at).getTime() <= now);
            }));
          }
        })
        .catch(() => undefined);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [collectionId, items]);

  async function rate(rating: Rating) {
    if (!current || saving) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/collections/${collectionId}/progress/${current.vocabularyId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating }),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Không thể lưu tiến độ bộ từ.");
      }

      setDeck((previous) => previous.slice(1));
      setRevealed(false);
      setMessage("Đã ghi nhận lượt ôn.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu tiến độ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Luyện bộ từ</p>
          <p className="mt-1 font-semibold text-white">{title}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">
          Đóng
        </button>
      </div>

      {!current ? (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
          Đã ôn hết các từ trong bộ này. Bạn có thể quay lại sau khi đến lịch tiếp theo.
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-5 text-center">
            <p className="text-3xl font-black text-white">{current.vocabulary?.korean || "Từ vựng"}</p>
            {current.vocabulary?.pronunciation && <p className="mt-2 text-sm text-slate-500">{current.vocabulary.pronunciation}</p>}
            {!revealed ? (
              <button type="button" onClick={() => setRevealed(true)} className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black">
                Hiện nghĩa
              </button>
            ) : (
              <div className="mt-5 text-left">
                <p className="text-lg font-bold text-emerald-300">{current.vocabulary?.meaning || "Chưa có nghĩa."}</p>
                {current.vocabulary?.examples?.length ? (
                  <div className="mt-3 space-y-1 text-sm text-slate-400">
                    {current.vocabulary.examples.slice(0, 2).map((example) => <p key={example}>{example}</p>)}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          {revealed && <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">{RATINGS.map((rating) => <button key={rating.value} type="button" disabled={saving} onClick={() => void rate(rating.value)} className="rounded-xl border border-slate-700 px-2 py-2.5 text-sm font-semibold hover:border-slate-400 disabled:opacity-50"><span className="block">{rating.label}</span><span className="text-xs text-slate-500">{rating.hint}</span></button>)}</div>}
          <p className="mt-3 text-xs text-slate-500">Còn {deck.length} từ trong lượt này.</p>
        </>
      )}

      {message && <p className="mt-3 text-sm text-slate-400" role="status">{message}</p>}
    </div>
  );
}
