import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

type CollectionRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  copied_from_id: string | null;
};

type CountRow = {
  collection_id: string;
};

function databaseErrorResponse(error: { code?: string; message?: string }) {
  console.error("Community collections API error:", error);

  return NextResponse.json(
    { error: "Không thể tải thư viện cộng đồng lúc này." },
    { status: 500 }
  );
}

function countByCollection(rows: CountRow[] | null) {
  return (rows || []).reduce<Record<string, number>>((counts, row) => {
    counts[row.collection_id] = (counts[row.collection_id] || 0) + 1;
    return counts;
  }, {});
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q") || "";
  const query = rawQuery
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const sort = url.searchParams.get("sort") === "popular" ? "popular" : "latest";
  const page = Math.max(
    1,
    Math.min(100, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1)
  );
  const limit = Math.max(
    1,
    Math.min(24, Number.parseInt(url.searchParams.get("limit") || "12", 10) || 12)
  );
  const offset = (page - 1) * limit;

  const supabase = await createClient(request);
  let collectionsQuery = supabase
    .from("vocabulary_collections")
    .select(
      "id,title,description,visibility,created_at,updated_at,copied_from_id",
      { count: "exact" }
    )
    .eq("visibility", "PUBLIC")
    .order("created_at", { ascending: false });

  if (query) {
    collectionsQuery = collectionsQuery.or(
      `title.ilike.%${query}%,description.ilike.%${query}%`
    );
  }

  const { data, count, error } = await collectionsQuery.range(
    sort === "popular" ? 0 : offset,
    sort === "popular" ? 99 : offset + limit - 1
  );

  if (error) {
    return databaseErrorResponse(error);
  }

  const collections = (data || []) as CollectionRow[];
  const ids = collections.map((collection) => collection.id);

  if (ids.length === 0) {
    return NextResponse.json({
      collections: [],
      page,
      limit,
      total: count || 0,
    });
  }

  const [{ data: follows, error: followsError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from("vocabulary_collection_follows")
        .select("collection_id")
        .in("collection_id", ids),
      supabase
        .from("vocabulary_collection_items")
        .select("collection_id")
        .in("collection_id", ids),
    ]);

  if (followsError || itemsError) {
    return databaseErrorResponse(followsError || itemsError!);
  }

  const followerCounts = countByCollection((follows || []) as CountRow[]);
  const itemCounts = countByCollection((items || []) as CountRow[]);
  const sortedCollections =
    sort === "popular"
      ? [...collections].sort(
          (left, right) =>
            (followerCounts[right.id] || 0) -
              (followerCounts[left.id] || 0) ||
            right.created_at.localeCompare(left.created_at)
        )
      : collections;

  return NextResponse.json({
    collections: sortedCollections.slice(offset, offset + limit).map((collection) => ({
      id: collection.id,
      title: collection.title,
      description: collection.description || "",
      visibility: collection.visibility,
      createdAt: collection.created_at,
      updatedAt: collection.updated_at,
      copiedFromId: collection.copied_from_id,
      itemCount: itemCounts[collection.id] || 0,
      followerCount: followerCounts[collection.id] || 0,
    })),
    page,
    limit,
    total: count || 0,
  });
}
