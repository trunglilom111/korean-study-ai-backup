import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";

import { isUuid } from "../../../validation";

type Rating = "again" | "hard" | "good" | "easy";
type Params = { params: Promise<{ id: string; vocabularyId: string }> };

function isRating(value: unknown): value is Rating {
  return value === "again" || value === "hard" || value === "good" || value === "easy";
}

function nextInterval(rating: Rating, current: number) {
  if (rating === "again") return 10 / (60 * 24);
  if (rating === "hard") return Math.max(1, current * 1.5 || 1);
  if (rating === "easy") return Math.max(4, current * 3 || 4);
  return Math.max(1, current * 2 || 1);
}

function databaseErrorResponse(error: { code?: string; message?: string }) {
  if (error.code === "42501") {
    return NextResponse.json({ error: "Bạn không có quyền cập nhật tiến độ bộ từ." }, { status: 403 });
  }

  console.error("Collection progress API error:", error);
  return NextResponse.json({ error: "Không thể lưu tiến độ bộ từ lúc này." }, { status: 500 });
}

export async function POST(request: Request, context: Params) {
  const { id, vocabularyId } = await context.params;

  if (!isUuid(id) || !isUuid(vocabularyId)) {
    return NextResponse.json({ error: "Mã bộ từ hoặc từ vựng không hợp lệ." }, { status: 400 });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập để lưu tiến độ." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isRating(body?.rating)) {
    return NextResponse.json({ error: "Mức đánh giá không hợp lệ." }, { status: 400 });
  }

  const supabase = await createClient(request);
  const [{ data: collection, error: collectionError }, { data: item, error: itemError }] = await Promise.all([
    supabase.from("vocabulary_collections").select("id").eq("id", id).maybeSingle(),
    supabase.from("vocabulary_collection_items").select("vocabulary_id").eq("collection_id", id).eq("vocabulary_id", vocabularyId).maybeSingle(),
  ]);

  if (collectionError || itemError) {
    return databaseErrorResponse(collectionError || itemError!);
  }
  if (!collection || !item) {
    return NextResponse.json({ error: "Không tìm thấy bộ từ hoặc từ trong bộ." }, { status: 404 });
  }

  const { data: previous, error: previousError } = await supabase
    .from("vocabulary_collection_progress")
    .select("review_count,correct_count,wrong_count,interval_days")
    .eq("collection_id", id)
    .eq("vocabulary_id", vocabularyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (previousError) {
    return databaseErrorResponse(previousError);
  }

  const reviewCount = Number(previous?.review_count || 0) + 1;
  const correctCount = Number(previous?.correct_count || 0) + (body.rating === "again" ? 0 : 1);
  const wrongCount = Number(previous?.wrong_count || 0) + (body.rating === "again" ? 1 : 0);
  const interval = nextInterval(body.rating, Number(previous?.interval_days || 0));
  const nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("vocabulary_collection_progress")
    .upsert(
      {
        collection_id: id,
        vocabulary_id: vocabularyId,
        user_id: user.id,
        status: body.rating === "easy" && reviewCount >= 3 ? "mastered" : "learning",
        review_count: reviewCount,
        correct_count: correctCount,
        wrong_count: wrongCount,
        last_reviewed_at: new Date().toISOString(),
        next_review_at: nextReview,
        interval_days: interval,
        difficulty: body.rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "collection_id,vocabulary_id,user_id" }
    )
    .select("collection_id,vocabulary_id,status,review_count,correct_count,wrong_count,next_review_at,interval_days,difficulty")
    .single();

  if (error || !data) {
    return databaseErrorResponse(error || { message: "Progress upsert returned no data" });
  }

  return NextResponse.json({ progress: data });
}
