"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/utils/supabase/client";

type Rating = "again" | "hard" | "good" | "easy";

type Word = {
  id: string;
  targetCode?: string;
  korean: string;
  meaning: string;
  pronunciation?: string;
  partOfSpeech?: string;
  level?: string;
  categories?: string[];
  examples?: string[];

  status: "learning" | "mastered";

  reviewCount: number;
  correctCount: number;
  wrongCount: number;

  lastReviewedAt?: string;
  nextReviewAt?: string;

  difficulty?: Rating;
};

type VocabularyRow = {
  id: string;
  user_id: string;
  target_code: string | null;
  korean: string;
  meaning: string;
  pronunciation: string | null;
  part_of_speech: string | null;
  level: string | null;
  categories: unknown;
  examples: unknown;
  status: string;
  review_count: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  difficulty: string | null;
};

type Direction = "ko-vi" | "vi-ko";
type Filter = "all" | "learning" | "mastered";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string"
  );
}

function rowToWord(row: VocabularyRow): Word {
  let difficulty: Rating | undefined;

  if (
    row.difficulty === "again" ||
    row.difficulty === "hard" ||
    row.difficulty === "good" ||
    row.difficulty === "easy"
  ) {
    difficulty = row.difficulty;
  }

  return {
    id: row.id,

    targetCode:
      row.target_code || undefined,

    korean:
      row.korean || "",

    meaning:
      row.meaning || "",

    pronunciation:
      row.pronunciation || undefined,

    partOfSpeech:
      row.part_of_speech || undefined,

    level:
      row.level || undefined,

    categories:
      toStringArray(row.categories),

    examples:
      toStringArray(row.examples),

    status:
      row.status === "mastered"
        ? "mastered"
        : "learning",

    reviewCount:
      row.review_count || 0,

    correctCount:
      row.correct_count || 0,

    wrongCount:
      row.wrong_count || 0,

    lastReviewedAt:
      row.last_reviewed_at || undefined,

    nextReviewAt:
      row.next_review_at || undefined,

    difficulty,
  };
}

export default function FlashcardsPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [words, setWords] =
    useState<Word[]>([]);

  const [ready, setReady] =
    useState(false);

  const [direction, setDirection] =
    useState<Direction>("ko-vi");

  const [filter, setFilter] =
    useState<Filter>("all");

  const [deck, setDeck] =
    useState<Word[]>([]);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [revealed, setRevealed] =
    useState(false);

  const [started, setStarted] =
    useState(false);

  const [finished, setFinished] =
    useState(false);

  const [savingRating, setSavingRating] =
    useState(false);

  const [stats, setStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  /*
   * =========================================
   * TẢI TỪ VỰNG TỪ SUPABASE
   * =========================================
   */

  useEffect(() => {
    let cancelled = false;

    async function loadWords() {
      setReady(false);

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

      const {
        data,
        error,
      } = await supabase
        .from("vocabulary")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Lỗi tải flashcard:",
          error
        );

        alert(
          "Không tải được dữ liệu Flashcard."
        );

        setReady(true);

        return;
      }

      const rows =
        (data || []) as VocabularyRow[];

      setWords(
        rows.map(rowToWord)
      );

      setReady(true);
    }

    loadWords();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  /*
   * =========================================
   * BỘ LỌC
   * =========================================
   */

  const availableWords = useMemo(() => {
    if (filter === "all") {
      return words;
    }

    return words.filter(
      (word) =>
        word.status === filter
    );
  }, [words, filter]);

  /*
   * Những từ có thể ôn ngay:
   * - chưa từng có nextReviewAt
   * - hoặc đã tới hạn
   */

  const dueWords = useMemo(() => {
    const now = Date.now();

    return words.filter(
      (word) => {
        if (!word.nextReviewAt) {
          return true;
        }

        return (
          new Date(
            word.nextReviewAt
          ).getTime() <= now
        );
      }
    ).length;
  }, [words]);

  const currentWord =
    deck[currentIndex];

  /*
   * =========================================
   * TRỘN BỘ THẺ
   * =========================================
   */

  function shuffleWords(
    items: Word[]
  ) {
    const result = [...items];

    for (
      let i =
        result.length - 1;
      i > 0;
      i--
    ) {
      const j =
        Math.floor(
          Math.random() *
            (i + 1)
        );

      [result[i], result[j]] = [
        result[j],
        result[i],
      ];
    }

    return result;
  }

  /*
   * =========================================
   * BẮT ĐẦU ÔN
   * =========================================
   */

  function startSession() {
    if (
      availableWords.length === 0
    ) {
      alert(
        "Không có từ phù hợp với bộ lọc này."
      );

      return;
    }

    setDeck(
      shuffleWords(
        availableWords
      )
    );

    setCurrentIndex(0);
    setRevealed(false);
    setStarted(true);
    setFinished(false);

    setStats({
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
    });
  }

  /*
   * =========================================
   * CHẤM MỨC ĐỘ NHỚ
   * =========================================
   */

  async function rateWord(
    rating: Rating
  ) {
    if (
      !currentWord ||
      savingRating
    ) {
      return;
    }

    setSavingRating(true);

    const now = new Date();

    const nextReview =
      new Date(now);

    let correctIncrease = 0;
    let wrongIncrease = 0;

    if (rating === "again") {
      nextReview.setMinutes(
        nextReview.getMinutes() +
          10
      );

      wrongIncrease = 1;
    }

    if (rating === "hard") {
      nextReview.setDate(
        nextReview.getDate() +
          1
      );
    }

    if (rating === "good") {
      nextReview.setDate(
        nextReview.getDate() +
          3
      );

      correctIncrease = 1;
    }

    if (rating === "easy") {
      nextReview.setDate(
        nextReview.getDate() +
          7
      );

      correctIncrease = 1;
    }

    const nextCorrect =
      currentWord.correctCount +
      correctIncrease;

    const nextWrong =
      currentWord.wrongCount +
      wrongIncrease;

    const nextReviewCount =
      currentWord.reviewCount + 1;

    let nextStatus =
      currentWord.status;

    if (rating === "again") {
      nextStatus = "learning";
    }

    if (
      rating === "easy" &&
      nextCorrect >= 3
    ) {
      nextStatus = "mastered";
    }

    /*
     * LƯU TRỰC TIẾP LÊN SUPABASE
     */

    const { error } =
      await supabase
        .from("vocabulary")
        .update({
          status:
            nextStatus,

          review_count:
            nextReviewCount,

          correct_count:
            nextCorrect,

          wrong_count:
            nextWrong,

          difficulty:
            rating,

          last_reviewed_at:
            now.toISOString(),

          next_review_at:
            nextReview.toISOString(),
        })
        .eq(
          "id",
          currentWord.id
        );

    if (error) {
      console.error(
        "Lỗi cập nhật lịch ôn:",
        error
      );

      alert(
        "Không lưu được kết quả ôn."
      );

      setSavingRating(false);

      return;
    }

    /*
     * CẬP NHẬT STATE LOCAL
     * SAU KHI SUPABASE THÀNH CÔNG
     */

    const updatedWord: Word = {
      ...currentWord,

      status:
        nextStatus,

      reviewCount:
        nextReviewCount,

      correctCount:
        nextCorrect,

      wrongCount:
        nextWrong,

      difficulty:
        rating,

      lastReviewedAt:
        now.toISOString(),

      nextReviewAt:
        nextReview.toISOString(),
    };

    setWords(
      (oldWords) =>
        oldWords.map(
          (word) =>
            word.id ===
            currentWord.id
              ? updatedWord
              : word
        )
    );

    /*
     * Deck cũng cập nhật
     * để dữ liệu trong phiên
     * không bị cũ.
     */

    setDeck(
      (oldDeck) =>
        oldDeck.map(
          (word) =>
            word.id ===
            currentWord.id
              ? updatedWord
              : word
        )
    );

    setStats((old) => ({
      ...old,
      [rating]:
        old[rating] + 1,
    }));

    setSavingRating(false);

    goNext();
  }

  /*
   * =========================================
   * SANG THẺ TIẾP THEO
   * =========================================
   */

  function goNext() {
    setRevealed(false);

    if (
      currentIndex + 1 >=
      deck.length
    ) {
      setFinished(true);

      return;
    }

    setCurrentIndex(
      currentIndex + 1
    );
  }

  /*
   * =========================================
   * PHÁT ÂM
   * =========================================
   */

  function speak(
    text: string
  ) {
    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.lang =
      "ko-KR";

    utterance.rate =
      0.9;

    window.speechSynthesis.speak(
      utterance
    );
  }

  function restart() {
    startSession();
  }

  /*
   * =========================================
   * LOADING
   * =========================================
   */

  if (!ready) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <div className="text-5xl">
              🧠
            </div>

            <p className="mt-4 font-semibold">
              Đang tải Flashcard...
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Đang đồng bộ dữ liệu
              từ Supabase.
            </p>

          </div>

        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* HEADER */}

      <div className="mb-8">
        <p className="text-slate-400">
          단어 복습
        </p>

        <h1 className="text-3xl font-bold md:text-4xl">
          🧠 Flashcard
        </h1>

        <p className="mt-2 text-slate-500">
          Ôn từ vựng và ghi lại mức độ
          nhớ của bạn.
        </p>
      </div>

      {/* STATS */}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">

        <Stat
          title="📚 Tổng từ"
          value={words.length}
        />

        <Stat
          title="🔁 Có thể ôn"
          value={dueWords}
        />

        <Stat
          title="🟡 Đang học"
          value={
            words.filter(
              (word) =>
                word.status ===
                "learning"
            ).length
          }
        />

        <Stat
          title="🟢 Đã thuộc"
          value={
            words.filter(
              (word) =>
                word.status ===
                "mastered"
            ).length
          }
        />

      </div>

      {/* SETUP */}

      {!started && (
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">

          <div className="text-center">

            <div className="text-6xl">
              🧠
            </div>

            <h2 className="mt-5 text-2xl font-bold">
              Bắt đầu ôn từ
            </h2>

            <p className="mt-2 text-slate-500">
              Chọn cách hỏi và bộ từ bạn
              muốn luyện.
            </p>

          </div>

          {/* DIRECTION */}

          <div className="mt-8">

            <p className="mb-3 text-sm font-semibold text-slate-400">
              Cách hỏi
            </p>

            <div className="grid grid-cols-2 gap-3">

              <button
                onClick={() =>
                  setDirection(
                    "ko-vi"
                  )
                }
                className={`rounded-2xl p-4 ${
                  direction === "ko-vi"
                    ? "bg-white text-black"
                    : "bg-slate-950 text-slate-300"
                }`}
              >
                🇰🇷 → 🇻🇳

                <div className="mt-1 text-xs opacity-70">
                  Hàn sang Việt
                </div>
              </button>

              <button
                onClick={() =>
                  setDirection(
                    "vi-ko"
                  )
                }
                className={`rounded-2xl p-4 ${
                  direction === "vi-ko"
                    ? "bg-white text-black"
                    : "bg-slate-950 text-slate-300"
                }`}
              >
                🇻🇳 → 🇰🇷

                <div className="mt-1 text-xs opacity-70">
                  Việt sang Hàn
                </div>
              </button>

            </div>
          </div>

          {/* FILTER */}

          <div className="mt-6">

            <p className="mb-3 text-sm font-semibold text-slate-400">
              Bộ từ
            </p>

            <div className="grid grid-cols-3 gap-2">

              <FilterButton
                active={
                  filter === "all"
                }
                onClick={() =>
                  setFilter(
                    "all"
                  )
                }
              >
                Tất cả
              </FilterButton>

              <FilterButton
                active={
                  filter ===
                  "learning"
                }
                onClick={() =>
                  setFilter(
                    "learning"
                  )
                }
              >
                🟡 Đang học
              </FilterButton>

              <FilterButton
                active={
                  filter ===
                  "mastered"
                }
                onClick={() =>
                  setFilter(
                    "mastered"
                  )
                }
              >
                🟢 Đã thuộc
              </FilterButton>

            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-center">

            <p className="text-sm text-slate-500">
              Số thẻ trong bộ
            </p>

            <p className="mt-1 text-3xl font-bold">
              {
                availableWords.length
              }
            </p>

          </div>

          <button
            onClick={startSession}
            className="mt-6 w-full rounded-2xl bg-white py-4 text-lg font-bold text-black"
          >
            🚀 Bắt đầu
          </button>

          {words.length === 0 && (
            <p className="mt-4 text-center text-sm text-amber-400">
              Bạn chưa lưu từ nào. Qua
              mục Từ vựng để lưu từ
              trước nhé.
            </p>
          )}

        </div>
      )}

      {/* FLASHCARD */}

      {started &&
        !finished &&
        currentWord && (
          <div className="mx-auto max-w-3xl">

            {/* PROGRESS */}

            <div className="mb-4 flex items-center justify-between text-sm text-slate-500">

              <span>
                Thẻ{" "}
                {currentIndex + 1} /{" "}
                {deck.length}
              </span>

              <span>
                {Math.round(
                  ((currentIndex +
                    1) /
                    deck.length) *
                    100
                )}
                %
              </span>

            </div>

            <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-800">

              <div
                className="h-full rounded-full bg-white transition-all"
                style={{
                  width: `${
                    ((currentIndex +
                      1) /
                      deck.length) *
                    100
                  }%`,
                }}
              />

            </div>

            {/* CARD */}

            <div className="min-h-[420px] rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-10">

              <div className="flex justify-between">

                <div className="flex gap-2">

                  {currentWord.level && (
                    <Badge>
                      {
                        currentWord.level
                      }
                    </Badge>
                  )}

                  {currentWord.partOfSpeech && (
                    <Badge>
                      {
                        currentWord.partOfSpeech
                      }
                    </Badge>
                  )}

                </div>

                <button
                  onClick={() =>
                    speak(
                      currentWord.korean
                    )
                  }
                  className="rounded-xl bg-slate-800 px-4 py-2"
                >
                  🔊
                </button>

              </div>

              {/* QUESTION */}

              <div className="flex min-h-[220px] flex-col items-center justify-center text-center">

                <p className="text-sm text-slate-500">
                  {direction ===
                  "ko-vi"
                    ? "Từ này nghĩa là gì?"
                    : "Từ tiếng Hàn là gì?"}
                </p>

                <h2 className="mt-5 break-words text-4xl font-bold md:text-5xl">
                  {direction ===
                  "ko-vi"
                    ? currentWord.korean
                    : currentWord.meaning}
                </h2>

                {direction ===
                  "ko-vi" &&
                  currentWord.pronunciation && (
                    <p className="mt-3 text-slate-500">
                      [
                      {
                        currentWord.pronunciation
                      }
                      ]
                    </p>
                  )}

              </div>

              {/* ANSWER */}

              {!revealed ? (
                <button
                  onClick={() =>
                    setRevealed(true)
                  }
                  className="w-full rounded-2xl bg-white py-4 font-bold text-black"
                >
                  👀 Xem đáp án
                </button>
              ) : (
                <div>

                  <div className="rounded-2xl bg-slate-950 p-6 text-center">

                    <p className="text-sm text-slate-500">
                      Đáp án
                    </p>

                    <p className="mt-3 text-3xl font-bold">
                      {direction ===
                      "ko-vi"
                        ? currentWord.meaning
                        : currentWord.korean}
                    </p>

                    {direction ===
                      "vi-ko" &&
                      currentWord.pronunciation && (
                        <p className="mt-2 text-slate-500">
                          [
                          {
                            currentWord.pronunciation
                          }
                          ]
                        </p>
                      )}

                    {currentWord.examples &&
                      currentWord.examples
                        .length >
                        0 && (
                        <div className="mt-5 border-t border-slate-800 pt-5 text-left">

                          <p className="text-xs text-slate-500">
                            Ví dụ
                          </p>

                          <p className="mt-2 leading-7 text-slate-300">
                            🇰🇷{" "}
                            {
                              currentWord
                                .examples[0]
                            }
                          </p>

                        </div>
                      )}

                  </div>

                  {/* RATING */}

                  <p className="mb-3 mt-6 text-center text-sm text-slate-500">
                    Bạn nhớ từ này thế
                    nào?
                  </p>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                    <RateButton
                      title="😵 Không nhớ"
                      subtitle="10 phút"
                      disabled={
                        savingRating
                      }
                      onClick={() =>
                        rateWord(
                          "again"
                        )
                      }
                    />

                    <RateButton
                      title="😐 Khó"
                      subtitle="1 ngày"
                      disabled={
                        savingRating
                      }
                      onClick={() =>
                        rateWord(
                          "hard"
                        )
                      }
                    />

                    <RateButton
                      title="🙂 Nhớ"
                      subtitle="3 ngày"
                      disabled={
                        savingRating
                      }
                      onClick={() =>
                        rateWord(
                          "good"
                        )
                      }
                    />

                    <RateButton
                      title="😎 Dễ"
                      subtitle="7 ngày"
                      disabled={
                        savingRating
                      }
                      onClick={() =>
                        rateWord(
                          "easy"
                        )
                      }
                    />

                  </div>

                  {savingRating && (
                    <p className="mt-4 text-center text-sm text-slate-500">
                      ☁️ Đang lưu kết quả...
                    </p>
                  )}

                </div>
              )}

            </div>

          </div>
        )}

      {/* RESULT */}

      {finished && (
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">

          <div className="text-6xl">
            🎉
          </div>

          <h2 className="mt-5 text-3xl font-bold">
            Hoàn thành!
          </h2>

          <p className="mt-2 text-slate-500">
            Bạn vừa ôn{" "}
            {deck.length} từ.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">

            <ResultStat
              title="😵 Quên"
              value={
                stats.again
              }
            />

            <ResultStat
              title="😐 Khó"
              value={
                stats.hard
              }
            />

            <ResultStat
              title="🙂 Nhớ"
              value={
                stats.good
              }
            />

            <ResultStat
              title="😎 Dễ"
              value={
                stats.easy
              }
            />

          </div>

          <button
            onClick={restart}
            className="mt-8 rounded-2xl bg-white px-8 py-4 font-bold text-black"
          >
            🔁 Ôn lại
          </button>

          <button
            onClick={() => {
              setStarted(false);
              setFinished(false);
            }}
            className="ml-3 mt-8 rounded-2xl bg-slate-800 px-8 py-4 font-bold"
          >
            ⚙️ Đổi bộ từ
          </button>

        </div>
      )}

    </AppShell>
  );
}

function Stat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">

      <p className="text-xs text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>

    </div>
  );
}

function Badge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
      {children}
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children:
    React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-sm ${
        active
          ? "bg-white font-semibold text-black"
          : "bg-slate-950 text-slate-400"
      }`}
    >
      {children}
    </button>
  );
}

function RateButton({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl border border-slate-700 bg-slate-950 p-4 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >

      <p className="font-semibold">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Ôn lại: {subtitle}
      </p>

    </button>
  );
}

function ResultStat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-4">

      <p className="text-sm text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>

    </div>
  );
}