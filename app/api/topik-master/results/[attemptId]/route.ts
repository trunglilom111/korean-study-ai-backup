import { NextResponse } from "next/server";
import { getTopikMasterContext } from "@/utils/topik-master/server";
import type { SessionResult } from "@/utils/topik-master/types";

type Params = { params: Promise<{ attemptId: string }> };

export async function GET(request: Request, contextParams: Params) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const { attemptId } = await contextParams.params;
  const [attempt, sections, mistakes] = await Promise.all([
    context.supabase.from("topik_attempts").select("id,exam_title,score_percent,correct_count,total_questions").eq("id", attemptId).eq("user_id", context.user.id).maybeSingle(),
    context.supabase.from("topik_master_attempt_sections").select("skill,correct_count,total_questions,score_percent").eq("attempt_id", attemptId).eq("user_id", context.user.id),
    context.supabase.from("topik_mistakes").select("id,question_key,skill,subskill,prompt,selected_answer,selected_answer_index,correct_answer,correct_answer_index,explanation").eq("attempt_id", attemptId).eq("user_id", context.user.id),
  ]);
  if (attempt.error || sections.error || mistakes.error) return NextResponse.json({ ok: false, error: "Không thể tải kết quả." }, { status: 503 });
  if (!attempt.data) return NextResponse.json({ ok: false, error: "Không tìm thấy kết quả." }, { status: 404 });
  const accuracy = Number(attempt.data.score_percent);
  const result: SessionResult = {
    attemptId: attempt.data.id,
    correct: attempt.data.correct_count,
    total: attempt.data.total_questions,
    accuracy,
    score: Math.round(accuracy * 3),
    examTitle: attempt.data.exam_title,
    sections: (sections.data || []).map((section) => ({ skill: section.skill, correct: section.correct_count, total: section.total_questions, score: Number(section.score_percent) })),
    mistakes: (mistakes.data || []).map((mistake) => ({
      id: mistake.id,
      questionKey: mistake.question_key || "",
      skill: mistake.skill || "unknown",
      subskill: mistake.subskill || "general",
      prompt: mistake.prompt,
      selectedAnswer: mistake.selected_answer,
      selectedAnswerIndex: mistake.selected_answer_index,
      correctAnswer: mistake.correct_answer,
      correctAnswerIndex: mistake.correct_answer_index || 0,
      explanation: mistake.explanation,
    })),
    persisted: true,
  };
  return NextResponse.json({ ok: true, result });
}
