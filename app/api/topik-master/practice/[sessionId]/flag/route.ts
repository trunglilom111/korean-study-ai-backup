import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const context = await getTopikMasterContext(request); if (!context.ok) return context.response;
  const { sessionId } = await params;
  const result = await context.supabase.from("topik_master_session_flags").select("question_id").eq("user_id", context.user.id).eq("session_id", sessionId);
  if (result.error) return NextResponse.json({ ok: false, error: "Exam flags chưa sẵn sàng." }, { status: 503 });
  return NextResponse.json({ ok: true, questionIds: (result.data || []).map((row) => row.question_id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const context = await getTopikMasterContext(request); if (!context.ok) return context.response;
  const { sessionId } = await params; const body = asObject(await request.json().catch(() => ({})));
  const questionId = typeof body.questionId === "string" ? body.questionId : ""; const flagged = body.flagged !== false;
  if (!questionId) return NextResponse.json({ ok: false, error: "Question id không hợp lệ." }, { status: 400 });
  const result = flagged
    ? await context.supabase.from("topik_master_session_flags").upsert({ session_id: sessionId, question_id: questionId, user_id: context.user.id }, { onConflict: "session_id,question_id" })
    : await context.supabase.from("topik_master_session_flags").delete().eq("session_id", sessionId).eq("question_id", questionId).eq("user_id", context.user.id);
  if (result.error) return NextResponse.json({ ok: false, error: "Không lưu được cờ câu hỏi." }, { status: 500 });
  return NextResponse.json({ ok: true, flagged });
}
