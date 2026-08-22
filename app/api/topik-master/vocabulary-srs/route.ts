import { NextResponse } from "next/server";
import { getTopikMasterContext, asObject } from "@/utils/topik-master/server";
import { scheduleVocabularyReview, type VocabularyRating } from "@/utils/topik-master/vocabulary-srs";

type SrsRow = {
  vocabulary_id: string;
  status: "learning" | "mastered" | "hard";
  bookmarked: boolean;
  first_seen_at: string;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  review_count: number;
  correct_count: number;
  wrong_count: number;
  ease_factor: number;
  interval_days: number;
  mastery_score: number;
  last_rating: VocabularyRating | null;
};

const ratings = new Set<VocabularyRating>(["again", "hard", "good", "easy"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serialize(row: SrsRow) {
  const due = Boolean(row.next_review_at && Date.parse(row.next_review_at) <= Date.now());
  return {
    vocabularyId: row.vocabulary_id,
    status: due ? "due" : row.status,
    storedStatus: row.status,
    bookmarked: row.bookmarked,
    firstSeen: row.first_seen_at,
    lastReviewed: row.last_reviewed_at,
    nextReview: row.next_review_at,
    reviewCount: row.review_count,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    ease: Number(row.ease_factor),
    interval: Number(row.interval_days),
    mastery: Number(row.mastery_score),
    lastRating: row.last_rating,
  };
}

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") || "").split(",").filter((id) => uuidPattern.test(id)).slice(0, 100);
  const status = url.searchParams.get("status");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const nowIso = new Date().toISOString();

  let query = context.supabase
    .from("topik_master_vocabulary_srs")
    .select("vocabulary_id,status,bookmarked,first_seen_at,last_reviewed_at,next_review_at,review_count,correct_count,wrong_count,ease_factor,interval_days,mastery_score,last_rating")
    .eq("user_id", context.user.id)
    .order("next_review_at", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (ids.length) query = query.in("vocabulary_id", ids);
  if (status === "due") query = query.lte("next_review_at", nowIso);
  else if (status === "bookmarked") query = query.eq("bookmarked", true);
  else if (["learning", "mastered", "hard"].includes(status || "")) query = query.eq("status", status!);

  const [rows, due, bookmarked] = await Promise.all([
    query,
    context.supabase.from("topik_master_vocabulary_srs").select("vocabulary_id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("next_review_at", nowIso),
    context.supabase.from("topik_master_vocabulary_srs").select("vocabulary_id", { count: "exact", head: true }).eq("user_id", context.user.id).eq("bookmarked", true),
  ]);
  if (rows.error || due.error || bookmarked.error) {
    return NextResponse.json({ ok: false, error: "Vocabulary SRS chưa được bật bằng migration 011." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, states: ((rows.data || []) as SrsRow[]).map(serialize), summary: { due: due.count || 0, bookmarked: bookmarked.count || 0 } });
}

export async function POST(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const vocabularyId = typeof body.vocabularyId === "string" ? body.vocabularyId : "";
  if (!uuidPattern.test(vocabularyId)) return NextResponse.json({ ok: false, error: "Mã từ vựng không hợp lệ." }, { status: 400 });

  const existing = await context.supabase
    .from("topik_master_vocabulary_srs")
    .select("vocabulary_id,status,bookmarked,first_seen_at,last_reviewed_at,next_review_at,review_count,correct_count,wrong_count,ease_factor,interval_days,mastery_score,last_rating")
    .eq("user_id", context.user.id)
    .eq("vocabulary_id", vocabularyId)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ ok: false, error: "Vocabulary SRS chưa sẵn sàng." }, { status: 503 });

  const rating = typeof body.rating === "string" && ratings.has(body.rating as VocabularyRating) ? body.rating as VocabularyRating : null;
  const bookmarked = typeof body.bookmarked === "boolean" ? body.bookmarked : existing.data?.bookmarked || false;
  if (!rating && typeof body.bookmarked !== "boolean") return NextResponse.json({ ok: false, error: "Hãy gửi rating hoặc trạng thái bookmark." }, { status: 400 });

  const scheduled = rating ? scheduleVocabularyReview({
    reviewCount: existing.data?.review_count || 0,
    correctCount: existing.data?.correct_count || 0,
    wrongCount: existing.data?.wrong_count || 0,
    easeFactor: Number(existing.data?.ease_factor || 2.5),
    intervalDays: Number(existing.data?.interval_days || 0),
    masteryScore: Number(existing.data?.mastery_score || 0),
  }, rating) : null;
  const nowIso = new Date().toISOString();
  const payload = {
    user_id: context.user.id,
    vocabulary_id: vocabularyId,
    status: scheduled?.status || existing.data?.status || "learning",
    bookmarked,
    first_seen_at: existing.data?.first_seen_at || nowIso,
    last_reviewed_at: scheduled?.lastReviewedAt || existing.data?.last_reviewed_at || null,
    next_review_at: scheduled?.nextReviewAt || existing.data?.next_review_at || null,
    review_count: scheduled?.reviewCount ?? existing.data?.review_count ?? 0,
    correct_count: scheduled?.correctCount ?? existing.data?.correct_count ?? 0,
    wrong_count: scheduled?.wrongCount ?? existing.data?.wrong_count ?? 0,
    ease_factor: scheduled?.easeFactor ?? Number(existing.data?.ease_factor || 2.5),
    interval_days: scheduled?.intervalDays ?? Number(existing.data?.interval_days || 0),
    mastery_score: scheduled?.masteryScore ?? Number(existing.data?.mastery_score || 0),
    last_rating: rating || existing.data?.last_rating || null,
    updated_at: nowIso,
  };
  const result = await context.supabase.from("topik_master_vocabulary_srs").upsert(payload).select("vocabulary_id,status,bookmarked,first_seen_at,last_reviewed_at,next_review_at,review_count,correct_count,wrong_count,ease_factor,interval_days,mastery_score,last_rating").single();
  if (result.error || !result.data) return NextResponse.json({ ok: false, error: "Không thể lưu lượt ôn từ." }, { status: 500 });
  return NextResponse.json({ ok: true, state: serialize(result.data as SrsRow) });
}
