"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { createClient } from "@/utils/supabase/client";

type Rating =
  | "again"
  | "hard"
  | "good"
  | "easy";

type Direction =
  | "ko-vi"
  | "vi-ko";

type Word = {
  id: string;

  targetCode?: string;

  korean: string;
  meaning: string;

  pronunciation?: string;
  partOfSpeech?: string;
  level?: string;

  categories: string[];
  examples: string[];

  status:
    | "learning"
    | "mastered";

  reviewCount: number;
  correctCount: number;
  wrongCount: number;

  lastReviewedAt?: string;
  nextReviewAt?: string;

  difficulty?: Rating;
};

type VocabularyRow = {
  id: string;

  target_code:
    | string
    | null;

  korean: string;
  meaning: string;

  pronunciation:
    | string
    | null;

  part_of_speech:
    | string
    | null;

  level:
    | string
    | null;

  categories: unknown;
  examples: unknown;

  status: string;

  review_count:
    | number
    | null;

  correct_count:
    | number
    | null;

  wrong_count:
    | number
    | null;

  last_reviewed_at:
    | string
    | null;

  next_review_at:
    | string
    | null;

  difficulty:
    | string
    | null;
};

/*
 * =========================================
 * CHUYỂN JSONB → STRING[]
 * =========================================
 */

function toStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is string =>
      typeof item === "string"
  );
}

/*
 * =========================================
 * CHUYỂN DỮ LIỆU SUPABASE → WORD
 * =========================================
 */

function rowToWord(
  row: VocabularyRow
): Word {
  let difficulty:
    | Rating
    | undefined;

  if (
    row.difficulty ===
      "again" ||
    row.difficulty ===
      "hard" ||
    row.difficulty ===
      "good" ||
    row.difficulty ===
      "easy"
  ) {
    difficulty =
      row.difficulty;
  }

  return {
    id: row.id,

    targetCode:
      row.target_code ||
      undefined,

    korean:
      row.korean || "",

    meaning:
      row.meaning || "",

    pronunciation:
      row.pronunciation ||
      undefined,

    partOfSpeech:
      row.part_of_speech ||
      undefined,

    level:
      row.level ||
      undefined,

    categories:
      toStringArray(
        row.categories
      ),

    examples:
      toStringArray(
        row.examples
      ),

    status:
      row.status ===
      "mastered"
        ? "mastered"
        : "learning",

    reviewCount:
      row.review_count || 0,

    correctCount:
      row.correct_count || 0,

    wrongCount:
      row.wrong_count || 0,

    lastReviewedAt:
      row.last_reviewed_at ||
      undefined,

    nextReviewAt:
      row.next_review_at ||
      undefined,

    difficulty,
  };
}

/*
 * =========================================
 * KIỂM TRA TỪ ĐÃ ĐẾN HẠN CHƯA
 * =========================================
 */

function isDue(
  word: Word
) {
  if (
    !word.nextReviewAt
  ) {
    return true;
  }

  return (
    new Date(
      word.nextReviewAt
    ).getTime() <=
    Date.now()
  );
}

/*
 * =========================================
 * TRỘN THẺ
 * =========================================
 */

function shuffle(
  items: Word[]
) {
  const result = [
    ...items,
  ];

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

    [
      result[i],
      result[j],
    ] = [
      result[j],
      result[i],
    ];
  }

  return result;
}

export default function ReviewPage() {
  const router =
    useRouter();

  const [supabase] =
    useState(() =>
      createClient()
    );

  const [
    allWords,
    setAllWords,
  ] = useState<Word[]>(
    []
  );

  const [
    deck,
    setDeck,
  ] = useState<Word[]>(
    []
  );

  const [
    ready,
    setReady,
  ] = useState(false);

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [
    revealed,
    setRevealed,
  ] = useState(false);

  const [
    finished,
    setFinished,
  ] = useState(false);

  const [
    savingRating,
    setSavingRating,
  ] = useState(false);

  const [
    direction,
    setDirection,
  ] =
    useState<Direction>(
      "ko-vi"
    );

  const [
    stats,
    setStats,
  ] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  /*
   * =========================================
   * TẢI DỮ LIỆU TỪ SUPABASE
   * =========================================
   */

  useEffect(() => {
    let cancelled =
      false;

    async function loadReview() {
      setReady(false);

      /*
       * Kiểm tra tài khoản
       */

      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      /*
       * Chưa đăng nhập
       */

      if (
        userError ||
        !user
      ) {
        router.replace(
          "/login"
        );

        return;
      }

      /*
       * Lấy toàn bộ vocabulary
       * của user hiện tại
       */

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "vocabulary"
          )
          .select("*")
          .eq(
            "user_id",
            user.id
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          );

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Lỗi tải lịch ôn:",
          error
        );

        alert(
          "Không tải được lịch ôn từ Supabase."
        );

        setReady(true);

        return;
      }

      /*
       * Chuyển dữ liệu
       */

      const rows =
        (data ||
          []) as VocabularyRow[];

      const words =
        rows.map(
          rowToWord
        );

      /*
       * Lưu toàn bộ từ
       */

      setAllWords(
        words
      );

      /*
       * Chỉ lấy từ đến hạn
       */

      const due =
        words.filter(
          isDue
        );

      /*
       * Trộn bộ thẻ
       */

      setDeck(
        shuffle(due)
      );

      setCurrentIndex(
        0
      );

      setRevealed(
        false
      );

      setFinished(
        false
      );

      setReady(true);
    }

    loadReview();

    return () => {
      cancelled = true;
    };
  }, [
    router,
    supabase,
  ]);

  /*
   * =========================================
   * TỪ HIỆN TẠI
   * =========================================
   */

  const currentWord =
    deck[
      currentIndex
    ];

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

    setSavingRating(
      true
    );

    const now =
      new Date();

    const nextReview =
      new Date(now);

    let correctIncrease =
      0;

    let wrongIncrease =
      0;

    /*
     * 😵 AGAIN
     * 10 phút
     */

    if (
      rating ===
      "again"
    ) {
      nextReview.setMinutes(
        nextReview.getMinutes() +
          10
      );

      wrongIncrease = 1;
    }

    /*
     * 😐 HARD
     * 1 ngày
     */

    if (
      rating ===
      "hard"
    ) {
      nextReview.setDate(
        nextReview.getDate() +
          1
      );
    }

    /*
     * 🙂 GOOD
     * 3 ngày
     */

    if (
      rating ===
      "good"
    ) {
      nextReview.setDate(
        nextReview.getDate() +
          3
      );

      correctIncrease = 1;
    }

    /*
     * 😎 EASY
     * 7 ngày
     */

    if (
      rating ===
      "easy"
    ) {
      nextReview.setDate(
        nextReview.getDate() +
          7
      );

      correctIncrease = 1;
    }

    /*
     * Tính thống kê mới
     */

    const newCorrectCount =
      currentWord.correctCount +
      correctIncrease;

    const newWrongCount =
      currentWord.wrongCount +
      wrongIncrease;

    const newReviewCount =
      currentWord.reviewCount +
      1;

    /*
     * Trạng thái mới
     */

    let newStatus =
      currentWord.status;

    /*
     * Nếu quên
     * → quay lại learning
     */

    if (
      rating ===
      "again"
    ) {
      newStatus =
        "learning";
    }

    /*
     * Easy >= 3 lần đúng
     * → mastered
     */

    if (
      rating ===
        "easy" &&
      newCorrectCount >=
        3
    ) {
      newStatus =
        "mastered";
    }

    /*
     * =========================================
     * LƯU LÊN SUPABASE
     * =========================================
     */

    const {
      error,
    } =
      await supabase
        .from(
          "vocabulary"
        )
        .update({
          status:
            newStatus,

          review_count:
            newReviewCount,

          correct_count:
            newCorrectCount,

          wrong_count:
            newWrongCount,

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

      setSavingRating(
        false
      );

      return;
    }

    /*
     * Tạo object mới
     */

    const updatedWord: Word =
      {
        ...currentWord,

        status:
          newStatus,

        reviewCount:
          newReviewCount,

        correctCount:
          newCorrectCount,

        wrongCount:
          newWrongCount,

        difficulty:
          rating,

        lastReviewedAt:
          now.toISOString(),

        nextReviewAt:
          nextReview.toISOString(),
      };

    /*
     * Cập nhật allWords
     */

    setAllWords(
      (
        oldWords
      ) =>
        oldWords.map(
          (word) =>
            word.id ===
            currentWord.id
              ? updatedWord
              : word
        )
    );

    /*
     * Cập nhật deck hiện tại
     */

    setDeck(
      (
        oldDeck
      ) =>
        oldDeck.map(
          (word) =>
            word.id ===
            currentWord.id
              ? updatedWord
              : word
        )
    );

    /*
     * Thống kê phiên học
     */

    setStats(
      (old) => ({
        ...old,

        [rating]:
          old[rating] +
          1,
      })
    );

    setSavingRating(
      false
    );

    /*
     * Sang thẻ tiếp theo
     */

    nextCard();
  }

  /*
   * =========================================
   * THẺ TIẾP THEO
   * =========================================
   */

  function nextCard() {
    setRevealed(
      false
    );

    /*
     * Đã tới cuối deck
     */

    if (
      currentIndex +
        1 >=
      deck.length
    ) {
      setFinished(
        true
      );

      return;
    }

    setCurrentIndex(
      (old) =>
        old + 1
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
    window
      .speechSynthesis
      .cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.lang =
      "ko-KR";

    utterance.rate =
      0.9;

    window
      .speechSynthesis
      .speak(
        utterance
      );
  }

  /*
   * =========================================
   * KIỂM TRA LẠI LỊCH ÔN
   * =========================================
   */

  function restart() {
    /*
     * Kiểm tra lại giờ hiện tại
     *
     * Nếu Again mới 5 phút
     * thì chưa xuất hiện.
     *
     * Sau 10 phút mới xuất hiện lại.
     */

    const due =
      allWords.filter(
        isDue
      );

    setDeck(
      shuffle(due)
    );

    setCurrentIndex(
      0
    );

    setRevealed(
      false
    );

    setFinished(
      false
    );

    setStats({
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
    });
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
              🔁
            </div>

            <p className="mt-4 font-semibold">
              Đang kiểm tra lịch ôn...
            </p>

            <p className="mt-2 text-sm text-slate-500">
              ☁️ Đang đồng bộ với Supabase
            </p>

          </div>

        </div>
      </AppShell>
    );
  }

  /*
   * =========================================
   * GIAO DIỆN
   * =========================================
   */

  return (
    <AppShell>

      {/* HEADER */}

      <div className="mb-8">

        <p className="text-slate-400">
          오늘의 복습
        </p>

        <h1 className="text-3xl font-bold md:text-4xl">
          🔁 Ôn hôm nay
        </h1>

        <p className="mt-2 text-slate-500">
          Chỉ luyện những từ đã tới
          thời gian cần ôn.
        </p>

      </div>

      {/* THỐNG KÊ */}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">

        <Stat
          title="📚 Tổng từ"
          value={
            allWords.length
          }
        />

        <Stat
          title="🔁 Cần ôn"
          value={
            finished
              ? 0
              : Math.max(
                  deck.length -
                    currentIndex,
                  0
                )
          }
        />

        <Stat
          title="🟡 Đang học"
          value={
            allWords.filter(
              (word) =>
                word.status ===
                "learning"
            ).length
          }
        />

        <Stat
          title="🟢 Đã thuộc"
          value={
            allWords.filter(
              (word) =>
                word.status ===
                "mastered"
            ).length
          }
        />

      </div>

      {/* KHÔNG CÓ TỪ CẦN ÔN */}

      {deck.length ===
        0 &&
        !finished && (
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center">

            <div className="text-6xl">
              🎉
            </div>

            <h2 className="mt-5 text-2xl font-bold">
              Hôm nay không còn từ cần ôn
            </h2>

            <p className="mt-2 text-slate-500">
              Bạn có thể học thêm từ mới
              hoặc qua Flashcard để luyện
              tự do.
            </p>

            <div className="mt-6 rounded-2xl bg-slate-950 p-4">

              <p className="text-sm text-slate-500">
                ☁️ Lịch ôn đã được
                đồng bộ lên Supabase
              </p>

            </div>

          </div>
        )}

      {/* ĐANG ÔN */}

      {deck.length >
        0 &&
        !finished &&
        currentWord && (
          <div className="mx-auto max-w-3xl">

            {/* CÁCH HỎI */}

            <div className="mb-4 flex justify-end gap-2">

              <button
                onClick={() =>
                  setDirection(
                    "ko-vi"
                  )
                }
                className={`rounded-xl px-4 py-2 text-sm ${
                  direction ===
                  "ko-vi"
                    ? "bg-white font-bold text-black"
                    : "bg-slate-900 text-slate-400"
                }`}
              >
                🇰🇷 → 🇻🇳
              </button>

              <button
                onClick={() =>
                  setDirection(
                    "vi-ko"
                  )
                }
                className={`rounded-xl px-4 py-2 text-sm ${
                  direction ===
                  "vi-ko"
                    ? "bg-white font-bold text-black"
                    : "bg-slate-900 text-slate-400"
                }`}
              >
                🇻🇳 → 🇰🇷
              </button>

            </div>

            {/* PROGRESS */}

            <div className="mb-3 flex justify-between text-sm text-slate-500">

              <span>
                {currentIndex +
                  1}{" "}
                /{" "}
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

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-10">

              <div className="flex items-center justify-between">

                <div className="flex flex-wrap gap-2">

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

              <div className="flex min-h-[250px] flex-col items-center justify-center text-center">

                <p className="text-sm text-slate-500">

                  {direction ===
                  "ko-vi"
                    ? "Từ này nghĩa là gì?"
                    : "Hãy nhớ từ tiếng Hàn"}

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

              {/* CHƯA XEM ĐÁP ÁN */}

              {!revealed ? (
                <button
                  onClick={() =>
                    setRevealed(
                      true
                    )
                  }
                  className="w-full rounded-2xl bg-white py-4 font-bold text-black"
                >
                  👀 Xem đáp án
                </button>
              ) : (
                <>

                  {/* ĐÁP ÁN */}

                  <div className="rounded-2xl bg-slate-950 p-6 text-center">

                    <p className="text-xs text-slate-500">
                      Đáp án
                    </p>

                    <p className="mt-3 text-3xl font-bold">

                      {direction ===
                      "ko-vi"
                        ? currentWord.meaning
                        : currentWord.korean}

                    </p>

                    {currentWord.pronunciation && (
                      <p className="mt-2 text-slate-500">
                        [
                        {
                          currentWord.pronunciation
                        }
                        ]
                      </p>
                    )}

                    {currentWord.examples.length >
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
                    Mức độ nhớ?
                  </p>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                    <RateButton
                      title="😵 Quên"
                      time="10 phút"
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
                      time="1 ngày"
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
                      time="3 ngày"
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
                      time="7 ngày"
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

                </>
              )}

            </div>

          </div>
        )}

      {/* HOÀN THÀNH */}

      {finished && (
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">

          <div className="text-6xl">
            ✅
          </div>

          <h2 className="mt-5 text-3xl font-bold">
            Xong lịch ôn hôm nay!
          </h2>

          <p className="mt-2 text-slate-500">
            Bạn đã xử lý{" "}
            {deck.length} từ.
          </p>

          {/* KẾT QUẢ */}

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">

            <Result
              title="😵 Quên"
              value={
                stats.again
              }
            />

            <Result
              title="😐 Khó"
              value={
                stats.hard
              }
            />

            <Result
              title="🙂 Nhớ"
              value={
                stats.good
              }
            />

            <Result
              title="😎 Dễ"
              value={
                stats.easy
              }
            />

          </div>

          <div className="mt-6 rounded-2xl bg-slate-950 p-4">

            <p className="text-sm text-slate-500">
              ☁️ Kết quả đã được lưu
              vào tài khoản của bạn.
            </p>

          </div>

          <button
            onClick={
              restart
            }
            className="mt-8 rounded-2xl bg-white px-8 py-4 font-bold text-black"
          >
            🔄 Kiểm tra lại lịch ôn
          </button>

        </div>
      )}

    </AppShell>
  );
}

/*
 * =========================================
 * STAT
 * =========================================
 */

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

/*
 * =========================================
 * BADGE
 * =========================================
 */

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

/*
 * =========================================
 * RATE BUTTON
 * =========================================
 */

function RateButton({
  title,
  time,
  onClick,
  disabled,
}: {
  title: string;
  time: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      className="rounded-2xl border border-slate-700 bg-slate-950 p-4 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >

      <p className="font-bold">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {time}
      </p>

    </button>
  );
}

/*
 * =========================================
 * RESULT
 * =========================================
 */

function Result({
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