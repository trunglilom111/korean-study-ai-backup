"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import GrammarExplorer from "@/components/GrammarExplorer";
import StudyCanvas from "@/components/StudyCanvas";
import { createClient } from "@/utils/supabase/client";

type GrammarStatus = "learning" | "mastered";

type GrammarExample = {
  korean: string;
  vietnamese: string;
};

type Grammar = {
  id: string;
  pattern: string;
  meaning: string;
  explanation: string;
  level: string;
  examples: GrammarExample[];
  tags: string[];
  notes: string;
  status: GrammarStatus;
  createdAt: string;
};

type GrammarRow = {
  id: string;
  user_id: string;

  pattern: string;
  meaning: string;
  explanation: string;

  level: string | null;

  examples: unknown;
  tags: unknown;

  notes: string;

  status: string;

  created_at: string;
  updated_at: string;
};

type LevelFilter =
  | "all"
  | "초급"
  | "중급"
  | "고급";

type StatusFilter =
  | "all"
  | "learning"
  | "mastered";

/*
 * =========================================
 * PARSE EXAMPLES
 * =========================================
 */

function parseExamples(
  value: unknown
): GrammarExample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: GrammarExample[] = [];

  value.forEach((item) => {
    /*
     * Nếu trước này lưu dạng string
     */
    if (typeof item === "string") {
      if (item.trim()) {
        result.push({
          korean: item.trim(),
          vietnamese: "",
        });
      }

      return;
    }

    /*
     * Dạng object
     */
    if (
      item &&
      typeof item === "object"
    ) {
      const data =
        item as Record<
          string,
          unknown
        >;

      const korean =
        typeof data.korean ===
        "string"
          ? data.korean
          : "";

      const vietnamese =
        typeof data.vietnamese ===
        "string"
          ? data.vietnamese
          : "";

      if (
        korean.trim() ||
        vietnamese.trim()
      ) {
        result.push({
          korean:
            korean.trim(),

          vietnamese:
            vietnamese.trim(),
        });
      }
    }
  });

  return result;
}

/*
 * =========================================
 * PARSE TAGS
 * =========================================
 */

function parseTags(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item
      ): item is string =>
        typeof item ===
        "string"
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

/*
 * =========================================
 * SUPABASE ROW → GRAMMAR
 * =========================================
 */

function rowToGrammar(
  row: GrammarRow
): Grammar {
  return {
    id: row.id,

    pattern:
      row.pattern || "",

    meaning:
      row.meaning || "",

    explanation:
      row.explanation || "",

    level:
      row.level || "",

    examples:
      parseExamples(
        row.examples
      ),

    tags:
      parseTags(
        row.tags
      ),

    notes:
      row.notes || "",

    status:
      row.status ===
      "mastered"
        ? "mastered"
        : "learning",

    createdAt:
      row.created_at,
  };
}

export default function GrammarPage() {
  const router =
    useRouter();

  const [supabase] =
    useState(() =>
      createClient()
    );

  /*
   * =========================================
   * DATA
   * =========================================
   */

  const [
    items,
    setItems,
  ] =
    useState<Grammar[]>(
      []
    );

  const [
    userId,
    setUserId,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    workingId,
    setWorkingId,
  ] =
    useState("");

  /*
   * =========================================
   * FORM
   * =========================================
   */

  const [
    editingId,
    setEditingId,
  ] =
    useState("");

  const [
    pattern,
    setPattern,
  ] =
    useState("");

  const [
    meaning,
    setMeaning,
  ] =
    useState("");

  const [
    explanation,
    setExplanation,
  ] =
    useState("");

  const [
    level,
    setLevel,
  ] =
    useState("");

  const [
    exampleKorean,
    setExampleKorean,
  ] =
    useState("");

  const [
    exampleVietnamese,
    setExampleVietnamese,
  ] =
    useState("");

  const [
    tagsText,
    setTagsText,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  /*
   * =========================================
   * SEARCH / FILTER
   * =========================================
   */

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    levelFilter,
    setLevelFilter,
  ] =
    useState<LevelFilter>(
      "all"
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      "all"
    );

  /*
   * =========================================
   * LOAD SUPABASE
   * =========================================
   */

  useEffect(() => {
    let cancelled =
      false;

    async function loadGrammar() {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (
        userError ||
        !user
      ) {
        router.replace(
          "/login"
        );

        return;
      }

      setUserId(
        user.id
      );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "grammar"
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
          "Lỗi tải grammar:",
          error
        );

        alert(
          "Không tải được ngữ pháp từ Supabase."
        );

        setLoading(false);

        return;
      }

      const rows =
        (data ||
          []) as GrammarRow[];

      setItems(
        rows.map(
          rowToGrammar
        )
      );

      setLoading(false);
    }

    loadGrammar();

    return () => {
      cancelled = true;
    };
  }, [
    router,
    supabase,
  ]);

  /*
   * =========================================
   * RESET FORM
   * =========================================
   */

  function resetForm() {
    setEditingId("");

    setPattern("");
    setMeaning("");
    setExplanation("");
    setLevel("");

    setExampleKorean("");
    setExampleVietnamese("");

    setTagsText("");
    setNotes("");
  }

  /*
   * =========================================
   * SAVE / UPDATE
   * =========================================
   */

  async function saveGrammar() {
    if (!userId) {
      router.push(
        "/login"
      );

      return;
    }

    if (!pattern.trim()) {
      alert(
        "Hãy nhập cấu trúc ngữ pháp."
      );

      return;
    }

    if (!meaning.trim()) {
      alert(
        "Hãy nhập nghĩa tiếng Việt."
      );

      return;
    }

    setSaving(true);

    /*
     * TAG
     */

    const tags =
      tagsText
        .split(",")
        .map((tag) =>
          tag.trim()
        )
        .filter(Boolean);

    /*
     * EXAMPLE
     */

    const examples:
      GrammarExample[] =
      [];

    if (
      exampleKorean.trim() ||
      exampleVietnamese.trim()
    ) {
      examples.push({
        korean:
          exampleKorean.trim(),

        vietnamese:
          exampleVietnamese.trim(),
      });
    }

    /*
     * DATA
     */

    const grammarData = {
      pattern:
        pattern.trim(),

      meaning:
        meaning.trim(),

      explanation:
        explanation.trim(),

      level:
        level || null,

      examples,

      tags,

      notes:
        notes.trim(),

      updated_at:
        new Date().toISOString(),
    };

    /*
     * =========================================
     * UPDATE
     * =========================================
     */

    if (editingId) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "grammar"
          )
          .update(
            grammarData
          )
          .eq(
            "id",
            editingId
          )
          .eq(
            "user_id",
            userId
          )
          .select("*")
          .single();

      if (error) {
        console.error(
          "Lỗi sửa grammar:",
          error
        );

        if (
          error.code ===
          "23505"
        ) {
          alert(
            "Bạn đã lưu cấu trúc ngữ pháp này rồi."
          );
        } else {
          alert(
            `Không sửa được ngữ pháp.\n${error.message}`
          );
        }

        setSaving(false);

        return;
      }

      const updated =
        rowToGrammar(
          data as GrammarRow
        );

      setItems(
        (old) =>
          old.map(
            (item) =>
              item.id ===
              editingId
                ? updated
                : item
          )
      );

      resetForm();

      setSaving(false);

      return;
    }

    /*
     * =========================================
     * INSERT
     * =========================================
     */

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "grammar"
        )
        .insert({
          user_id:
            userId,

          ...grammarData,

          status:
            "learning",
        })
        .select("*")
        .single();

    if (error) {
      console.error(
        "Lỗi lưu grammar:",
        error
      );

      if (
        error.code ===
        "23505"
      ) {
        alert(
          "Bạn đã lưu cấu trúc ngữ pháp này rồi."
        );
      } else {
        alert(
          `Không lưu được ngữ pháp.\n${error.message}`
        );
      }

      setSaving(false);

      return;
    }

    const newItem =
      rowToGrammar(
        data as GrammarRow
      );

    setItems(
      (old) => [
        newItem,
        ...old,
      ]
    );

    resetForm();

    setSaving(false);
  }

  /*
   * =========================================
   * EDIT
   * =========================================
   */

  function editGrammar(
    item: Grammar
  ) {
    setEditingId(
      item.id
    );

    setPattern(
      item.pattern
    );

    setMeaning(
      item.meaning
    );

    setExplanation(
      item.explanation
    );

    setLevel(
      item.level
    );

    const firstExample =
      item.examples[0];

    setExampleKorean(
      firstExample?.korean ||
        ""
    );

    setExampleVietnamese(
      firstExample?.vietnamese ||
        ""
    );

    setTagsText(
      item.tags.join(
        ", "
      )
    );

    setNotes(
      item.notes
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  /*
   * =========================================
   * DELETE
   * =========================================
   */

  async function removeGrammar(
    item: Grammar
  ) {
    const ok =
      window.confirm(
        `Xóa "${item.pattern}" khỏi kho ngữ pháp?`
      );

    if (!ok) {
      return;
    }

    setWorkingId(
      item.id
    );

    const { error } =
      await supabase
        .from(
          "grammar"
        )
        .delete()
        .eq(
          "id",
          item.id
        )
        .eq(
          "user_id",
          userId
        );

    if (error) {
      console.error(
        "Lỗi xóa grammar:",
        error
      );

      alert(
        "Không xóa được ngữ pháp."
      );

      setWorkingId("");

      return;
    }

    setItems(
      (old) =>
        old.filter(
          (x) =>
            x.id !==
            item.id
        )
    );

    if (
      editingId ===
      item.id
    ) {
      resetForm();
    }

    setWorkingId("");
  }

  /*
   * =========================================
   * TOGGLE STATUS
   * =========================================
   */

  async function toggleStatus(
    item: Grammar
  ) {
    const nextStatus:
      GrammarStatus =
      item.status ===
      "learning"
        ? "mastered"
        : "learning";

    setWorkingId(
      item.id
    );

    const { error } =
      await supabase
        .from(
          "grammar"
        )
        .update({
          status:
            nextStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          item.id
        )
        .eq(
          "user_id",
          userId
        );

    if (error) {
      console.error(
        "Lỗi cập nhật grammar:",
        error
      );

      alert(
        "Không cập nhật được trạng thái."
      );

      setWorkingId("");

      return;
    }

    setItems(
      (old) =>
        old.map(
          (grammar) =>
            grammar.id ===
            item.id
              ? {
                  ...grammar,
                  status:
                    nextStatus,
                }
              : grammar
        )
    );

    setWorkingId("");
  }

  /*
   * =========================================
   * SPEAK
   * =========================================
   */

  function speak(
    text: string
  ) {
    if (!text.trim()) {
      return;
    }

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
   * FILTER
   * =========================================
   */

  const filteredItems =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      return items.filter(
        (item) => {
          const text =
            [
              item.pattern,
              item.meaning,
              item.explanation,
              item.notes,
              item.tags.join(
                " "
              ),
              item.examples
                .map(
                  (
                    example
                  ) =>
                    `${example.korean} ${example.vietnamese}`
                )
                .join(
                  " "
                ),
            ]
              .join(" ")
              .toLowerCase();

          const matchesSearch =
            !q ||
            text.includes(
              q
            );

          const matchesLevel =
            levelFilter ===
              "all" ||
            item.level ===
              levelFilter;

          const matchesStatus =
            statusFilter ===
              "all" ||
            item.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesLevel &&
            matchesStatus
          );
        }
      );
    }, [
      items,
      search,
      levelFilter,
      statusFilter,
    ]);

  /*
   * =========================================
   * STATS
   * =========================================
   */

  const learningCount =
    items.filter(
      (item) =>
        item.status ===
        "learning"
    ).length;

  const masteredCount =
    items.filter(
      (item) =>
        item.status ===
        "mastered"
    ).length;

  /*
   * =========================================
   * LOADING
   * =========================================
   */

  if (loading) {
    return (
      <AppShell>

        <div className="flex min-h-[60vh] items-center justify-center">

          <div className="text-center">

            <div className="text-6xl">
              🧩
            </div>

            <p className="mt-4 font-semibold">
              Đang tải ngữ pháp...
            </p>

            <p className="mt-2 text-sm text-slate-500">
              ☁️ Đang đồng bộ với Supabase
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

        <p className="text-slate-400">
          문법
        </p>

        <h1 className="text-3xl font-bold md:text-4xl">
          🧩 Ngữ pháp
        </h1>

        <p className="mt-2 text-slate-500">
          Xây dựng kho ngữ pháp tiếng Hàn
          của riêng bạn.
        </p>

      </div>

      {/* =====================================
          STATS
      ===================================== */}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">

        <Stat
          title="🧩 Tổng mẫu"
          value={
            items.length
          }
        />

        <Stat
          title="🟡 Đang học"
          value={
            learningCount
          }
        />

        <Stat
          title="🟢 Đã thuộc"
          value={
            masteredCount
          }
        />

        <Stat
          title="🔎 Đang hiển thị"
          value={
            filteredItems.length
          }
        />

      </div>

      <GrammarExplorer />

      <StudyCanvas
        title="Bảng viết ngữ pháp"
        storageKey="korean-study-grammar-canvas"
      />

      {/* =====================================
          FORM
      ===================================== */}

      <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">

        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">

          <div>

            <p className="text-sm text-slate-500">
              {editingId
                ? "✏️ Chỉnh sửa"
                : "➕ Mẫu mới"}
            </p>

            <h2 className="mt-1 text-xl font-bold">
              {editingId
                ? "Sửa ngữ pháp"
                : "Thêm ngữ pháp"}
            </h2>

          </div>

          {editingId && (
            <button
              onClick={
                resetForm
              }
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm"
            >
              ✕ Hủy sửa
            </button>
          )}

        </div>

        <div className="mt-6 grid gap-4">

          {/* PATTERN */}

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              🇰🇷 Cấu trúc ngữ pháp *
            </label>

            <input
              value={
                pattern
              }
              onChange={(
                e
              ) =>
                setPattern(
                  e.target.value
                )
              }
              placeholder="-고 싶다"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg outline-none focus:border-slate-500"
            />

          </div>

          {/* MEANING */}

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              🇻🇳 Ý nghĩa *
            </label>

            <input
              value={
                meaning
              }
              onChange={(
                e
              ) =>
                setMeaning(
                  e.target.value
                )
              }
              placeholder="Muốn làm gì đó"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500"
            />

          </div>

          {/* EXPLANATION */}

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              📖 Giải thích / Cách dùng
            </label>

            <textarea
              value={
                explanation
              }
              onChange={(
                e
              ) =>
                setExplanation(
                  e.target.value
                )
              }
              placeholder="Dùng sau động từ để diễn tả mong muốn của người nói..."
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 leading-7 outline-none focus:border-slate-500"
            />

          </div>

          {/* LEVEL */}

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              🎯 Cấp độ
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
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
            >

              <option value="">
                Chưa phân loại
              </option>

              <option value="초급">
                🌱 Sơ cấp
              </option>

              <option value="중급">
                🌿 Trung cấp
              </option>

              <option value="고급">
                🌳 Cao cấp
              </option>

            </select>

          </div>

          {/* EXAMPLE */}

          <div className="rounded-2xl bg-slate-950 p-4">

            <p className="mb-4 text-sm font-semibold text-slate-400">
              💬 Ví dụ
            </p>

            <div className="grid gap-3">

              <input
                value={
                  exampleKorean
                }
                onChange={(
                  e
                ) =>
                  setExampleKorean(
                    e.target.value
                  )
                }
                placeholder="🇰🇷 한국에 가고 싶어요."
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 outline-none"
              />

              <input
                value={
                  exampleVietnamese
                }
                onChange={(
                  e
                ) =>
                  setExampleVietnamese(
                    e.target.value
                  )
                }
                placeholder="🇻🇳 Tôi muốn đi Hàn Quốc."
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 outline-none"
              />

            </div>

          </div>

          {/* TAG */}

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              🏷️ Chủ đề
            </label>

            <input
              value={
                tagsText
              }
              onChange={(
                e
              ) =>
                setTagsText(
                  e.target.value
                )
              }
              placeholder="mong muốn, giao tiếp, động từ"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
            />

            <p className="mt-2 text-xs text-slate-600">
              Ngăn cách các chủ đề bằng dấu phẩy.
            </p>

          </div>

          {/* NOTES */}

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              📝 Ghi chú riêng
            </label>

            <textarea
              value={
                notes
              }
              onChange={(
                e
              ) =>
                setNotes(
                  e.target.value
                )
              }
              placeholder="Điều mình hay nhầm, mẹo ghi nhớ..."
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
            />

          </div>

          <button
            onClick={
              saveGrammar
            }
            disabled={
              saving
            }
            className="rounded-xl bg-white p-4 font-bold text-black disabled:opacity-50"
          >
            {saving
              ? "☁️ Đang lưu..."
              : editingId
                ? "💾 Lưu thay đổi"
                : "+ Lưu ngữ pháp"}
          </button>

        </div>

      </div>

      {/* =====================================
          SEARCH
      ===================================== */}

      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">

        <input
          value={
            search
          }
          onChange={(
            e
          ) =>
            setSearch(
              e.target.value
            )
          }
          placeholder="🔎 Tìm cấu trúc, nghĩa, ví dụ, chủ đề..."
          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 outline-none"
        />

        {/* LEVEL FILTER */}

        <div className="mt-4 flex flex-wrap gap-2">

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
            Tất cả cấp độ
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

        {/* STATUS */}

        <div className="mt-3 flex flex-wrap gap-2">

          <FilterButton
            active={
              statusFilter ===
              "all"
            }
            onClick={() =>
              setStatusFilter(
                "all"
              )
            }
          >
            Tất cả trạng thái
          </FilterButton>

          <FilterButton
            active={
              statusFilter ===
              "learning"
            }
            onClick={() =>
              setStatusFilter(
                "learning"
              )
            }
          >
            🟡 Đang học
          </FilterButton>

          <FilterButton
            active={
              statusFilter ===
              "mastered"
            }
            onClick={() =>
              setStatusFilter(
                "mastered"
              )
            }
          >
            🟢 Đã thuộc
          </FilterButton>

        </div>

      </div>

      {/* =====================================
          LIST
      ===================================== */}

      <div className="space-y-4">

        {filteredItems.map(
          (item) => (
            <div
              key={
                item.id
              }
              className="rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-6"
            >

              <div className="flex flex-col justify-between gap-5 md:flex-row">

                {/* CONTENT */}

                <div className="min-w-0 flex-1">

                  <div className="flex flex-wrap items-center gap-2">

                    <h2 className="text-2xl font-bold md:text-3xl">
                      {
                        item.pattern
                      }
                    </h2>

                    {item.level && (
                      <LevelBadge
                        level={
                          item.level
                        }
                      />
                    )}

                    <StatusBadge
                      status={
                        item.status
                      }
                    />

                  </div>

                  {/* MEANING */}

                  <p className="mt-4 text-lg text-slate-200">
                    🇻🇳{" "}
                    {
                      item.meaning
                    }
                  </p>

                  {/* EXPLANATION */}

                  {item.explanation && (
                    <div className="mt-4">

                      <p className="text-xs font-semibold text-slate-500">
                        📖 Cách dùng
                      </p>

                      <p className="mt-2 whitespace-pre-line leading-7 text-slate-300">
                        {
                          item.explanation
                        }
                      </p>

                    </div>
                  )}

                  {/* EXAMPLES */}

                  {item.examples.length >
                    0 && (
                    <div className="mt-5 space-y-3">

                      {item.examples.map(
                        (
                          example,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }
                            className="rounded-2xl bg-slate-950 p-4"
                          >

                            {example.korean && (
                              <div className="flex items-start justify-between gap-3">

                                <p className="leading-7 text-slate-200">
                                  🇰🇷{" "}
                                  {
                                    example.korean
                                  }
                                </p>

                                <button
                                  onClick={() =>
                                    speak(
                                      example.korean
                                    )
                                  }
                                  className="shrink-0 rounded-lg bg-slate-800 px-3 py-2"
                                >
                                  🔊
                                </button>

                              </div>
                            )}

                            {example.vietnamese && (
                              <p className="mt-2 text-sm leading-6 text-slate-500">
                                🇻🇳{" "}
                                {
                                  example.vietnamese
                                }
                              </p>
                            )}

                          </div>
                        )
                      )}

                    </div>
                  )}

                  {/* TAGS */}

                  {item.tags.length >
                    0 && (
                    <div className="mt-4 flex flex-wrap gap-2">

                      {item.tags.map(
                        (
                          tag,
                          index
                        ) => (
                          <span
                            key={`${tag}-${index}`}
                            className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-200"
                          >
                            🏷{" "}
                            {tag}
                          </span>
                        )
                      )}

                    </div>
                  )}

                  {/* NOTES */}

                  {item.notes && (
                    <div className="mt-4 rounded-xl border border-slate-800 p-4">

                      <p className="text-xs text-slate-500">
                        📝 Ghi chú
                      </p>

                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">
                        {
                          item.notes
                        }
                      </p>

                    </div>
                  )}

                </div>

                {/* BUTTON */}

                <div className="flex shrink-0 flex-wrap gap-2">

                  <button
                    onClick={() =>
                      toggleStatus(
                        item
                      )
                    }
                    disabled={
                      workingId ===
                      item.id
                    }
                    className="rounded-xl bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {item.status ===
                    "mastered"
                      ? "🟢 Đã thuộc"
                      : "🟡 Đang học"}
                  </button>

                  <button
                    onClick={() =>
                      editGrammar(
                        item
                      )
                    }
                    disabled={
                      workingId ===
                      item.id
                    }
                    className="rounded-xl bg-slate-800 px-3 py-2"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() =>
                      removeGrammar(
                        item
                      )
                    }
                    disabled={
                      workingId ===
                      item.id
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

        {filteredItems.length ===
          0 && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-12 text-center">

            <div className="text-6xl">
              🧩
            </div>

            <p className="mt-4 font-bold">
              Chưa có ngữ pháp phù hợp
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Hãy thêm một cấu trúc mới
              hoặc thay đổi bộ lọc.
            </p>

          </div>
        )}

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
 * FILTER
 * =========================================
 */

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
      onClick={
        onClick
      }
      className={`rounded-xl px-3 py-2 text-sm transition ${
        active
          ? "bg-white font-semibold text-black"
          : "bg-slate-950 text-slate-400 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

/*
 * =========================================
 * LEVEL
 * =========================================
 */

function LevelBadge({
  level,
}: {
  level: string;
}) {
  let label =
    level;

  if (
    level ===
    "초급"
  ) {
    label =
      "🌱 Sơ cấp";
  }

  if (
    level ===
    "중급"
  ) {
    label =
      "🌿 Trung cấp";
  }

  if (
    level ===
    "고급"
  ) {
    label =
      "🌳 Cao cấp";
  }

  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold">
      {label}
    </span>
  );
}

/*
 * =========================================
 * STATUS
 * =========================================
 */

function StatusBadge({
  status,
}: {
  status:
    GrammarStatus;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        status ===
        "mastered"
          ? "bg-emerald-950 text-emerald-300"
          : "bg-amber-950 text-amber-300"
      }`}
    >
      {status ===
      "mastered"
        ? "✓ Đã thuộc"
        : "Đang học"}
    </span>
  );
}
