"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { createClient } from "@/utils/supabase/client";

type VocabularyRow = {
  id: string;
  korean: string;
  level: string | null;
  status: string;

  next_review_at:
    | string
    | null;

  last_reviewed_at:
    | string
    | null;

  created_at: string;
};

type GrammarDueRow = {
  next_review_at: string | null;
};

type TopikDueRow = {
  next_review_at: string | null;
};

export default function Home() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [words, setWords] =
    useState<VocabularyRow[]>([]);

  const [grammarDue, setGrammarDue] = useState(0);
  const [topikDue, setTopikDue] = useState(0);

  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [dashboardNow] = useState(() => Date.now());

  /*
   * =========================================
   * TẢI DASHBOARD
   * =========================================
   */

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);

      /*
       * Lấy user hiện tại
       */

      const {
        data: { user },
        error: userError,
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

      setEmail(
        user.email || ""
      );

      /*
       * Lấy vocabulary
       */

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "vocabulary"
          )
          .select(
            `
              id,
              korean,
              level,
              status,
              next_review_at,
              last_reviewed_at,
              created_at
            `
          )
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
          "Lỗi tải dashboard:",
          error
        );

        alert(
          "Không tải được dữ liệu trang chủ."
        );

        setLoading(false);

        return;
      }

      setWords(
        (data ||
          []) as VocabularyRow[]
      );

      const { data: grammarData, error: grammarError } = await supabase
        .from("grammar")
        .select("next_review_at")
        .eq("user_id", user.id);

      if (!cancelled) {
        const now = Date.now();
        setGrammarDue(
          grammarError
            ? 0
            : ((grammarData || []) as GrammarDueRow[]).filter(
                (item) =>
                  !item.next_review_at ||
                  new Date(item.next_review_at).getTime() <= now
              ).length
        );
      }

      const { data: topikData, error: topikError } = await supabase
        .from("topik_mistakes")
        .select("next_review_at")
        .eq("user_id", user.id);

      if (!cancelled) {
        const now = Date.now();
        setTopikDue(
          topikError
            ? 0
            : ((topikData || []) as TopikDueRow[]).filter(
                (item) =>
                  !item.next_review_at ||
                  new Date(item.next_review_at).getTime() <= now
              ).length
        );
      }

      setLoading(false);
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [
    router,
    supabase,
  ]);

  /*
   * =========================================
   * ĐĂNG XUẤT
   * =========================================
   */

  async function logout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      alert(
        "Không đăng xuất được."
      );

      setLoggingOut(false);

      return;
    }

    router.replace(
      "/login"
    );

    router.refresh();
  }

  /*
   * =========================================
   * THỐNG KÊ
   * =========================================
   */

  const totalWords =
    words.length;

  const learningWords =
    words.filter(
      (word) =>
        word.status !==
        "mastered"
    ).length;

  const masteredWords =
    words.filter(
      (word) =>
        word.status ===
        "mastered"
    ).length;

  /*
   * Từ đến hạn:
   *
   * - Chưa từng ôn
   * - Hoặc next_review_at <= hiện tại
   */

  const dueWords =
    useMemo(() => {
      const now = dashboardNow;

      return words.filter(
        (word) => {
          if (
            !word.next_review_at
          ) {
            return true;
          }

          return (
            new Date(
              word.next_review_at
            ).getTime() <=
            now
          );
        }
      ).length;
    }, [dashboardNow, words]);

  /*
   * =========================================
   * CẤP ĐỘ
   * =========================================
   */

  const beginner =
    words.filter(
      (word) =>
        word.level ===
        "초급"
    ).length;

  const intermediate =
    words.filter(
      (word) =>
        word.level ===
        "중급"
    ).length;

  const advanced =
    words.filter(
      (word) =>
        word.level ===
        "고급"
    ).length;

  /*
   * =========================================
   * % ĐÃ THUỘC
   * =========================================
   */

  const masteryPercent =
    totalWords === 0
      ? 0
      : Math.round(
          (masteredWords /
            totalWords) *
            100
        );

  /*
   * =========================================
   * STREAK
   *
   * Tạm tính một ngày "đã học" khi:
   * - có từ mới được lưu
   * HOẶC
   * - có từ được ôn
   *
   * Sau này có bảng activity riêng
   * thì mình sẽ nâng cấp chính xác hơn.
   * =========================================
   */

  const streak =
    useMemo(() => {
      const studyDays =
        new Set<string>();

      words.forEach(
        (word) => {
          if (
            word.created_at
          ) {
            studyDays.add(
              getDateKey(
                new Date(
                  word.created_at
                )
              )
            );
          }

          if (
            word.last_reviewed_at
          ) {
            studyDays.add(
              getDateKey(
                new Date(
                  word.last_reviewed_at
                )
              )
            );
          }
        }
      );

      if (
        studyDays.size === 0
      ) {
        return 0;
      }

      const today =
        new Date();

      /*
       * Nếu hôm nay chưa học,
       * thử bắt đầu tính từ hôm qua.
       */

      const cursor =
        new Date(today);

      const todayKey =
        getDateKey(cursor);

      if (
        !studyDays.has(
          todayKey
        )
      ) {
        cursor.setDate(
          cursor.getDate() -
            1
        );
      }

      let count = 0;

      /*
       * Đếm ngược liên tiếp
       */

      while (
        studyDays.has(
          getDateKey(
            cursor
          )
        )
      ) {
        count++;

        cursor.setDate(
          cursor.getDate() -
            1
        );
      }

      return count;
    }, [words]);

  /*
   * =========================================
   * LỜI CHÀO
   * =========================================
   */

  const greeting =
    getGreeting();

  /*
   * =========================================
   * LOADING
   * =========================================
   */

  if (loading) {
    return (
      <AppShell>

        <div className="flex min-h-[65vh] items-center justify-center">

          <div className="text-center">

            <div className="text-6xl">
              🇰🇷
            </div>

            <p className="mt-5 text-lg font-semibold">
              Đang tải trang chủ...
            </p>

            <p className="mt-2 text-sm text-slate-500">
              ☁️ Đang đồng bộ tiến độ học
            </p>

          </div>

        </div>

      </AppShell>
    );
  }

  return (
    <AppShell>

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="mb-8">

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">

          <div>

            <p className="text-slate-400">
              안녕하세요 👋
            </p>

            <h1 className="mt-1 text-3xl font-bold md:text-4xl">
              {greeting}
            </h1>

            <p className="mt-2 text-slate-500">
              조금씩 매일 공부해요 🇰🇷
            </p>

          </div>

          {/* ACCOUNT */}

          <div className="flex items-center gap-3">

            <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">

              <p className="text-xs text-slate-500">
                👤 Tài khoản
              </p>

              <p className="mt-1 max-w-[220px] truncate text-sm font-semibold text-slate-300">
                {email}
              </p>

            </div>

            <button
              onClick={logout}
              disabled={
                loggingOut
              }
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm font-semibold transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loggingOut
                ? "..."
                : "🚪"}
            </button>

          </div>

        </div>

      </div>

      {/* =====================================
          MAIN STATS
      ===================================== */}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">

        <Stat
          title="🔥 Streak"
          value={streak}
          text="ngày"
        />

        <Stat
          title="📚 Tổng từ"
          value={totalWords}
          text="đã lưu"
        />

        <Stat
          title="🔁 Cần ôn"
          value={dueWords}
          text="hiện tại"
          highlight={
            dueWords > 0
          }
        />

        <Stat
          title="🟢 Đã thuộc"
          value={masteredWords}
          text="từ"
        />

        <Stat
          title="🧠 Ngữ pháp"
          value={grammarDue}
          text="cần ôn"
          highlight={grammarDue > 0}
        />

      </div>

      {/* =====================================
          QUICK ACTION
      ===================================== */}

      <div className="mb-8 grid gap-3 md:grid-cols-4">

        <Link
          href="/review"
          className="group rounded-3xl border border-slate-700 bg-white p-6 text-black transition hover:-translate-y-1"
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm font-semibold opacity-60">
                오늘의 복습
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                🔁 Ôn hôm nay
              </h2>

              <p className="mt-2 text-sm opacity-70">
                {dueWords > 0
                  ? `Bạn có ${dueWords} từ cần ôn.`
                  : "Hiện chưa có từ đến hạn."}
              </p>

            </div>

            <div className="text-3xl transition group-hover:translate-x-1">
              →
            </div>

          </div>

        </Link>

        <Link
          href="/vocabulary"
          className="group rounded-3xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:bg-slate-800"
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-slate-500">
                새 단어
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                📚 Học từ mới
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Tra từ và thêm vào kho
                cá nhân.
              </p>

            </div>

            <div className="text-3xl text-slate-500 transition group-hover:translate-x-1">
              →
            </div>

          </div>

        </Link>

        <Link
          href="/grammar/review"
          className="group rounded-3xl border border-violet-400/25 bg-violet-400/10 p-6 transition hover:-translate-y-1 hover:bg-violet-400/15"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-violet-200">🧠 Ôn cấu trúc</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Ngữ pháp hôm nay</h2>
              <p className="mt-2 text-sm text-violet-100/70">
                {grammarDue > 0 ? `Bạn có ${grammarDue} cấu trúc cần ôn.` : "Chưa có cấu trúc đến hạn."}
              </p>
            </div>
            <div className="text-3xl text-violet-200 transition group-hover:translate-x-1">→</div>
          </div>
        </Link>

        <Link
          href="/topik/review"
          className="group rounded-3xl border border-rose-400/25 bg-rose-400/10 p-6 transition hover:-translate-y-1 hover:bg-rose-400/15"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-rose-200">🎯 TOPIK</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Ôn câu sai</h2>
              <p className="mt-2 text-sm text-rose-100/70">{topikDue > 0 ? `Bạn có ${topikDue} câu cần ôn.` : "Chưa có câu đến hạn."}</p>
            </div>
            <div className="text-3xl text-rose-200 transition group-hover:translate-x-1">→</div>
          </div>
        </Link>

      </div>

      {/* =====================================
          PROGRESS
      ===================================== */}

      <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-7">

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

          <div>

            <p className="text-sm text-slate-500">
              📈 Tiến độ ghi nhớ
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {masteryPercent}% đã thuộc
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {masteredWords} đã thuộc •{" "}
              {learningWords} đang học
            </p>

          </div>

          <div className="text-5xl font-bold">
            {masteryPercent}%
          </div>

        </div>

        {/* PROGRESS BAR */}

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">

          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{
              width: `${masteryPercent}%`,
            }}
          />

        </div>

      </div>

      {/* =====================================
          LEVEL
      ===================================== */}

      <div className="mb-10">

        <div className="mb-4">

          <h2 className="text-xl font-bold">
            🇰🇷 Từ vựng theo cấp độ
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Dựa trên cấp độ từ điển.
          </p>

        </div>

        <div className="grid gap-3 md:grid-cols-3">

          <LevelCard
            icon="🌱"
            title="Sơ cấp"
            korean="초급"
            value={beginner}
            total={totalWords}
          />

          <LevelCard
            icon="🌿"
            title="Trung cấp"
            korean="중급"
            value={intermediate}
            total={totalWords}
          />

          <LevelCard
            icon="🌳"
            title="Cao cấp"
            korean="고급"
            value={advanced}
            total={totalWords}
          />

        </div>

      </div>

      {/* =====================================
          STUDY
      ===================================== */}

      <div className="mb-5">

        <h2 className="text-xl font-bold">
          Học gì tiếp?
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Chọn một chế độ học bên dưới.
        </p>

      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        <StudyCard
          href="/flashcards"
          icon="🧠"
          korean="단어 복습"
          title="Flashcard"
          text="Ôn tự do toàn bộ kho từ"
        />

        <StudyCard
          href="/vocabulary"
          icon="📚"
          korean="단어장"
          title="Từ vựng"
          text="Tra và quản lý từ đã học"
        />

        <StudyCard
          href="/grammar"
          icon="🧩"
          korean="문법"
          title="Ngữ pháp"
          text="Học và lưu cấu trúc câu"
        />

        <StudyCard
          href="/shadowing"
          icon="🎧"
          korean="쉐도잉"
          title="Shadowing"
          text="Nghe và bắt chước giọng Hàn"
        />

        <StudyCard
          href="/topik"
          icon="🎯"
          korean="한국어능력시험"
          title="TOPIK"
          text="Theo dõi mục tiêu TOPIK"
        />

        <StudyCard
          href="/ai"
          icon="🤖"
          korean="AI 선생님"
          title="AI Tutor"
          text="Học và hỏi tiếng Hàn với AI"
        />

      </div>

      {/* =====================================
          FOOTER MESSAGE
      ===================================== */}

      <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center">

        <div className="text-4xl">
          🇰🇷
        </div>

        <p className="mt-3 font-semibold">
          오늘도 화이팅!
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Mỗi ngày một chút là đủ.
        </p>

      </div>

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
  text,
  highlight = false,
}: {
  title: string;
  value: number;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-slate-500 bg-slate-800"
          : "border-slate-800 bg-slate-900"
      }`}
    >

      <p className="text-sm text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>

      <p className="text-sm text-slate-500">
        {text}
      </p>

    </div>
  );
}

/*
 * =========================================
 * LEVEL CARD
 * =========================================
 */

function LevelCard({
  icon,
  title,
  korean,
  value,
  total,
}: {
  icon: string;
  title: string;
  korean: string;
  value: number;
  total: number;
}) {
  const percent =
    total === 0
      ? 0
      : Math.round(
          (value /
            total) *
            100
        );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm text-slate-500">
            {korean}
          </p>

          <h3 className="mt-1 font-bold">
            {icon} {title}
          </h3>

        </div>

        <p className="text-3xl font-bold">
          {value}
        </p>

      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">

        <div
          className="h-full rounded-full bg-white"
          style={{
            width: `${percent}%`,
          }}
        />

      </div>

      <p className="mt-2 text-xs text-slate-500">
        {percent}% kho từ
      </p>

    </div>
  );
}

/*
 * =========================================
 * STUDY CARD
 * =========================================
 */

function StudyCard({
  href,
  icon,
  korean,
  title,
  text,
}: {
  href: string;
  icon: string;
  korean: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:bg-slate-800"
    >

      <div className="flex items-start justify-between">

        <div className="text-4xl">
          {icon}
        </div>

        <span className="text-xl text-slate-600 transition group-hover:translate-x-1">
          →
        </span>

      </div>

      <p className="mt-4 text-xs text-slate-500">
        {korean}
      </p>

      <h3 className="mt-1 text-lg font-bold">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        {text}
      </p>

    </Link>
  );
}

/*
 * =========================================
 * DATE KEY CHO STREAK
 * =========================================
 */

function getDateKey(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

/*
 * =========================================
 * LỜI CHÀO
 * =========================================
 */

function getGreeting() {
  const hour =
    new Date().getHours();

  if (hour < 5) {
    return "Khuya rồi, học nhẹ thôi 🌙";
  }

  if (hour < 12) {
    return "Chào buổi sáng ☀️";
  }

  if (hour < 18) {
    return "Chào buổi chiều 🌤️";
  }

  return "Chào buổi tối 🌙";
}
