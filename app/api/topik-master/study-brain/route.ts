import { NextResponse } from "next/server";
import { getTopikMasterContext } from "@/utils/topik-master/server";

type EventRow = { skill: string; subskill: string; correct: boolean; response_time_ms: number; created_at: string; context: Record<string, unknown> | null };

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const nowIso = new Date().toISOString();
  const [events, dueMistakes, dueVocabulary, dueGrammar] = await Promise.all([
    context.supabase.from("topik_master_learning_events").select("skill,subskill,correct,response_time_ms,created_at,context").eq("user_id", context.user.id).gte("created_at", since30).order("created_at", { ascending: false }).limit(5000),
    context.supabase.from("topik_mistakes").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("next_review_at", nowIso),
    context.supabase.from("topik_master_vocabulary_srs").select("vocabulary_id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("next_review_at", nowIso),
    context.supabase.from("topik_master_grammar_progress").select("grammar_id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("next_review_at", nowIso),
  ]);
  if (events.error) return NextResponse.json({ ok: false, error: "Study Brain chưa sẵn sàng." }, { status: 503 });
  const rows = (events.data || []) as EventRow[];
  const buckets = new Map<string, { skill: string; questionType: string; attempts: number; correct: number; time: number; recent7: number; recent7Correct: number }>();
  for (const event of rows) {
    const key = `${event.skill}:${event.subskill}`;
    const bucket = buckets.get(key) || { skill: event.skill, questionType: event.subskill, attempts: 0, correct: 0, time: 0, recent7: 0, recent7Correct: 0 };
    bucket.attempts += 1; bucket.correct += event.correct ? 1 : 0; bucket.time += event.response_time_ms || 0;
    if (event.created_at >= since7) { bucket.recent7 += 1; bucket.recent7Correct += event.correct ? 1 : 0; }
    buckets.set(key, bucket);
  }
  const insights = [...buckets.values()].map((bucket) => ({ ...bucket,
    accuracy: Math.round((bucket.correct / Math.max(1, bucket.attempts)) * 100), recent7Accuracy: Math.round((bucket.recent7Correct / Math.max(1, bucket.recent7)) * 100),
    averageResponseTimeMs: Math.round(bucket.time / Math.max(1, bucket.attempts)) })).sort((a, b) => a.accuracy - b.accuracy);
  const recommendations = insights.slice(0, 4).map((item) => ({ skill: item.skill, questionType: item.questionType,
    count: item.accuracy < 50 ? 30 : item.accuracy < 70 ? 20 : 10, reason: `${item.questionType}: đúng ${item.accuracy}% trong ${item.attempts} lượt` }));
  return NextResponse.json({ ok: true, periodDays: 30, totals: { events: rows.length, dueMistakes: dueMistakes.count || 0, dueVocabulary: dueVocabulary.count || 0, dueGrammar: dueGrammar.count || 0 }, insights, recommendations });
}
