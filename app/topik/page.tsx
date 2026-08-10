"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/utils/supabase/client";

type Word = {
  id: string;
  korean: string;
  meaning: string;
  level: string;
  categories?: string[];
  status: "learning" | "mastered";
};

type VocabularyRow = {
  id: string;
  korean: string;
  meaning: string;
  level: string | null;
  categories: unknown;
  status: string;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string"
  );
}

function rowToWord(row: VocabularyRow): Word {
  return {
    id: row.id,
    korean: row.korean || "",
    meaning: row.meaning || "",
    level: row.level || "",
    categories: toStringArray(row.categories),
    status: row.status === "mastered" ? "mastered" : "learning",
  };
}

const focusTopics = [
  {
    icon: "💰",
    name: "Kinh tế",
    keywords: ["경제"],
  },
  {
    icon: "🏙️",
    name: "Xã hội",
    keywords: ["사회"],
  },
  {
    icon: "🏛️",
    name: "Chính trị",
    keywords: ["정치", "행정"],
  },
  {
    icon: "🌍",
    name: "Môi trường",
    keywords: ["환경", "자연"],
  },
  {
    icon: "🔬",
    name: "Khoa học",
    keywords: ["과학", "기술"],
  },
  {
    icon: "📰",
    name: "Báo chí",
    keywords: ["언론", "매체"],
  },
  {
    icon: "⚖️",
    name: "Pháp luật",
    keywords: ["법", "사법"],
  },
  {
    icon: "📜",
    name: "Lịch sử",
    keywords: ["역사"],
  },
  {
    icon: "🎭",
    name: "Văn hóa",
    keywords: ["문화"],
  },
  {
    icon: "🎓",
    name: "Giáo dục",
    keywords: ["교육", "학문"],
  },
];

export default function TopikPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadWords() {
      setLoading(true);

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

      const { data, error } = await supabase
        .from("vocabulary")
        .select("id, korean, meaning, level, categories, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Lỗi tải dữ liệu TOPIK:", error);
        alert("Không tải được dữ liệu TOPIK từ Supabase.");
        setLoading(false);
        return;
      }

      setWords((data || []).map((row) => rowToWord(row as VocabularyRow)));
      setLoading(false);
    }

    loadWords();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const beginner =
    words.filter(
      (word) =>
        word.level === "초급"
    );

  const intermediate =
    words.filter(
      (word) =>
        word.level === "중급"
    );

  const advanced =
    words.filter(
      (word) =>
        word.level === "고급"
    );

  const masteredAdvanced =
    advanced.filter(
      (word) =>
        word.status ===
        "mastered"
    ).length;

  const topicStats =
    useMemo(() => {
      return focusTopics.map(
        (topic) => {
          const matching =
            advanced.filter(
              (word) => {
                const text =
                  word.categories
                    ?.join(" ")
                    .toLowerCase() ||
                  "";

                return topic.keywords.some(
                  (keyword) =>
                    text.includes(
                      keyword.toLowerCase()
                    )
                );
              }
            );

          return {
            ...topic,
            count:
              matching.length,
          };
        }
      );
    }, [advanced]);

  return (
    <AppShell>
      {loading ? (
        <div className="flex min-h-[65vh] items-center justify-center text-center">
          <div>
            <div className="text-5xl">🎯</div>
            <p className="mt-4 font-semibold">Đang tải tiến độ TOPIK...</p>
          </div>
        </div>
      ) : (
        <>
      <div className="mb-8">
        <p className="text-slate-400">
          한국어능력시험
        </p>

        <h1 className="text-3xl font-bold md:text-4xl">
          🎯 TOPIK 6 Focus
        </h1>

        <p className="mt-2 max-w-2xl text-slate-500">
          Khu vực học tập riêng
          để tập trung vào từ
          trung cấp, cao cấp và
          các chủ đề học thuật.
        </p>

        <p className="mt-2 text-xs text-amber-400">
          Đây là cách app sắp
          xếp việc học, không
          phải danh sách từ
          TOPIK chính thức.
        </p>
      </div>

      {/* LEVEL */}

      <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          title="🌱 Sơ cấp"
          value={
            beginner.length
          }
        />

        <Stat
          title="🌿 Trung cấp"
          value={
            intermediate.length
          }
        />

        <Stat
          title="🌳 Cao cấp"
          value={
            advanced.length
          }
        />

        <Stat
          title="✅ Cao cấp đã thuộc"
          value={
            masteredAdvanced
          }
        />
      </div>

      {/* ADVANCED PROGRESS */}

      <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              TOPIK Advanced
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              🌳 Từ cao cấp
            </h2>
          </div>

          <p className="text-2xl font-bold">
            {
              masteredAdvanced
            }
            /
            {advanced.length}
          </p>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{
              width:
                advanced.length ===
                0
                  ? "0%"
                  : `${
                      (masteredAdvanced /
                        advanced.length) *
                      100
                    }%`,
            }}
          />
        </div>
      </div>

      {/* TOPICS */}

      <div className="mb-10">
        <h2 className="mb-4 text-2xl font-bold">
          Chủ đề cần tập trung
        </h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {topicStats.map(
            (topic) => (
              <div
                key={
                  topic.name
                }
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="text-3xl">
                  {
                    topic.icon
                  }
                </div>

                <p className="mt-3 font-bold">
                  {
                    topic.name
                  }
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {
                    topic.count
                  }{" "}
                  từ cao cấp
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* SAVED ADVANCED WORDS */}

      <div>
        <h2 className="mb-4 text-2xl font-bold">
          🌳 Từ cao cấp của tôi
        </h2>

        {advanced.length ===
        0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
            <div className="text-5xl">
              🎯
            </div>

            <p className="mt-4 font-bold">
              Chưa có từ cao cấp
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Qua trang Từ vựng
              và bắt đầu lưu
              những từ 고급.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {advanced
              .slice(0, 20)
              .map(
                (word) => (
                  <div
                    key={
                      word.id
                    }
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xl font-bold">
                          {
                            word.korean
                          }
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {
                            word.meaning
                          }
                        </p>
                      </div>

                      <span>
                        {word.status ===
                        "mastered"
                          ? "🟢"
                          : "🟡"}
                      </span>
                    </div>
                  </div>
                )
              )}
          </div>
        )}
      </div>
        </>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}
