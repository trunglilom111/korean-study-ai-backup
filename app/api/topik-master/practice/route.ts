import { NextResponse } from "next/server";
import { getTopikMasterContext, asObject } from "@/utils/topik-master/server";
import { loadPracticeSession } from "@/utils/topik-master/practice-server";

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;

  const active = await context.supabase
    .from("topik_master_practice_sessions")
    .select("id")
    .eq("user_id", context.user.id)
    .in("status", ["active", "submitting"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active.error) {
    return NextResponse.json({ ok: false, error: "Practice Engine chưa được bật bằng migration Giai đoạn 4." }, { status: 503 });
  }
  if (!active.data) return NextResponse.json({ ok: true, session: null });

  const loaded = await loadPracticeSession(context.supabase, context.user.id, active.data.id);
  if (loaded.error || !loaded.session) {
    return NextResponse.json({ ok: false, error: "Không thể khôi phục phiên làm bài." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, session: loaded.session });
}

export async function POST(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;

  const body = asObject(await request.json().catch(() => ({})));
  const examKey = typeof body.examKey === "string" && body.examKey.trim()
    ? body.examKey.trim()
    : "tm-original-diagnostic-listening-001";
  const mode = body.mode === "timed" ? "timed" : "practice";
  const examResult = await context.supabase
    .from("topik_master_exams")
    .select("id,duration_minutes")
    .eq("external_key", examKey)
    .eq("status", "published")
    .maybeSingle();

  if (examResult.error) {
    return NextResponse.json({ ok: false, error: "Learning Data chưa được bật bằng migration Giai đoạn 3." }, { status: 503 });
  }
  if (!examResult.data) return NextResponse.json({ ok: false, error: "Không tìm thấy bộ đề đã chọn." }, { status: 404 });

  const existing = await context.supabase
    .from("topik_master_practice_sessions")
    .select("id")
    .eq("user_id", context.user.id)
    .eq("exam_id", examResult.data.id)
    .in("status", ["active", "submitting"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ ok: false, error: "Practice Engine chưa được bật bằng migration Giai đoạn 4." }, { status: 503 });
  }

  let sessionId = existing.data?.id;
  if (!sessionId) {
    const countResult = await context.supabase
      .from("topik_master_exam_questions")
      .select("question_id", { count: "exact", head: true })
      .eq("exam_id", examResult.data.id);
    const totalQuestions = countResult.count || 0;
    if (countResult.error || totalQuestions === 0) {
      return NextResponse.json({ ok: false, error: "Bộ đề chưa có câu hỏi để bắt đầu." }, { status: 409 });
    }

    const created = await context.supabase
      .from("topik_master_practice_sessions")
      .insert({
        user_id: context.user.id,
        exam_id: examResult.data.id,
        mode,
        remaining_seconds: examResult.data.duration_minutes * 60,
        total_questions: totalQuestions,
      })
      .select("id")
      .single();
    if (created.error || !created.data) {
      return NextResponse.json({ ok: false, error: "Không thể tạo phiên làm bài." }, { status: 500 });
    }
    sessionId = created.data.id;
  }

  const loaded = await loadPracticeSession(context.supabase, context.user.id, sessionId);
  if (loaded.error || !loaded.session) {
    return NextResponse.json({ ok: false, error: "Không thể tải nội dung bộ đề." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, session: loaded.session }, { status: existing.data ? 200 : 201 });
}
