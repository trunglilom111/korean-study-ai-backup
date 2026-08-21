import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import { scheduleReview } from "@/utils/topik-master/study-brain";

const ratings = new Set(["again", "hard", "good", "easy"]);

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const url = new URL(request.url);
  const skill = url.searchParams.get("skill");
  const dueOnly = url.searchParams.get("due") === "true";
  let query = context.supabase
    .from("topik_mistakes")
    .select("id,question_key,skill,subskill,prompt,selected_answer,correct_answer,selected_answer_index,correct_answer_index,explanation,error_type,priority,review_count,correct_count,wrong_count,interval_days,next_review_at,difficulty,created_at")
    .eq("user_id", context.user.id)
    .order("priority", { ascending: false })
    .order("next_review_at", { ascending: true, nullsFirst: true })
    .limit(100);
  if (skill && ["listening", "reading", "writing", "vocabulary", "grammar"].includes(skill)) query = query.eq("skill", skill);
  if (dueOnly) query = query.or(`next_review_at.is.null,next_review_at.lte.${new Date().toISOString()}`);
  const result = await query;
  if (result.error) return NextResponse.json({ ok: false, error: "Mistake Master chưa sẵn sàng." }, { status: 503 });
  return NextResponse.json({ ok: true, mistakes: result.data || [] });
}

export async function PATCH(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const id = typeof body.id === "string" ? body.id : "";
  const rating = typeof body.rating === "string" ? body.rating : "";
  if (!id || !ratings.has(rating)) return NextResponse.json({ ok: false, error: "Đánh giá lượt ôn không hợp lệ." }, { status: 400 });

  const existing = await context.supabase
    .from("topik_mistakes")
    .select("id,question_key,interval_days,review_count,correct_count,wrong_count")
    .eq("id", id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (existing.error || !existing.data) return NextResponse.json({ ok: false, error: "Không tìm thấy câu sai." }, { status: 404 });
  const correct = rating !== "again";
  const scheduled = scheduleReview({
    correct,
    previousIntervalDays: Number(existing.data.interval_days) || 0,
    previousEaseFactor: rating === "easy" ? 2.8 : rating === "hard" ? 1.8 : 2.5,
  });
  const dueAt = new Date(Date.now() + scheduled.dueInDays * 86_400_000).toISOString();
  const updated = await context.supabase.from("topik_mistakes").update({
    review_count: existing.data.review_count + 1,
    correct_count: existing.data.correct_count + (correct ? 1 : 0),
    wrong_count: existing.data.wrong_count + (correct ? 0 : 1),
    last_reviewed_at: new Date().toISOString(),
    next_review_at: dueAt,
    interval_days: scheduled.intervalDays,
    difficulty: rating,
    priority: scheduled.priority,
  }).eq("id", id).eq("user_id", context.user.id);
  if (updated.error) return NextResponse.json({ ok: false, error: "Không thể cập nhật lịch ôn." }, { status: 500 });

  if (existing.data.question_key) {
    await context.supabase.from("topik_master_review_queue").update({
      priority: scheduled.priority,
      due_at: dueAt,
      interval_days: scheduled.intervalDays,
      ease_factor: scheduled.easeFactor,
      updated_at: new Date().toISOString(),
    }).eq("user_id", context.user.id).eq("entity_type", "question").eq("entity_key", existing.data.question_key);
  }
  return NextResponse.json({ ok: true, nextReviewAt: dueAt, schedule: scheduled });
}
