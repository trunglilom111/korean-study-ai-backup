"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import CommunityCollections from "@/components/CommunityCollections";
import VocabularyCollections, {
  CollectionPicker,
} from "@/components/VocabularyCollections";
import { createClient } from "@/utils/supabase/client";

type DictionaryResult = {
  targetCode: string;
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  level: string;
  source?: "saved" | "dictionary" | "ai";
  aiExplanation?: string;
  meanings: {
    koreanDefinition: string;
    vietnamese: string;
    vietnameseDefinition: string;
  }[];
};

type SearchDirection = "ko-vi" | "vi-ko";

type Word = {
  id: string;
  targetCode?: string;
  korean: string;
  meaning: string;
  pronunciation: string;
  partOfSpeech: string;
  level: string;
  categories: string[];
  examples: string[];
  status: "learning" | "mastered";
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
  created_at: string;
};

type LevelFilter =
  | "all"
  | "초급"
  | "중급"
  | "고급";

function detectSearchDirection(value: string): SearchDirection {
  return /[\uAC00-\uD7A3]/.test(value) ? "ko-vi" : "vi-ko";
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function removeVietnameseAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (character) =>
      character === "Đ" ? "D" : "d"
    );
}

function matchesSearchValue(
  value: string,
  query: string
): boolean {
  const normalizedValue = normalizeSearchValue(value);
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return false;
  }

  return (
    normalizedValue.includes(normalizedQuery) ||
    removeVietnameseAccents(normalizedValue).includes(
      removeVietnameseAccents(normalizedQuery)
    )
  );
}

function wordToDictionaryResult(word: Word): DictionaryResult {
  return {
    targetCode: word.targetCode || "",
    word: word.korean,
    pronunciation: word.pronunciation,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    source: "saved",
    meanings: [
      {
        koreanDefinition: "",
        vietnamese: word.meaning,
        vietnameseDefinition: word.meaning,
      },
    ],
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .filter(Boolean);
}

function rowToWord(
  row: VocabularyRow
): Word {
  return {
    id: row.id,

    targetCode:
      row.target_code || undefined,

    korean:
      row.korean || "",

    meaning:
      row.meaning || "",

    pronunciation:
      row.pronunciation || "",

    partOfSpeech:
      row.part_of_speech || "",

    level:
      row.level || "",

    categories:
      stringArray(row.categories),

    examples:
      stringArray(row.examples),

    status:
      row.status === "mastered"
        ? "mastered"
        : "learning",
  };
}

export default function VocabularyPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [words, setWords] =
    useState<Word[]>([]);

  const [query, setQuery] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [results, setResults] =
    useState<DictionaryResult[]>([]);

  const [searchStatus, setSearchStatus] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [loadingWords, setLoadingWords] =
    useState(true);

  const [savingCode, setSavingCode] =
    useState("");

  const [workingId, setWorkingId] =
    useState("");

  const [userId, setUserId] =
    useState("");

  const [userEmail, setUserEmail] =
    useState("");

  const [levelFilter, setLevelFilter] =
    useState<LevelFilter>("all");

  /*
   * =========================================
   * KIỂM TRA ĐĂNG NHẬP + TẢI TỪ SUPABASE
   * =========================================
   */

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoadingWords(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (userError || !user) {
        setLoadingWords(false);

        router.replace("/login");

        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || "");

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
          "Lỗi tải vocabulary:",
          error
        );

        alert(
          "Không tải được từ vựng từ Supabase."
        );

        setLoadingWords(false);

        return;
      }

      const rows =
        (data || []) as VocabularyRow[];

      setWords(
        rows.map(rowToWord)
      );

      setLoadingWords(false);
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  /*
   * =========================================
   * TRA TỪ ĐIỂN
   * =========================================
   */

  async function searchDictionary() {
    const trimmedQuery = normalizeSearchValue(query);

    if (!trimmedQuery) {
      setResults([]);
      setSearchStatus("Hãy nhập từ hoặc nghĩa cần tìm.");
      return;
    }

    const direction = detectSearchDirection(trimmedQuery);
    setLoading(true);
    setResults([]);
    setSearchStatus("");

    const localMatches = words
      .filter((word) => {
        const fields = [
          word.korean,
          word.meaning,
          ...word.categories,
        ];

        return fields.some((field) =>
          matchesSearchValue(field, trimmedQuery)
        );
      })
      .sort((left, right) => {
        const leftExact = [left.korean, left.meaning].some(
          (field) =>
            normalizeSearchValue(field) === trimmedQuery
        );
        const rightExact = [right.korean, right.meaning].some(
          (field) =>
            normalizeSearchValue(field) === trimmedQuery
        );

        return Number(rightExact) - Number(leftExact);
      });

    if (localMatches.length > 0) {
      setResults(localMatches.map(wordToDictionaryResult));
      setSearchStatus(
        `Đã tìm thấy ${localMatches.length} từ trong kho cá nhân.`
      );
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/dictionary?q=${encodeURIComponent(
          trimmedQuery
        )}&direction=${direction}`
      );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Không tìm được từ."
        );

        return;
      }

      const dictionaryResults = (data.results || []).map(
        (item: DictionaryResult) => ({
          ...item,
          source: "dictionary" as const,
        })
      );

      if (dictionaryResults.length > 0) {
        setResults(dictionaryResults);
        setSearchStatus("Kết quả từ Korean Basic Dictionary.");
        return;
      }

      const aiResponse = await fetch("/api/ai/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmedQuery,
          mode: direction,
          style: "natural",
          customRequest:
            "Hãy trả về một từ hoặc cụm từ tiếng Hàn dạng từ điển phù hợp nhất, không dịch thành câu dài.",
        }),
      });

      const aiData = await aiResponse.json();
      const aiWord =
        aiData.vocabulary?.[0]?.korean ||
        (direction === "vi-ko" ? aiData.mainTranslation : trimmedQuery);
      const aiMeaning =
        aiData.vocabulary?.[0]?.meaning ||
        (direction === "vi-ko"
          ? trimmedQuery
          : aiData.naturalMeaning || aiData.mainTranslation || "");

      if (aiResponse.ok && aiData.ok && aiWord && aiMeaning) {
        setResults([
          {
            targetCode: "",
            word: aiWord,
            pronunciation: "",
            partOfSpeech: "",
            level: "",
            source: "ai",
            aiExplanation: aiData.explanation || "",
            meanings: [
              {
                koreanDefinition: "",
                vietnamese: aiMeaning,
                vietnameseDefinition: aiMeaning,
              },
            ],
          },
        ]);
        setSearchStatus(
          "Chưa có kết quả từ điển; Gemini đang cung cấp gợi ý để bạn kiểm tra."
        );
      } else {
        setSearchStatus("Không tìm thấy kết quả phù hợp.");
      }
    } catch {
      alert(
        "Không thể kết nối từ điển."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================
   * LƯU TỪ LÊN SUPABASE
   * =========================================
   */

  async function saveWord(
    item: DictionaryResult
  ) {
    if (!userId) {
      alert(
        "Bạn cần đăng nhập trước."
      );

      router.push("/login");

      return;
    }

    const alreadyExists = words.some((word) => {
      if (item.targetCode) {
        return word.targetCode === item.targetCode;
      }

      return matchesSearchValue(word.korean, item.word);
    });

    if (alreadyExists) {
      alert(
        "Từ này đã có trong danh sách."
      );

      return;
    }

    const savingKey = item.targetCode || item.word;
    setSavingCode(savingKey);

    let categories: string[] =
      [];

    let examples: string[] = [];

    /*
     * Lấy thông tin chi tiết
     * từ API 한국어기초사전
     */

    try {
      if (item.targetCode && item.source !== "ai") {
        const detailResponse =
          await fetch(
            `/api/dictionary/detail?code=${encodeURIComponent(
              item.targetCode
            )}`
          );

        if (detailResponse.ok) {
          const detail =
            await detailResponse.json();

          categories =
            detail.categories
              ?.map(
                (category: {
                  name: string;
                }) =>
                  category.name
              )
              .filter(Boolean) ||
            [];

          examples =
            detail.examples
              ?.map(
                (example: {
                  text: string;
                }) =>
                  example.text
              )
              .filter(Boolean)
              .slice(0, 5) ||
            [];
        }
      }
    } catch {
      /*
       * Detail lỗi vẫn cho phép
       * lưu dữ liệu cơ bản.
       */
    }

    const meaning =
      item.meanings
        ?.map(
          (meaning) =>
            meaning.vietnamese ||
            meaning.vietnameseDefinition
        )
        .filter(Boolean)
        .join("; ") ||
      "Chưa có nghĩa tiếng Việt";

    /*
     * Ghi dữ liệu vào Supabase.
     */

    const {
      data,
      error,
    } = await supabase
      .from("vocabulary")
      .insert({
        user_id: userId,

        target_code:
          item.targetCode ||
          null,

        korean:
          item.word,

        meaning,

        pronunciation:
          item.pronunciation ||
          null,

        part_of_speech:
          item.partOfSpeech ||
          null,

        level:
          item.level ||
          null,

        categories,

        examples,

        status:
          "learning",

        review_count:
          0,

        correct_count:
          0,

        wrong_count:
          0,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Lỗi lưu từ:",
        error
      );

      if (
        error.code === "23505"
      ) {
        alert(
          "Từ này đã được lưu trước đó."
        );
      } else {
        alert(
          `Không lưu được từ.\n${error.message}`
        );
      }

      setSavingCode("");

      return;
    }

    const newWord =
      rowToWord(
        data as VocabularyRow
      );

    setWords((old) => [
      newWord,
      ...old,
    ]);

    setSavingCode("");
  }

  /*
   * =========================================
   * XÓA TỪ
   * =========================================
   */

  async function removeWord(
    id: string
  ) {
    setWorkingId(id);

    const { error } =
      await supabase
        .from("vocabulary")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Lỗi xóa từ:",
        error
      );

      alert(
        "Không xóa được từ."
      );

      setWorkingId("");

      return;
    }

    setWords((old) =>
      old.filter(
        (word) =>
          word.id !== id
      )
    );

    setWorkingId("");
  }

  /*
   * =========================================
   * ĐỔI TRẠNG THÁI
   * =========================================
   */

  async function toggleStatus(
    id: string
  ) {
    const currentWord =
      words.find(
        (word) =>
          word.id === id
      );

    if (!currentWord) {
      return;
    }

    const nextStatus:
      | "learning"
      | "mastered" =
      currentWord.status ===
      "learning"
        ? "mastered"
        : "learning";

    setWorkingId(id);

    const { error } =
      await supabase
        .from("vocabulary")
        .update({
          status:
            nextStatus,
        })
        .eq("id", id);

    if (error) {
      console.error(
        "Lỗi cập nhật:",
        error
      );

      alert(
        "Không cập nhật được trạng thái."
      );

      setWorkingId("");

      return;
    }

    setWords((old) =>
      old.map((word) =>
        word.id === id
          ? {
              ...word,
              status:
                nextStatus,
            }
          : word
      )
    );

    setWorkingId("");
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

    utterance.lang = "ko-KR";

    window.speechSynthesis.speak(
      utterance
    );
  }

  /*
   * =========================================
   * LỌC TỪ
   * =========================================
   */

  const filteredWords =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      return words.filter(
        (word) => {
          const matchesSearch =
            word.korean
              .toLowerCase()
              .includes(q) ||
            word.meaning
              .toLowerCase()
              .includes(q) ||
            word.categories
              .join(" ")
              .toLowerCase()
              .includes(q);

          const matchesLevel =
            levelFilter ===
              "all" ||
            word.level ===
              levelFilter;

          return (
            matchesSearch &&
            matchesLevel
          );
        }
      );
    }, [
      words,
      search,
      levelFilter,
    ]);

  /*
   * =========================================
   * THỐNG KÊ
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

  const searchDirection = detectSearchDirection(query);

  /*
   * =========================================
   * LOADING
   * =========================================
   */

  if (loadingWords) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="text-5xl">
              🇰🇷
            </div>

            <p className="mt-4 font-semibold">
              Đang tải kho từ...
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Supabase đang đồng bộ dữ liệu.
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
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">

          <div>
            <p className="text-slate-400">
              단어장
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              📚 Từ vựng
            </h1>

            <p className="mt-2 text-slate-500">
              Tra, phân loại và xây dựng
              kho từ tiếng Hàn cá nhân.
            </p>
          </div>

          {userEmail && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
              <p className="text-xs text-slate-500">
                ☁️ Đang đồng bộ với
              </p>

              <p className="mt-1 max-w-[250px] truncate font-semibold text-slate-300">
                {userEmail}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* LEVEL STATS */}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">

        <Stat
          title="📚 Tổng từ"
          value={words.length}
        />

        <Stat
          title="🌱 Sơ cấp"
          value={beginner}
        />

        <Stat
          title="🌿 Trung cấp"
          value={intermediate}
        />

        <Stat
          title="🌳 Cao cấp"
          value={advanced}
        />

      </div>

      <VocabularyCollections words={words} />

      <CommunityCollections />

      {/* DICTIONARY */}

      <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">

        <div>
          <p className="text-sm text-slate-500">
            🇰🇷 한국어기초사전
          </p>

          <h2 className="mt-1 text-xl font-bold">
            🔎 Tra từ
          </h2>
        </div>

        <div className="mt-5 flex gap-3">

          <input
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key ===
                "Enter"
              ) {
                searchDictionary();
              }
            }}
            placeholder="Ví dụ: 신청하다"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg outline-none focus:border-slate-500"
          />

          <button
            onClick={
              searchDictionary
            }
            disabled={loading}
            className="rounded-xl bg-white px-6 py-3 font-bold text-black disabled:opacity-50"
          >
            {loading
              ? "Đang tìm..."
              : "Tìm"}
          </button>

        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 font-semibold text-slate-200">
            {searchDirection === "ko-vi" ? "KO → VI" : "VI → KO"}
          </span>
          <span className="text-slate-500">
            {searchDirection === "ko-vi"
              ? "Nhập Hangul để tìm nghĩa tiếng Việt."
              : "Nhập tiếng Việt có dấu hoặc không dấu để tìm tiếng Hàn."}
          </span>
        </div>

        {searchStatus && (
          <p className="mt-3 text-sm text-slate-400">
            {searchStatus}
          </p>
        )}
      </div>

      {/* SEARCH RESULTS */}

      {results.length > 0 && (
        <section className="mb-10">

          <h2 className="mb-3 text-xl font-bold">
            Kết quả
          </h2>

          <div className="space-y-4">

            {results.map(
              (
                item,
                index
              ) => {
                const meanings =
                  item.meanings
                    ?.map(
                      (meaning) =>
                        meaning.vietnamese ||
                        meaning.vietnameseDefinition
                    )
                    .filter(Boolean) ||
                  [];

                const isSaved = words.some((word) => {
                  if (item.targetCode) {
                    return word.targetCode === item.targetCode;
                  }

                  return matchesSearchValue(word.korean, item.word);
                });
                const resultKey = item.targetCode || item.word;

                return (
                  <div
                    key={`${item.targetCode}-${index}`}
                    className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
                  >

                    <div className="flex flex-col justify-between gap-5 md:flex-row">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h3 className="text-3xl font-bold">
                            {item.word}
                          </h3>

                          {item.level && (
                            <LevelBadge
                              level={
                                item.level
                              }
                            />
                          )}

                          {item.partOfSpeech && (
                            <Badge>
                              {
                                item.partOfSpeech
                              }
                            </Badge>
                          )}

                          {item.source === "ai" && (
                            <Badge>Gemini fallback</Badge>
                          )}

                        </div>

                        {item.pronunciation && (
                          <p className="mt-2 text-sm text-slate-500">
                            발음 [
                            {
                              item.pronunciation
                            }
                            ]
                          </p>
                        )}

                        <div className="mt-4 space-y-2">

                          {meanings
                            .slice(
                              0,
                              4
                            )
                            .map(
                              (
                                meaning,
                                meaningIndex
                              ) => (
                                <p
                                  key={
                                    meaningIndex
                                  }
                                  className="text-slate-200"
                                >
                                  🇻🇳{" "}
                                  {meaningIndex +
                                    1}
                                  .{" "}
                                  {
                                    meaning
                                  }
                                </p>
                              )
                            )}

                        </div>

                        {item.meanings?.[0]
                          ?.koreanDefinition && (
                          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
                            🇰🇷{" "}
                            {
                              item
                                .meanings[0]
                                .koreanDefinition
                            }
                          </p>
                        )}

                        {item.aiExplanation && (
                          <p className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/5 p-3 text-sm leading-6 text-violet-100">
                            ✨ {item.aiExplanation}
                          </p>
                        )}

                      </div>

                      <div className="flex shrink-0 gap-2">

                        <button
                          onClick={() =>
                            speak(
                              item.word
                            )
                          }
                          className="rounded-xl bg-slate-800 px-4 py-3"
                        >
                          🔊
                        </button>

                        <button
                          onClick={() =>
                            saveWord(
                              item
                            )
                          }
                          disabled={
                            savingCode ===
                              resultKey ||
                            isSaved
                          }
                          className="rounded-xl bg-white px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingCode ===
                          resultKey
                            ? "Đang lưu..."
                            : isSaved
                              ? "✓ Đã lưu"
                              : "+ Lưu"}
                        </button>

                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </section>
      )}

      {/* MY WORDS */}

      <section>

        <div className="mb-4">

          <h2 className="text-2xl font-bold">
            Từ của tôi
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            ☁️ Dữ liệu đang được lưu
            trên Supabase theo tài khoản.
          </p>

        </div>

        {/* FILTER */}

        <div className="mb-4 flex flex-wrap gap-2">

          <FilterButton
            active={
              levelFilter ===
              "all"
            }
            onClick={() =>
              setLevelFilter(
                "all"
              )
            }
          >
            Tất cả
          </FilterButton>

          <FilterButton
            active={
              levelFilter ===
              "초급"
            }
            onClick={() =>
              setLevelFilter(
                "초급"
              )
            }
          >
            🌱 Sơ cấp
          </FilterButton>

          <FilterButton
            active={
              levelFilter ===
              "중급"
            }
            onClick={() =>
              setLevelFilter(
                "중급"
              )
            }
          >
            🌿 Trung cấp
          </FilterButton>

          <FilterButton
            active={
              levelFilter ===
              "고급"
            }
            onClick={() =>
              setLevelFilter(
                "고급"
              )
            }
          >
            🌳 Cao cấp
          </FilterButton>

        </div>

        <input
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          placeholder="🔎 Tìm từ, nghĩa hoặc chủ đề..."
          className="mb-6 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 outline-none"
        />

        <div className="space-y-4">

          {filteredWords.map(
            (word) => (
              <div
                key={word.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >

                <div className="flex flex-col justify-between gap-5 md:flex-row">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-2xl font-bold">
                        {
                          word.korean
                        }
                      </h3>

                      {word.level && (
                        <LevelBadge
                          level={
                            word.level
                          }
                        />
                      )}

                      {word.partOfSpeech && (
                        <Badge>
                          {
                            word.partOfSpeech
                          }
                        </Badge>
                      )}

                    </div>

                    <p className="mt-3 text-slate-300">
                      {
                        word.meaning
                      }
                    </p>

                    {word.pronunciation && (
                      <p className="mt-1 text-sm text-slate-500">
                        [
                        {
                          word.pronunciation
                        }
                        ]
                      </p>
                    )}

                    {word.categories.length >
                      0 && (
                      <div className="mt-4 flex flex-wrap gap-2">

                        {word.categories.map(
                          (
                            category,
                            index
                          ) => (
                            <span
                              key={`${category}-${index}`}
                              className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-200"
                            >
                              🏷{" "}
                              {
                                category
                              }
                            </span>
                          )
                        )}

                      </div>
                    )}

                    {word.examples.length >
                      0 && (
                      <div className="mt-4 rounded-xl bg-slate-950 p-4">

                        <p className="mb-2 text-xs font-semibold text-slate-500">
                          Ví dụ
                        </p>

                        <p className="leading-7 text-slate-300">
                          🇰🇷{" "}
                          {
                            word
                              .examples[0]
                          }
                        </p>

                      </div>
                    )}

                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">

                    <button
                      onClick={() =>
                        speak(
                          word.korean
                        )
                      }
                      className="rounded-xl bg-slate-800 px-3 py-2"
                    >
                      🔊
                    </button>

                    <button
                      onClick={() =>
                        toggleStatus(
                          word.id
                        )
                      }
                      disabled={
                        workingId ===
                        word.id
                      }
                      className="rounded-xl bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {word.status ===
                      "mastered"
                        ? "🟢 Đã thuộc"
                        : "🟡 Đang học"}
                    </button>

                    <CollectionPicker word={word} />

                    <button
                      onClick={() =>
                        removeWord(
                          word.id
                        )
                      }
                      disabled={
                        workingId ===
                        word.id
                      }
                      className="rounded-xl bg-slate-800 px-3 py-2 disabled:opacity-50"
                    >
                      🗑️
                    </button>

                  </div>

                </div>

              </div>
            )
          )}

          {filteredWords.length ===
            0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">

              <div className="text-5xl">
                📖
              </div>

              <p className="mt-4 font-bold">
                Chưa có từ nào
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Hãy tra một từ phía
                trên rồi bấm + Lưu.
              </p>

            </div>
          )}

        </div>

      </section>

    </AppShell>
  );
}

/*
 * =========================================
 * COMPONENTS
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

function Badge({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
      {children}
    </span>
  );
}

function LevelBadge({
  level,
}: {
  level: string;
}) {
  let label = level;

  if (level === "초급") {
    label =
      "🌱 Sơ cấp";
  }

  if (level === "중급") {
    label =
      "🌿 Trung cấp";
  }

  if (level === "고급") {
    label =
      "🌳 Cao cấp";
  }

  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold">
      {label}
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
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm transition ${
        active
          ? "bg-white font-semibold text-black"
          : "bg-slate-900 text-slate-400 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
