import { NextResponse } from "next/server";
import { asObject, boundedInteger, getTopikMasterContext } from "@/utils/topik-master/server";

type Params = { params: Promise<{ sessionId: string }> };

export async function PATCH(request: Request, contextParams: Params) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const { sessionId } = await contextParams.params;
  const body = asObject(await request.json().catch(() => ({})));

  const sessionResult = await context.supabase
    .from("topik_master_practice_sessions")
    .select("id,exam_id,total_questions,status")
    .eq("id", sessionId)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (sessionResult.error) return NextResponse.json({ ok: false, error: "Không thể đọc phiên làm bài." }, { status: 503 });
  if (!sessionResult.data) return NextResponse.json({ ok: false, error: "Phiên làm bài không tồn tại." }, { status: 404 });
  if (sessionResult.data.status !== "active") {
    return NextResponse.json({ ok: false, error: "Phiên này không còn nhận autosave." }, { status: 409 });
  }

  const mappings = await context.supabase
    .from("topik_master_exam_questions")
    .select("question_id")
    .eq("exam_id", sessionResult.data.exam_id);
  if (mappings.error) return NextResponse.json({ ok: false, error: "Không thể xác thực câu hỏi." }, { status: 500 });
  const allowedQuestionIds = new Set((mappings.data || []).map((row) => row.question_id));
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const rows = answers.flatMap((item) => {
    const answer = asObject(item);
    const questionId = typeof answer.questionId === "string" ? answer.questionId : "";
    const selected = answer.selectedAnswerIndex === null ? null : Number(answer.selectedAnswerIndex);
    if (!allowedQuestionIds.has(questionId) || (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected > 20))) return [];
    const confidenceNumber = answer.confidence == null ? null : Number(answer.confidence);
    return [{
      session_id: sessionId,
      question_id: questionId,
      selected_answer_index: selected,
      response_time_ms: boundedInteger(answer.responseTimeMs, 0, 86_400_000, 0),
      confidence: confidenceNumber !== null && Number.isFinite(confidenceNumber)
        ? Math.min(1, Math.max(0, confidenceNumber))
        : null,
      updated_at: new Date().toISOString(),
    }];
  });

  if (rows.length) {
    const savedAnswers = await context.supabase
      .from("topik_master_session_answers")
      .upsert(rows, { onConflict: "session_id,question_id" });
    if (savedAnswers.error) return NextResponse.json({ ok: false, error: "Không thể autosave đáp án." }, { status: 500 });
  }

  const currentPosition = boundedInteger(body.currentPosition, 1, sessionResult.data.total_questions, 1);
  const remainingSeconds = boundedInteger(body.remainingSeconds, 0, 86_400, 0);
  const updated = await context.supabase
    .from("topik_master_practice_sessions")
    .update({ current_position: currentPosition, remaining_seconds: remainingSeconds, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", context.user.id)
    .eq("status", "active");

  if (updated.error) return NextResponse.json({ ok: false, error: "Không thể autosave tiến độ." }, { status: 500 });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
