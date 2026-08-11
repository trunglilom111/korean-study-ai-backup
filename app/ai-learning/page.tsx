"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { createClient } from "@/utils/supabase/client";
import { apiFetch } from "@/utils/api-client";
import AiTranslate from "@/components/AiTranslate";
/* =========================================================
   TYPES
========================================================= */

type Tab =
  | "vocabulary"
  | "grammar"
  | "translate"
  | "scan";

type AiWord = {
  korean: string;
  meaning: string;
  partOfSpeech: string;
  level: string;
  exampleKorean: string;
  exampleVietnamese: string;
  memoryTip: string;
};

type AiVocabularyResponse = {
  ok: boolean;
  provider?: string;
  title?: string;
  description?: string;
  vocabulary?: AiWord[];
  error?: string;
};

type DictionaryResult = {
  targetCode: string;
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  level: string;

  meanings: {
    koreanDefinition: string;
    vietnamese: string;
    vietnameseDefinition: string;
  }[];
};

type AiGrammar = {
  pattern: string;
  meaning: string;
  formula: string;
  explanation: string;
  level: string;
  exampleKorean: string;
  exampleVietnamese: string;
  usageNote: string;
  commonMistake: string;
  tags: string[];
};

type AiGrammarResponse = {
  ok: boolean;
  provider?: string;
  title?: string;
  description?: string;
  grammar?: AiGrammar[];
  error?: string;
};

/* =========================================================
   MAIN
========================================================= */

export default function AiLearningPage() {
  const router = useRouter();

  const [supabase] =
    useState(() =>
      createClient()
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<Tab>(
      "vocabulary"
    );

  const [
    userId,
    setUserId,
  ] =
    useState("");

  const [
    authReady,
    setAuthReady,
  ] =
    useState(false);

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    let cancelled =
      false;

    async function checkUser() {
      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (!user) {
        router.replace(
          "/login"
        );

        return;
      }

      setUserId(
        user.id
      );

      setAuthReady(
        true
      );
    }

    checkUser();

    return () => {
      cancelled =
        true;
    };
  }, [
    router,
    supabase,
  ]);

  if (
    !authReady
  ) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="text-6xl">
              ✨
            </div>

            <p className="mt-4 font-semibold">
              Đang chuẩn bị AI...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="mb-8">

        <p className="text-slate-400">
          AI 학습 자료
        </p>

        <h1 className="text-3xl font-bold md:text-4xl">
          ✨ Học liệu AI
        </h1>

        <p className="mt-2 max-w-3xl text-slate-500">
          Gemini giúp tổng hợp học liệu.
          Từ khó mới đưa vào Flashcard,
          ngữ pháp cần học mới lưu vào
          kho cá nhân.
        </p>

      </div>

      {/* ===================================================
          TAB
      =================================================== */}

      <div className="mb-8 grid grid-cols-2 gap-2 lg:grid-cols-4">

        <TabButton
          active={
            activeTab ===
            "vocabulary"
          }
          onClick={() =>
            setActiveTab(
              "vocabulary"
            )
          }
          icon="📚"
          title="Từ vựng AI"
        />

        <TabButton
          active={
            activeTab ===
            "grammar"
          }
          onClick={() =>
            setActiveTab(
              "grammar"
            )
          }
          icon="🧩"
          title="Ngữ pháp AI"
        />

        <TabButton
          active={
            activeTab ===
            "translate"
          }
          onClick={() =>
            setActiveTab(
              "translate"
            )
          }
          icon="✍️"
          title="Dịch câu AI"
        />

        <TabButton
          active={
            activeTab ===
            "scan"
          }
          onClick={() =>
            setActiveTab(
              "scan"
            )
          }
          icon="📷"
          title="Scan ảnh"
        />

      </div>

      {/* ===================================================
          CONTENT
      =================================================== */}

      {activeTab ===
        "vocabulary" && (
        <VocabularyAi
          userId={
            userId
          }
          supabase={
            supabase
          }
        />
      )}

      {activeTab ===
        "grammar" && (
        <GrammarAi
          userId={
            userId
          }
          supabase={
            supabase
          }
        />
      )}

      {activeTab === "translate" && (
  <AiTranslate />
)}

      {activeTab ===
        "scan" && (
        <ComingSoon
          icon="📷"
          title="Scan giáo trình"
          text="Sau phần dịch câu, Gemini sẽ đọc ảnh giáo trình và tự tách từ vựng + ngữ pháp."
        />
      )}

    </AppShell>
  );
}

/* =========================================================
   VOCABULARY AI
========================================================= */

function VocabularyAi({
  userId,
  supabase,
}: {
  userId: string;
  supabase: ReturnType<
    typeof createClient
  >;
}) {
  const [
    topic,
    setTopic,
  ] =
    useState("");

  const [
    level,
    setLevel,
  ] =
    useState(
      "sơ cấp"
    );

  const [
    count,
    setCount,
  ] =
    useState(15);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    result,
    setResult,
  ] =
    useState<
      AiVocabularyResponse | null
    >(null);

  const [
    selected,
    setSelected,
  ] =
    useState<
      Set<number>
    >(
      new Set()
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    saveProgress,
    setSaveProgress,
  ] =
    useState("");

  async function generateVocabulary() {
    if (
      !topic.trim()
    ) {
      alert(
        "Hãy nhập chủ đề muốn học."
      );

      return;
    }

    setLoading(
      true
    );

    setResult(
      null
    );

    setSelected(
      new Set()
    );

    try {
      const response =
        await apiFetch(
          "/api/ai/vocabulary",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                topic:
                  topic.trim(),

                level,

                count,
              }),
          }
        );

      const data =
        (await response.json()) as
          AiVocabularyResponse;

      if (
        !response.ok ||
        !data.ok
      ) {
        alert(
          data.error ||
            "AI không thể tổng hợp từ vựng."
        );

        return;
      }

      setResult(
        data
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      alert(
        "Không kết nối được Gemini."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  function toggleSelect(
    index: number
  ) {
    setSelected(
      (
        old
      ) => {
        const next =
          new Set(
            old
          );

        if (
          next.has(
            index
          )
        ) {
          next.delete(
            index
          );
        } else {
          next.add(
            index
          );
        }

        return next;
      }
    );
  }

  function selectAll() {
    if (
      !result?.vocabulary
    ) {
      return;
    }

    setSelected(
      new Set(
        result.vocabulary.map(
          (
            _,
            index
          ) =>
            index
        )
      )
    );
  }

  function clearSelection() {
    setSelected(
      new Set()
    );
  }

  async function findDictionaryWord(
    korean: string
  ): Promise<
    DictionaryResult | null
  > {
    try {
      const response =
        await apiFetch(
          `/api/dictionary?q=${encodeURIComponent(
            korean
          )}`
        );

      if (
        !response.ok
      ) {
        return null;
      }

      const data =
        await response.json();

      const results:
        DictionaryResult[] =
        data.results ||
        [];

      const exact =
        results.find(
          (
            item
          ) =>
            item.word.trim() ===
            korean.trim()
        );

      return (
        exact ||
        results[0] ||
        null
      );
    } catch {
      return null;
    }
  }

  async function saveSelectedWords() {
    if (
      !result?.vocabulary
    ) {
      return;
    }

    const selectedWords =
      result.vocabulary.filter(
        (
          _,
          index
        ) =>
          selected.has(
            index
          )
      );

    if (
      selectedWords.length ===
      0
    ) {
      alert(
        "Bạn chưa chọn từ nào."
      );

      return;
    }

    setSaving(
      true
    );

    let savedCount =
      0;

    let skippedCount =
      0;

    for (
      let index = 0;
      index <
      selectedWords.length;
      index++
    ) {
      const aiWord =
        selectedWords[
          index
        ];

      setSaveProgress(
        `Đang xử lý ${index + 1}/${selectedWords.length}: ${aiWord.korean}`
      );

      const dictionaryWord =
        await findDictionaryWord(
          aiWord.korean
        );

      let targetCode:
        | string
        | null =
        null;

      let korean =
        aiWord.korean;

      let meaning =
        aiWord.meaning;

      let pronunciation =
        "";

      let partOfSpeech =
        aiWord.partOfSpeech;

      let wordLevel =
        aiWord.level;

      if (
        dictionaryWord
      ) {
        targetCode =
          dictionaryWord.targetCode ||
          null;

        korean =
          dictionaryWord.word ||
          aiWord.korean;

        pronunciation =
          dictionaryWord.pronunciation ||
          "";

        partOfSpeech =
          dictionaryWord.partOfSpeech ||
          aiWord.partOfSpeech;

        wordLevel =
          dictionaryWord.level ||
          aiWord.level;

        const dictionaryMeaning =
          dictionaryWord.meanings
            ?.map(
              (
                item
              ) =>
                item.vietnamese ||
                item.vietnameseDefinition
            )
            .filter(
              Boolean
            )
            .join(
              "; "
            );

        if (
          dictionaryMeaning
        ) {
          meaning =
            dictionaryMeaning;
        }
      }

      let duplicateQuery =
        supabase
          .from(
            "vocabulary"
          )
          .select(
            "id"
          )
          .eq(
            "user_id",
            userId
          );

      if (
        targetCode
      ) {
        duplicateQuery =
          duplicateQuery.eq(
            "target_code",
            targetCode
          );
      } else {
        duplicateQuery =
          duplicateQuery.eq(
            "korean",
            korean
          );
      }

      const {
        data:
          duplicate,
      } =
        await duplicateQuery.limit(
          1
        );

      if (
        duplicate &&
        duplicate.length >
          0
      ) {
        skippedCount++;

        continue;
      }

      if (
        !dictionaryWord?.level
      ) {
        if (
          wordLevel ===
          "sơ cấp"
        ) {
          wordLevel =
            "초급";
        }

        if (
          wordLevel ===
          "trung cấp"
        ) {
          wordLevel =
            "중급";
        }

        if (
          wordLevel ===
          "cao cấp"
        ) {
          wordLevel =
            "고급";
        }
      }

      const {
        error,
      } =
        await supabase
          .from(
            "vocabulary"
          )
          .insert({
            user_id:
              userId,

            target_code:
              targetCode,

            korean,

            meaning,

            pronunciation:
              pronunciation ||
              null,

            part_of_speech:
              partOfSpeech ||
              null,

            level:
              wordLevel ||
              null,

            categories: [
              topic.trim(),
              "AI",
            ],

            examples:
              aiWord.exampleKorean
                ? [
                    aiWord.exampleKorean,
                  ]
                : [],

            status:
              "learning",

            review_count:
              0,

            correct_count:
              0,

            wrong_count:
              0,
          });

      if (
        error
      ) {
        console.error(
          error
        );

        skippedCount++;

        continue;
      }

      savedCount++;
    }

    setSaving(
      false
    );

    setSaveProgress(
      ""
    );

    setSelected(
      new Set()
    );

    alert(
      `✅ Đã thêm ${savedCount} từ.\n⏭️ Bỏ qua ${skippedCount} từ.`
    );
  }

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

  const vocabulary = useMemo(
    () => result?.vocabulary || [],
    [result?.vocabulary]
  );

  const selectedCount =
    selected.size;

  const selectedWords =
    useMemo(
      () =>
        vocabulary.filter(
          (
            _,
            index
          ) =>
            selected.has(
              index
            )
        ),
      [
        vocabulary,
        selected,
      ]
    );

  return (
    <>

      {/* FORM */}

      <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">

        <p className="text-sm text-slate-500">
          ✨ Gemini
        </p>

        <h2 className="mt-1 text-xl font-bold">
          Tổng hợp bộ từ vựng
        </h2>

        <div className="mt-6 grid gap-4">

          <input
            value={
              topic
            }
            onChange={(
              e
            ) =>
              setTopic(
                e.target.value
              )
            }
            placeholder="Ví dụ: bệnh viện, đại học, đi làm thêm..."
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
          />

          <div className="grid gap-4 md:grid-cols-2">

            <select
              value={
                level
              }
              onChange={(
                e
              ) =>
                setLevel(
                  e.target.value
                )
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
            >

              <option value="sơ cấp">
                🌱 Sơ cấp
              </option>

              <option value="trung cấp">
                🌿 Trung cấp
              </option>

              <option value="cao cấp">
                🌳 Cao cấp
              </option>

              <option value="tự động">
                🤖 Tự động
              </option>

            </select>

            <select
              value={
                count
              }
              onChange={(
                e
              ) =>
                setCount(
                  Number(
                    e.target.value
                  )
                )
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
            >

              <option value={10}>
                10 từ
              </option>

              <option value={15}>
                15 từ
              </option>

              <option value={20}>
                20 từ
              </option>

              <option value={30}>
                30 từ
              </option>

            </select>

          </div>

          <button
            onClick={
              generateVocabulary
            }
            disabled={
              loading
            }
            className="rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
          >
            {loading
              ? "✨ Gemini đang tổng hợp..."
              : "✨ Tổng hợp từ vựng"}
          </button>

        </div>

      </div>

      {/* RESULTS */}

      {result &&
        vocabulary.length >
          0 && (
          <>

            <div className="mb-5">

              <h2 className="text-2xl font-bold">
                {
                  result.title
                }
              </h2>

              <p className="mt-2 text-slate-500">
                {
                  result.description
                }
              </p>

            </div>

            <div className="sticky top-3 z-20 mb-5 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 backdrop-blur">

              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">

                <p className="font-semibold">
                  ☑️ Đã chọn{" "}
                  {
                    selectedCount
                  }{" "}
                  từ
                </p>

                <div className="flex flex-wrap gap-2">

                  <button
                    onClick={
                      selectAll
                    }
                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm"
                  >
                    Chọn tất cả
                  </button>

                  <button
                    onClick={
                      clearSelection
                    }
                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm"
                  >
                    Bỏ chọn
                  </button>

                  <button
                    onClick={
                      saveSelectedWords
                    }
                    disabled={
                      saving ||
                      selectedCount ===
                        0
                    }
                    className="rounded-xl bg-white px-5 py-2 font-bold text-black disabled:opacity-50"
                  >
                    📚 + Thêm vào Từ của tôi
                  </button>

                </div>

              </div>

              {saving && (
                <p className="mt-3 text-sm text-slate-400">
                  ☁️{" "}
                  {
                    saveProgress
                  }
                </p>
              )}

            </div>

            <div className="space-y-4">

              {vocabulary.map(
                (
                  word,
                  index
                ) => {
                  const checked =
                    selected.has(
                      index
                    );

                  return (
                    <div
                      key={`${word.korean}-${index}`}
                      onClick={() =>
                        toggleSelect(
                          index
                        )
                      }
                      className={`cursor-pointer rounded-3xl border p-5 transition ${
                        checked
                          ? "border-white bg-slate-800"
                          : "border-slate-800 bg-slate-900"
                      }`}
                    >

                      <div className="flex gap-4">

                        <div
                          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                            checked
                              ? "border-white bg-white text-black"
                              : "border-slate-600"
                          }`}
                        >
                          {checked
                            ? "✓"
                            : ""}
                        </div>

                        <div className="min-w-0 flex-1">

                          <h3 className="text-2xl font-bold">
                            {
                              word.korean
                            }
                          </h3>

                          <p className="mt-2 text-slate-200">
                            🇻🇳{" "}
                            {
                              word.meaning
                            }
                          </p>

                          {word.exampleKorean && (
                            <div className="mt-4 rounded-xl bg-slate-950 p-4">

                              <div className="flex justify-between gap-3">

                                <p>
                                  🇰🇷{" "}
                                  {
                                    word.exampleKorean
                                  }
                                </p>

                                <button
                                  onClick={(
                                    e
                                  ) => {
                                    e.stopPropagation();

                                    speak(
                                      word.exampleKorean
                                    );
                                  }}
                                >
                                  🔊
                                </button>

                              </div>

                              <p className="mt-2 text-sm text-slate-500">
                                🇻🇳{" "}
                                {
                                  word.exampleVietnamese
                                }
                              </p>

                            </div>
                          )}

                          {word.memoryTip && (
                            <p className="mt-3 text-sm text-amber-200/80">
                              💡{" "}
                              {
                                word.memoryTip
                              }
                            </p>
                          )}

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

            {selectedWords.length >
              0 && (
              <div className="mt-6 rounded-2xl bg-slate-900 p-5">

                <p className="text-sm text-slate-500">
                  Sẽ đưa vào Flashcard
                </p>

                <div className="mt-3 flex flex-wrap gap-2">

                  {selectedWords.map(
                    (
                      word,
                      index
                    ) => (
                      <span
                        key={`${word.korean}-${index}`}
                        className="rounded-full bg-slate-800 px-3 py-2 text-sm"
                      >
                        {
                          word.korean
                        }
                      </span>
                    )
                  )}

                </div>

              </div>
            )}

          </>
        )}

    </>
  );
}

/* =========================================================
   GRAMMAR AI
========================================================= */

function GrammarAi({
  userId,
  supabase,
}: {
  userId: string;
  supabase: ReturnType<
    typeof createClient
  >;
}) {
  const [
    book,
    setBook,
  ] =
    useState(
      "서울대 한국어"
    );

  const [
    bookPart,
    setBookPart,
  ] =
    useState(
      "1A"
    );

  const [
    unit,
    setUnit,
  ] =
    useState("");

  const [
    level,
    setLevel,
  ] =
    useState(
      "sơ cấp"
    );

  const [
    requestText,
    setRequestText,
  ] =
    useState("");

  const [
    count,
    setCount,
  ] =
    useState(8);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    result,
    setResult,
  ] =
    useState<
      AiGrammarResponse | null
    >(null);

  const [
    selected,
    setSelected,
  ] =
    useState<
      Set<number>
    >(
      new Set()
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    saveProgress,
    setSaveProgress,
  ] =
    useState("");

  async function generateGrammar() {
    setLoading(
      true
    );

    setResult(
      null
    );

    setSelected(
      new Set()
    );

    try {
      const unitText =
        unit.trim()
          ? `${bookPart} - Bài ${unit.trim()}`
          : bookPart;

      const response =
        await apiFetch(
          "/api/ai/grammar",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                source:
                  `Tổng hợp ngữ pháp phục vụ việc học ${book}`,

                book,

                level,

                unit:
                  unitText,

                request:
                  requestText.trim(),

                count,
              }),
          }
        );

      const data =
        (await response.json()) as
          AiGrammarResponse;

      if (
        !response.ok ||
        !data.ok
      ) {
        alert(
          data.error ||
            "Không tổng hợp được ngữ pháp."
        );

        return;
      }

      setResult(
        data
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      alert(
        "Không kết nối được Gemini."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  function toggleSelect(
    index: number
  ) {
    setSelected(
      (
        old
      ) => {
        const next =
          new Set(
            old
          );

        if (
          next.has(
            index
          )
        ) {
          next.delete(
            index
          );
        } else {
          next.add(
            index
          );
        }

        return next;
      }
    );
  }

  function selectAll() {
    if (
      !result?.grammar
    ) {
      return;
    }

    setSelected(
      new Set(
        result.grammar.map(
          (
            _,
            index
          ) =>
            index
        )
      )
    );
  }

  function clearSelection() {
    setSelected(
      new Set()
    );
  }

  function normalizeLevel() {
    if (
      level ===
      "sơ cấp"
    ) {
      return "초급";
    }

    if (
      level ===
      "trung cấp"
    ) {
      return "중급";
    }

    if (
      level ===
      "cao cấp"
    ) {
      return "고급";
    }

    return null;
  }

  async function saveSelectedGrammar() {
    if (
      !result?.grammar
    ) {
      return;
    }

    const selectedItems =
      result.grammar.filter(
        (
          _,
          index
        ) =>
          selected.has(
            index
          )
      );

    if (
      selectedItems.length ===
      0
    ) {
      alert(
        "Bạn chưa chọn ngữ pháp nào."
      );

      return;
    }

    setSaving(
      true
    );

    let saved =
      0;

    let skipped =
      0;

    for (
      let index = 0;
      index <
      selectedItems.length;
      index++
    ) {
      const item =
        selectedItems[
          index
        ];

      setSaveProgress(
        `Đang lưu ${index + 1}/${selectedItems.length}: ${item.pattern}`
      );

      /*
       * Kiểm tra trùng
       */

      const {
        data:
          duplicate,
      } =
        await supabase
          .from(
            "grammar"
          )
          .select(
            "id"
          )
          .eq(
            "user_id",
            userId
          )
          .eq(
            "pattern",
            item.pattern
          )
          .limit(
            1
          );

      if (
        duplicate &&
        duplicate.length >
          0
      ) {
        skipped++;

        continue;
      }

      /*
       * Gộp phần AI giải thích thành
       * phần explanation dễ đọc.
       */

      const explanationParts =
        [
          item.formula
            ? `🔧 Công thức:\n${item.formula}`
            : "",

          item.explanation
            ? `📖 Giải thích:\n${item.explanation}`
            : "",

          item.usageNote
            ? `💡 Lưu ý:\n${item.usageNote}`
            : "",

          item.commonMistake
            ? `⚠️ Lỗi thường gặp:\n${item.commonMistake}`
            : "",
        ].filter(
          Boolean
        );

      const fullExplanation =
        explanationParts.join(
          "\n\n"
        );

      const unitNumber =
        Number(
          unit
        );

      const {
        error,
      } =
        await supabase
          .from(
            "grammar"
          )
          .insert({
            user_id:
              userId,

            pattern:
              item.pattern,

            meaning:
              item.meaning,

            explanation:
              fullExplanation,

            level:
              normalizeLevel(),

            examples: [
              {
                korean:
                  item.exampleKorean,

                vietnamese:
                  item.exampleVietnamese,
              },
            ],

            tags:
              item.tags ||
              [],

            notes:
              "",

            status:
              "learning",

            source_type:
              "ai",

            source_name:
              book,

            book_level:
              bookPart,

            book_part:
              bookPart.slice(
                -1
              ),

            unit_number:
              Number.isFinite(
                unitNumber
              ) &&
              unitNumber >
                0
                ? unitNumber
                : null,

            unit_title:
              null,

            source_page:
              null,

            ai_generated:
              true,

            sort_order:
              index,
          });

      if (
        error
      ) {
        console.error(
          `Không lưu ${item.pattern}:`,
          error
        );

        skipped++;

        continue;
      }

      saved++;
    }

    setSaving(
      false
    );

    setSaveProgress(
      ""
    );

    setSelected(
      new Set()
    );

    alert(
      `✅ Đã lưu ${saved} mẫu ngữ pháp.\n⏭️ Bỏ qua ${skipped} mẫu trùng hoặc lỗi.`
    );
  }

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

  const grammar =
    result?.grammar ||
    [];

  return (
    <>

      {/* ===================================================
          WARNING
      =================================================== */}

      <div className="mb-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4">

        <p className="font-semibold text-amber-200">
          📚 Về giáo trình Seoul
        </p>

        <p className="mt-2 text-sm leading-6 text-amber-200/70">
          Khi chưa scan trang sách,
          Gemini chỉ đang tổng hợp theo
          yêu cầu học tập của bạn. Không
          nên xem số bài/trang do AI suy
          ra là dữ liệu chính thức của
          giáo trình.
        </p>

      </div>

      {/* ===================================================
          FORM
      =================================================== */}

      <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">

        <p className="text-sm text-slate-500">
          🧩 Gemini Grammar
        </p>

        <h2 className="mt-1 text-xl font-bold">
          Tổng hợp ngữ pháp
        </h2>

        <div className="mt-6 grid gap-4">

          {/* BOOK */}

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              📚 Giáo trình
            </label>

            <select
              value={
                book
              }
              onChange={(
                e
              ) =>
                setBook(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
            >

              <option value="서울대 한국어">
                서울대 한국어
              </option>

              <option value="서울대 한국어+">
                서울대 한국어+
              </option>

              <option value="Tự chọn">
                Khác / tự chọn
              </option>

            </select>

          </div>

          <div className="grid gap-4 md:grid-cols-3">

            {/* BOOK PART */}

            <div>

              <label className="mb-2 block text-sm text-slate-400">
                📖 Quyển
              </label>

              <select
                value={
                  bookPart
                }
                onChange={(
                  e
                ) =>
                  setBookPart(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
              >

                {[
                  "1A",
                  "1B",
                  "2A",
                  "2B",
                  "3A",
                  "3B",
                  "4A",
                  "4B",
                  "5A",
                  "5B",
                  "6A",
                  "6B",
                ].map(
                  (
                    value
                  ) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {
                        value
                      }
                    </option>
                  )
                )}

              </select>

            </div>

            {/* UNIT */}

            <div>

              <label className="mb-2 block text-sm text-slate-400">
                📑 Bài
              </label>

              <input
                value={
                  unit
                }
                onChange={(
                  e
                ) =>
                  setUnit(
                    e.target.value
                  )
                }
                placeholder="VD: 3"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
              />

            </div>

            {/* LEVEL */}

            <div>

              <label className="mb-2 block text-sm text-slate-400">
                🎯 Trình độ
              </label>

              <select
                value={
                  level
                }
                onChange={(
                  e
                ) =>
                  setLevel(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
              >

                <option value="sơ cấp">
                  🌱 Sơ cấp
                </option>

                <option value="trung cấp">
                  🌿 Trung cấp
                </option>

                <option value="cao cấp">
                  🌳 Cao cấp
                </option>

              </select>

            </div>

          </div>

          {/* CUSTOM REQUEST */}

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              ✨ Yêu cầu riêng
            </label>

            <textarea
              value={
                requestText
              }
              onChange={(
                e
              ) =>
                  setRequestText(
                    e.target.value
                  )
              }
              placeholder="Ví dụ: Tổng hợp các mẫu diễn tả nguyên nhân, so sánh điểm khác nhau và cho ví dụ dễ hiểu..."
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 leading-7 outline-none"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Số mẫu tối đa
            </label>

            <select
              value={
                count
              }
              onChange={(
                e
              ) =>
                  setCount(
                    Number(
                      e.target.value
                    )
                  )
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
            >

              <option value={5}>
                5 mẫu
              </option>

              <option value={8}>
                8 mẫu
              </option>

              <option value={10}>
                10 mẫu
              </option>

              <option value={15}>
                15 mẫu
              </option>

              <option value={20}>
                20 mẫu
              </option>

            </select>

          </div>

          <button
            onClick={
              generateGrammar
            }
            disabled={
              loading
            }
            className="rounded-2xl bg-white py-4 text-lg font-bold text-black disabled:opacity-50"
          >
            {loading
              ? "🧩 Gemini đang tổng hợp..."
              : "✨ Tổng hợp ngữ pháp"}
          </button>

        </div>

      </div>

      {/* ===================================================
          RESULT
      =================================================== */}

      {result &&
        grammar.length >
          0 && (
          <>

            <div className="mb-5">

              <h2 className="text-2xl font-bold">
                {
                  result.title
                }
              </h2>

              {result.description && (
                <p className="mt-2 text-slate-500">
                  {
                    result.description
                  }
                </p>
              )}

            </div>

            {/* SELECT BAR */}

            <div className="sticky top-3 z-20 mb-5 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 backdrop-blur">

              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">

                <p className="font-semibold">
                  ☑️ Đã chọn{" "}
                  {
                    selected.size
                  }{" "}
                  mẫu
                </p>

                <div className="flex flex-wrap gap-2">

                  <button
                    onClick={
                      selectAll
                    }
                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm"
                  >
                    Chọn tất cả
                  </button>

                  <button
                    onClick={
                      clearSelection
                    }
                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm"
                  >
                    Bỏ chọn
                  </button>

                  <button
                    onClick={
                      saveSelectedGrammar
                    }
                    disabled={
                      saving ||
                      selected.size ===
                        0
                    }
                    className="rounded-xl bg-white px-5 py-2 font-bold text-black disabled:opacity-50"
                  >
                    🧩 + Lưu vào Ngữ pháp
                  </button>

                </div>

              </div>

              {saving && (
                <p className="mt-3 text-sm text-slate-400">
                  ☁️{" "}
                  {
                    saveProgress
                  }
                </p>
              )}

            </div>

            {/* CARDS */}

            <div className="space-y-4">

              {grammar.map(
                (
                  item,
                  index
                ) => {
                  const checked =
                    selected.has(
                      index
                    );

                  return (
                    <div
                      key={`${item.pattern}-${index}`}
                      onClick={() =>
                        toggleSelect(
                          index
                        )
                      }
                      className={`cursor-pointer rounded-3xl border p-5 transition md:p-6 ${
                        checked
                          ? "border-white bg-slate-800"
                          : "border-slate-800 bg-slate-900 hover:border-slate-700"
                      }`}
                    >

                      <div className="flex items-start gap-4">

                        <div
                          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                            checked
                              ? "border-white bg-white text-black"
                              : "border-slate-600"
                          }`}
                        >
                          {checked
                            ? "✓"
                            : ""}
                        </div>

                        <div className="min-w-0 flex-1">

                          {/* PATTERN */}

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="text-2xl font-bold md:text-3xl">
                              {
                                item.pattern
                              }
                            </h3>

                            {item.level && (
                              <Badge>
                                {
                                  item.level
                                }
                              </Badge>
                            )}

                          </div>

                          {/* MEANING */}

                          <p className="mt-3 text-lg text-slate-200">
                            🇻🇳{" "}
                            {
                              item.meaning
                            }
                          </p>

                          {/* FORMULA */}

                          {item.formula && (
                            <InfoBox
                              title="🔧 Công thức"
                              text={
                                item.formula
                              }
                            />
                          )}

                          {/* EXPLANATION */}

                          {item.explanation && (
                            <InfoBox
                              title="📖 Giải thích"
                              text={
                                item.explanation
                              }
                            />
                          )}

                          {/* EXAMPLE */}

                          {item.exampleKorean && (
                            <div className="mt-4 rounded-2xl bg-slate-950 p-4">

                              <div className="flex items-start justify-between gap-3">

                                <p className="leading-7 text-slate-200">
                                  🇰🇷{" "}
                                  {
                                    item.exampleKorean
                                  }
                                </p>

                                <button
                                  onClick={(
                                    event
                                  ) => {
                                    event.stopPropagation();

                                    speak(
                                      item.exampleKorean
                                    );
                                  }}
                                  className="shrink-0 rounded-lg bg-slate-800 px-3 py-2"
                                >
                                  🔊
                                </button>

                              </div>

                              <p className="mt-2 text-sm leading-6 text-slate-500">
                                🇻🇳{" "}
                                {
                                  item.exampleVietnamese
                                }
                              </p>

                            </div>
                          )}

                          {/* NOTES */}

                          {item.usageNote && (
                            <InfoBox
                              title="💡 Khi nào dùng?"
                              text={
                                item.usageNote
                              }
                            />
                          )}

                          {item.commonMistake && (
                            <InfoBox
                              title="⚠️ Lỗi dễ mắc"
                              text={
                                item.commonMistake
                              }
                            />
                          )}

                          {/* TAGS */}

                          {item.tags &&
                            item.tags.length >
                              0 && (
                            <div className="mt-4 flex flex-wrap gap-2">

                              {item.tags.map(
                                (
                                  tag,
                                  tagIndex
                                ) => (
                                  <span
                                    key={`${tag}-${tagIndex}`}
                                    className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-200"
                                  >
                                    🏷{" "}
                                    {
                                      tag
                                    }
                                  </span>
                                )
                              )}

                            </div>
                          )}

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </>
        )}

      {!result &&
        !loading && (
          <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center">

            <div className="text-6xl">
              🧩
            </div>

            <h2 className="mt-4 text-xl font-bold">
              Chọn giáo trình rồi nhờ AI
              tổng hợp
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Sau này Scan ảnh sẽ giúp
              xác định chính xác ngữ pháp
              từ trang sách bạn đang học.
            </p>

          </div>
        )}

    </>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function TabButton({
  active,
  onClick,
  icon,
  title,
}: {
  active: boolean;
  onClick:
    () => void;
  icon: string;
  title: string;
}) {
  return (
    <button
      onClick={
        onClick
      }
      className={`rounded-2xl px-3 py-4 font-semibold transition ${
        active
          ? "bg-white text-black"
          : "bg-slate-900 text-slate-400 hover:bg-slate-800"
      }`}
    >
      <span className="mr-2">
        {icon}
      </span>

      {title}
    </button>
  );
}

function Badge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs text-slate-400">
      {children}
    </span>
  );
}

function InfoBox({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">

      <p className="text-xs font-semibold text-slate-500">
        {title}
      </p>

      <p className="mt-2 whitespace-pre-line leading-7 text-slate-300">
        {text}
      </p>

    </div>
  );
}

function ComingSoon({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center">

      <div className="text-6xl">
        {icon}
      </div>

      <h2 className="mt-4 text-2xl font-bold">
        {title}
      </h2>

      <p className="mx-auto mt-3 max-w-xl text-slate-500">
        {text}
      </p>

    </div>
  );
}
