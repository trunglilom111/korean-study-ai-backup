"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/utils/api-client";
import CollectionStudy, { CollectionStudyItem } from "@/components/CollectionStudy";

type CommunityCollection = {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  followerCount: number;
  createdAt: string;
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

type CollectionDetail = {
  title: string;
  description: string;
  items: CollectionItem[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function CommunityCollections() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [collections, setCollections] = useState<CommunityCollection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [studying, setStudying] = useState(false);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        limit: "12",
        sort,
      });

      if (submittedQuery) {
        params.set("q", submittedQuery);
      }

      const response = await apiFetch(`/api/community/collections?${params}`);
      const payload = (await response.json()) as {
        collections?: CommunityCollection[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Không thể tải thư viện cộng đồng.");
      }

      setCollections(payload.collections || []);
    } catch (error) {
      setCollections([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải thư viện cộng đồng."
      );
    } finally {
      setLoading(false);
    }
  }, [sort, submittedQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCollections();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCollections]);

  async function openCollection(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setMessage("");

    try {
      const [detailResponse, followResponse] = await Promise.all([
        apiFetch(`/api/collections/${id}`),
        apiFetch(`/api/collections/${id}/follow`),
      ]);
      const detailPayload = (await detailResponse.json()) as {
        collection?: { title: string; description: string };
        items?: CollectionItem[];
        error?: string;
      };
      const followPayload = (await followResponse.json()) as {
        following?: boolean;
        followerCount?: number;
      };

      if (!detailResponse.ok) {
        throw new Error(detailPayload.error || "Không thể mở bộ từ.");
      }

      setDetail({
        title: detailPayload.collection?.title || "Bộ từ cộng đồng",
        description: detailPayload.collection?.description || "",
        items: detailPayload.items || [],
      });
      setFollowing(Boolean(followPayload.following));
      setFollowerCount(followPayload.followerCount || 0);
    } catch (error) {
      setSelectedId(null);
      setMessage(
        error instanceof Error ? error.message : "Không thể mở bộ từ."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleFollow() {
    if (!selectedId) {
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const response = await apiFetch(`/api/collections/${selectedId}/follow`, {
        method: following ? "DELETE" : "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Không thể cập nhật theo dõi.");
      }

      setFollowing((current) => !current);
      setFollowerCount((current) => Math.max(0, current + (following ? -1 : 1)));
      setCollections((current) =>
        current.map((collection) =>
          collection.id === selectedId
            ? {
                ...collection,
                followerCount: Math.max(
                  0,
                  collection.followerCount + (following ? -1 : 1)
                ),
              }
            : collection
        )
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể cập nhật theo dõi."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function copyCollection() {
    if (!selectedId) {
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const response = await apiFetch(`/api/collections/${selectedId}/copy`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Không thể sao chép bộ từ.");
      }

      setMessage("Đã sao chép bộ từ vào thư viện cá nhân.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể sao chép bộ từ."
      );
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">🌐 Học cùng cộng đồng</p>
          <h2 className="mt-1 text-xl font-bold">Thư viện công khai</h2>
          <p className="mt-1 text-sm text-slate-400">
            Tìm bộ từ của người học khác, theo dõi hoặc sao chép về thư viện của bạn.
          </p>
        </div>

        <select
          value={sort}
          onChange={(event) =>
            setSort(event.target.value === "popular" ? "popular" : "latest")
          }
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
        >
          <option value="latest">Mới nhất</option>
          <option value="popular">Được theo dõi nhiều</option>
        </select>
      </div>

      <form
        className="mt-5 flex gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedQuery(query.trim());
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm bộ từ công khai..."
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-white px-5 py-3 font-bold text-black"
        >
          Tìm
        </button>
      </form>

      {message && (
        <p className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-slate-400">Đang tải thư viện cộng đồng...</p>
      ) : collections.length === 0 ? (
        <p className="mt-5 text-sm text-slate-400">
          Chưa có bộ từ công khai phù hợp.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <article
              key={collection.id}
              className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
            >
              <h3 className="font-bold text-slate-100">{collection.title}</h3>
              <p className="mt-2 min-h-10 text-sm text-slate-400">
                {collection.description || "Không có mô tả."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{collection.itemCount} từ</span>
                <span>•</span>
                <span>{collection.followerCount} theo dõi</span>
                <span>•</span>
                <span>{formatDate(collection.createdAt)}</span>
              </div>
              <button
                type="button"
                onClick={() => void openCollection(collection.id)}
                className="mt-4 w-full rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
              >
                Xem bộ từ
              </button>
            </article>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
          {detailLoading || !detail ? (
            <p className="text-sm text-slate-400">Đang mở bộ từ...</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{detail.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {detail.description || "Không có mô tả."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  Đóng
                </button>
              </div>

              <div className="mt-4 max-h-64 space-y-2 overflow-auto">
                {detail.items.length === 0 ? (
                  <p className="text-sm text-slate-400">Bộ từ chưa có từ nào.</p>
                ) : (
                  detail.items.map((item) => (
                    <div
                      key={`${item.vocabularyId}-${item.vocabulary?.korean || "word"}`}
                      className="rounded-xl border border-slate-800 px-3 py-2"
                    >
                      <p className="font-semibold text-slate-100">
                        {item.vocabulary?.korean || "Từ tiếng Hàn"}
                      </p>
                      <p className="text-sm text-slate-400">
                        {item.vocabulary?.meaning || "Chưa có nghĩa."}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void toggleFollow()}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {following ? "Bỏ theo dõi" : "Theo dõi"} ({followerCount})
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void copyCollection()}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
                >
                  Sao chép vào thư viện
                </button>
                <button
                  type="button"
                  onClick={() => setStudying(true)}
                  disabled={detail.items.length === 0}
                  className="rounded-xl border border-amber-300/50 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50"
                >
                  Luyện bộ từ
                </button>
              </div>
              {studying && (
                <CollectionStudy
                  key={selectedId}
                  collectionId={selectedId}
                  title={detail.title}
                  items={detail.items as CollectionStudyItem[]}
                  onClose={() => setStudying(false)}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
