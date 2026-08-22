import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import { scheduleGrammarReview, type GrammarRating } from "@/utils/topik-master/grammar-progress";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ratings = new Set<GrammarRating>(["again", "hard", "good", "easy"]);

type Row = {
  grammar_id: string; status: "learning" | "understood" | "mastered" | "hard"; bookmarked: boolean; note: string;
  first_seen_at: string; last_studied_at: string | null; next_review_at: string | null; review_count: number;
  correct_count: number; wrong_count: number; ease_factor: number; interval_days: number; mastery_score: number; last_rating: GrammarRating | null;
};

function serialize(row: Row) {
  const due = Boolean(row.next_review_at && Date.parse(row.next_review_at) <= Date.now());
  return { grammarId: row.grammar_id, status: due ? "due" : row.status, storedStatus: row.status, bookmarked: row.bookmarked, note: row.note,
    firstSeen: row.first_seen_at, lastStudied: row.last_studied_at, nextReview: row.next_review_at, reviewCount: row.review_count,
    correctCount: row.correct_count, wrongCount: row.wrong_count, ease: Number(row.ease_factor), interval: Number(row.interval_days), mastery: Number(row.mastery_score), lastRating: row.last_rating };
}

const selection = "grammar_id,status,bookmarked,note,first_seen_at,last_studied_at,next_review_at,review_count,correct_count,wrong_count,ease_factor,interval_days,mastery_score,last_rating";

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") || "").split(",").filter((id) => uuidPattern.test(id)).slice(0, 100);
  const grammarId = url.searchParams.get("grammarId") || "";
  let query = context.supabase.from("topik_master_grammar_progress").select(selection).eq("user_id", context.user.id).limit(100);
  if (ids.length) query = query.in("grammar_id", ids);
  if (uuidPattern.test(grammarId)) query = query.eq("grammar_id", grammarId);
  const result = await query;
  if (result.error) return NextResponse.json({ ok: false, error: "Grammar Progress chưa được bật bằng migration 012." }, { status: 503 });

  let relatedQuestions: unknown[] = [];
  let history: unknown[] = [];
  if (uuidPattern.test(grammarId)) {
    const [links, events] = await Promise.all([
      context.supabase.from("topik_master_question_grammar").select("relevance,topik_master_questions(external_key,exam_type,skill,question_number,question_type,prompt,difficulty)").eq("grammar_id", grammarId).order("relevance", { ascending: false }).limit(12),
      context.supabase.from("topik_master_learning_events").select("correct,response_time_ms,context,created_at").eq("user_id", context.user.id).eq("question_key", `grammar:${grammarId}`).order("created_at", { ascending: false }).limit(20),
    ]);
    relatedQuestions = (links.data || []).map((row) => row.topik_master_questions);
    history = events.data || [];
  }
  return NextResponse.json({ ok: true, states: ((result.data || []) as Row[]).map(serialize), relatedQuestions, history });
}

export async function POST(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const grammarId = typeof body.grammarId === "string" ? body.grammarId : "";
  if (!uuidPattern.test(grammarId)) return NextResponse.json({ ok: false, error: "Mã ngữ pháp không hợp lệ." }, { status: 400 });
  const existing = await context.supabase.from("topik_master_grammar_progress").select(selection).eq("user_id", context.user.id).eq("grammar_id", grammarId).maybeSingle();
  if (existing.error) return NextResponse.json({ ok: false, error: "Grammar Progress chưa sẵn sàng." }, { status: 503 });
  const current = existing.data as Row | null;
  const rating = typeof body.rating === "string" && ratings.has(body.rating as GrammarRating) ? body.rating as GrammarRating : null;
  const nowIso = new Date().toISOString();
  const scheduled = rating ? scheduleGrammarReview({ reviewCount: current?.review_count || 0, correctCount: current?.correct_count || 0, wrongCount: current?.wrong_count || 0,
    easeFactor: Number(current?.ease_factor || 2.5), intervalDays: Number(current?.interval_days || 0), masteryScore: Number(current?.mastery_score || 0) }, rating) : null;
  const payload = {
    user_id: context.user.id, grammar_id: grammarId, status: scheduled?.status || current?.status || "learning",
    bookmarked: typeof body.bookmarked === "boolean" ? body.bookmarked : current?.bookmarked || false,
    note: typeof body.note === "string" ? body.note.trim().slice(0, 5000) : current?.note || "",
    first_seen_at: current?.first_seen_at || nowIso, last_studied_at: scheduled?.lastStudiedAt || current?.last_studied_at || null,
    next_review_at: scheduled?.nextReviewAt || current?.next_review_at || null, review_count: scheduled?.reviewCount ?? current?.review_count ?? 0,
    correct_count: scheduled?.correctCount ?? current?.correct_count ?? 0, wrong_count: scheduled?.wrongCount ?? current?.wrong_count ?? 0,
    ease_factor: scheduled?.easeFactor ?? Number(current?.ease_factor || 2.5), interval_days: scheduled?.intervalDays ?? Number(current?.interval_days || 0),
    mastery_score: scheduled?.masteryScore ?? Number(current?.mastery_score || 0), last_rating: rating || current?.last_rating || null, updated_at: nowIso,
  };
  const result = await context.supabase.from("topik_master_grammar_progress").upsert(payload).select(selection).single();
  if (result.error || !result.data) return NextResponse.json({ ok: false, error: "Không thể lưu tiến độ ngữ pháp." }, { status: 500 });
  if (rating) {
    await context.supabase.rpc("record_topik_master_answer", { p_question_key: `grammar:${grammarId}`, p_skill: "grammar", p_subskill: "grammar-review",
      p_correct: rating === "good" || rating === "easy", p_selected_answer: { rating }, p_response_time_ms: 0, p_confidence: null,
      p_error_type: rating === "again" ? "forgotten" : null, p_context: { activityType: "grammar_review", contentId: grammarId, rating, mastery: scheduled?.masteryScore } });
  } else {
    await context.supabase.from("topik_master_learning_events").insert({ user_id: context.user.id, question_key: `grammar:${grammarId}`, skill: "grammar", subskill: "grammar-progress",
      correct: true, context: { activityType: typeof body.note === "string" ? "grammar_note" : "grammar_bookmark", contentId: grammarId } });
  }
  return NextResponse.json({ ok: true, state: serialize(result.data as Row) });
}
