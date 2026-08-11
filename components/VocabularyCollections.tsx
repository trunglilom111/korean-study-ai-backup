"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "@/utils/api-client";
import CollectionStudy, { CollectionStudyItem } from "@/components/CollectionStudy";

type CollectionVisibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

type VocabularyCollection = {
  id: string;
  title: string;
  description: string;
  visibility: CollectionVisibility;
  createdAt: string;
  updatedAt: string;
};

type CollectionItem = {
  vocabularyId: string;
  vocabulary?: {
    korean?: string;
    meaning?: string;
    pronunciation?: string;
    examples?: string[];
  };
};

export type VocabularyCollectionWord = {
  id: string;
  korean: string;
  meaning: string;
  pronunciation: string;
  partOfSpeech: string;
  level: string;
  categories: string[];
  examples: string[];
  targetCode?: string;
};

type ApiCollectionsResponse = {
  collections?: VocabularyCollection[];
  error?: string;
};

const visibilityLabels: Record<CollectionVisibility, string> = {
  PRIVATE: "🔒 Riêng tư",
  UNLISTED: "🔗 Không liệt kê",
  PUBLIC: "🌍 Công khai",
};

async function readApiResponse<T>(
  response: Response
): Promise<T & { error?: string }> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || "Không thể hoàn tất thao tác với bộ từ."
    );
  }

  return data;
}

async function loadCollections(): Promise<VocabularyCollection[]> {
  const response = await apiFetch("/api/collections", {
    cache: "no-store",
  });
  const data = await readApiResponse<ApiCollectionsResponse>(response);

  return data.collections || [];
}

export default function VocabularyCollections({
  words,
}: {
  words: VocabularyCollectionWord[];
}) {
  const [collections, setCollections] = useState<
    VocabularyCollection[]
  >([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] =
    useState<CollectionVisibility>("PRIVATE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingVisibility, setEditingVisibility] =
    useState<CollectionVisibility>("PRIVATE");
  const [expandedId, setExpandedId] = useState("");
  const [itemsByCollection, setItemsByCollection] = useState<
    Record<string, CollectionItem[]>
  >({});
  const [loadingItemsId, setLoadingItemsId] = useState("");
  const [studyCollectionId, setStudyCollectionId] = useState("");

  async function refreshCollections() {
    try {
      setLoading(true);
      setCollections(await loadCollections());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tải được các bộ từ."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    void loadCollections()
      .then((loaded) => {
        if (active) {
          setCollections(loaded);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Không tải được các bộ từ."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage("Hãy nhập tên bộ từ.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const response = await apiFetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          visibility,
        }),
      });

      await readApiResponse(response);
      setTitle("");
      setDescription("");
      setVisibility("PRIVATE");
      setMessage("Đã tạo bộ từ.");
      await refreshCollections();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tạo được bộ từ."
      );
    } finally {
      setSaving(false);
    }
  }

  function beginEditing(collection: VocabularyCollection) {
    setEditingId(collection.id);
    setEditingTitle(collection.title);
    setEditingVisibility(collection.visibility);
    setMessage("");
  }

  async function saveCollection(collectionId: string) {
    try {
      setSaving(true);
      const response = await apiFetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTitle,
          visibility: editingVisibility,
        }),
      });

      await readApiResponse(response);
      setEditingId("");
      setMessage("Đã cập nhật bộ từ.");
      await refreshCollections();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không cập nhật được bộ từ."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCollection(collection: VocabularyCollection) {
    if (
      !window.confirm(
        `Xóa bộ “${collection.title}” và các liên kết từ vựng?`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      const response = await apiFetch(`/api/collections/${collection.id}`, {
        method: "DELETE",
      });

      await readApiResponse(response);
      setMessage("Đã xóa bộ từ.");
      await refreshCollections();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không xóa được bộ từ."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCollectionItems(collectionId: string) {
    if (expandedId === collectionId) {
      setExpandedId("");
      return;
    }

    try {
      setLoadingItemsId(collectionId);
      const response = await apiFetch(`/api/collections/${collectionId}`, {
        cache: "no-store",
      });
      const data = await readApiResponse<{
        items?: CollectionItem[];
      }>(response);
      setItemsByCollection((current) => ({
        ...current,
        [collectionId]: data.items || [],
      }));
      setExpandedId(collectionId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tải được từ trong bộ."
      );
    } finally {
      setLoadingItemsId("");
    }
  }

  async function removeItem(collectionId: string, vocabularyId: string) {
    try {
      const response = await apiFetch(
        `/api/collections/${collectionId}/items/${vocabularyId}`,
        { method: "DELETE" }
      );
      await readApiResponse(response);
      setItemsByCollection((current) => ({
        ...current,
        [collectionId]: (current[collectionId] || []).filter(
          (item) => item.vocabularyId !== vocabularyId
        ),
      }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không xóa được từ khỏi bộ."
      );
    }
  }

  return (
    <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-sm text-slate-500">Vocabulary Collections</p>
          <h2 className="mt-1 text-xl font-bold">📚 Bộ từ của tôi</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Gom các từ đã lưu theo giáo trình, chủ đề hoặc mục tiêu ôn tập.
            Một từ có thể nằm trong nhiều bộ.
          </p>
        </div>

        <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
          {words.length} từ trong thư viện
        </span>
      </div>

      <form
        onSubmit={createCollection}
        className="mt-5 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-[1fr_1fr_auto]"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Tên bộ mới, ví dụ: SNU 1B — Bài 5"
          maxLength={120}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400"
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Mô tả ngắn (không bắt buộc)"
          maxLength={1000}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400"
        />
        <div className="flex gap-2">
          <select
            value={visibility}
            onChange={(event) =>
              setVisibility(
                event.target.value as CollectionVisibility
              )
            }
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm outline-none"
            aria-label="Quyền xem bộ từ"
          >
            {Object.entries(visibilityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            + Tạo
          </button>
        </div>
      </form>

      {message && (
        <p className="mt-3 text-sm text-slate-400" role="status">
          {message}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {loading && (
          <p className="rounded-xl border border-slate-800 p-4 text-sm text-slate-500">
            Đang tải các bộ từ...
          </p>
        )}

        {!loading && collections.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
            Chưa có bộ nào. Tạo bộ đầu tiên rồi dùng nút “Thêm vào bộ từ” ở
            từng từ đã lưu.
          </p>
        )}

        {collections.map((collection) => (
          <div
            key={collection.id}
            className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
          >
            {editingId === collection.id ? (
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  value={editingTitle}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  maxLength={120}
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 outline-none"
                />
                <select
                  value={editingVisibility}
                  onChange={(event) =>
                    setEditingVisibility(
                      event.target.value as CollectionVisibility
                    )
                  }
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none"
                  aria-label="Quyền xem bộ từ"
                >
                  {Object.entries(visibilityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void saveCollection(collection.id)}
                  disabled={saving}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId("")}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{collection.title}</p>
                  {collection.description && (
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {collection.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    {visibilityLabels[collection.visibility]}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleCollectionItems(collection.id)}
                    className="rounded-xl bg-slate-800 px-3 py-2 text-sm"
                  >
                    {loadingItemsId === collection.id
                      ? "Đang tải..."
                      : expandedId === collection.id
                        ? "Ẩn từ"
                        : "Xem từ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => beginEditing(collection)}
                    className="rounded-xl bg-slate-800 px-3 py-2 text-sm"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteCollection(collection)}
                    disabled={saving}
                    className="rounded-xl bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )}

            {expandedId === collection.id && (
              <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                {(itemsByCollection[collection.id] || []).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Bộ này chưa có từ. Dùng nút “Thêm vào bộ” ở các từ đã lưu.
                  </p>
                ) : (
                  (itemsByCollection[collection.id] || []).map((item) => (
                    <div
                      key={item.vocabularyId}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {item.vocabulary?.korean || "Từ vựng"}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {item.vocabulary?.meaning || ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void removeItem(collection.id, item.vocabularyId)
                        }
                        className="shrink-0 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-400"
                      >
                        Xóa
                      </button>
                    </div>
                  ))
                )}
                {(itemsByCollection[collection.id] || []).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStudyCollectionId(collection.id)}
                    className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950"
                  >
                    Luyện bộ từ
                  </button>
                )}
                {studyCollectionId === collection.id && (
                  <CollectionStudy
                    key={collection.id}
                    collectionId={collection.id}
                    title={collection.title}
                    items={(itemsByCollection[collection.id] || []) as CollectionStudyItem[]}
                    onClose={() => setStudyCollectionId("")}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function CollectionPicker({
  word,
}: {
  word: VocabularyCollectionWord;
}) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<VocabularyCollection[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function openPicker() {
    setOpen(true);
    setMessage("");

    try {
      setLoading(true);
      const loaded = await loadCollections();
      setCollections(loaded);
      setSelectedId(loaded[0]?.id || "");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tải được các bộ từ."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addToCollection() {
    if (!selectedId) {
      setMessage("Hãy tạo một bộ từ trước.");
      return;
    }

    try {
      setSaving(true);
      const response = await apiFetch(
        `/api/collections/${selectedId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vocabularyId: word.id }),
        }
      );

      await readApiResponse(response);
      setOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thêm được từ vào bộ."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openPicker()}
        className="rounded-xl bg-slate-800 px-3 py-2 text-sm"
      >
        📚 Thêm vào bộ
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 md:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collection-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">Đang chọn</p>
                <h2 id="collection-picker-title" className="mt-1 text-xl font-bold">
                  {word.korean}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{word.meaning}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-slate-800 px-3 py-2"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            {loading ? (
              <p className="mt-5 text-sm text-slate-500">Đang tải bộ từ...</p>
            ) : collections.length === 0 ? (
              <p className="mt-5 text-sm text-slate-400">
                Chưa có bộ từ. Hãy tạo bộ ở phần “Bộ từ của tôi” trước.
              </p>
            ) : (
              <>
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="mt-5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
                  aria-label="Chọn bộ từ"
                >
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title} · {visibilityLabels[collection.visibility]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void addToCollection()}
                  disabled={saving}
                  className="mt-4 w-full rounded-xl bg-white px-4 py-3 font-bold text-black disabled:opacity-50"
                >
                  {saving ? "Đang thêm..." : "Thêm từ vào bộ"}
                </button>
              </>
            )}

            {message && (
              <p className="mt-3 text-sm text-rose-300" role="alert">
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
