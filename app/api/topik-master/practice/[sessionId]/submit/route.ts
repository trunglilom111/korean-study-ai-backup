import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import type { ResultMistake, SessionResult } from "@/utils/topik-master/types";

type Params = { params: Promise<{ sessionId: string }> };
type QuestionRow = {
  id: string;
  external_key: string;
  skill: string;
  subskill: string;
  prompt: string;
  options: unknown;
  correct_answer_index: number | null;
  explanation_vi: string;
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(request: Request, contextParams: Params) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const { sessionId } = await contextParams.params;
  const requestBody = asObject(await request.json().catch(() => ({})));

  const sessionResult = await context.supabase
    .from("topik_master_practice_sessions")
    .select("id,exam_id,status,remaining_seconds,result_snapshot")
    .eq("id", sessionId)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (sessionResult.error) return NextResponse.json({ ok: false, error: "Practice Engine chưa sẵn sàng." }, { status: 503 });
  if (!sessionResult.data) return NextResponse.json({ ok: false, error: "Phiên làm bài không tồn tại." }, { status: 404 });
  if (sessionResult.data.status === "submitted" && sessionResult.data.result_snapshot) {
    return NextResponse.json({ ok: true, result: sessionResult.data.result_snapshot, replayed: true });
  }
  if (sessionResult.data.status !== "active") {
    return NextResponse.json({ ok: false, error: "Phiên đang được xử lý. Hãy thử lại sau ít phút." }, { status: 409 });
  }

  const locked = await context.supabase
    .from("topik_master_practice_sessions")
    .update({ status: "submitting", updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", context.user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (locked.error || !locked.data) return NextResponse.json({ ok: false, error: "Phiên đã được gửi từ một cửa sổ khác." }, { status: 409 });

  const fail = async (message: string, status = 500) => {
    await context.supabase.from("topik_master_practice_sessions").update({ status: "active" }).eq("id", sessionId).eq("user_id", context.user.id);
    return NextResponse.json({ ok: false, error: message }, { status });
  };

  const [examResult, mappingsResult, answersResult] = await Promise.all([
    context.supabase.from("topik_master_exams").select("id,external_key,title,exam_type,duration_minutes").eq("id", sessionResult.data.exam_id).single(),
    context.supabase.from("topik_master_exam_questions").select("question_id,position").eq("exam_id", sessionResult.data.exam_id).order("position"),
    context.supabase.from("topik_master_session_answers").select("question_id,selected_answer_index,response_time_ms,confidence").eq("session_id", sessionId),
  ]);
  if (examResult.error || mappingsResult.error || answersResult.error || !examResult.data) return fail("Không thể chấm phiên làm bài.");

  const questionIds = (mappingsResult.data || []).map((row) => row.question_id);
  const questionsResult = await context.supabase
    .from("topik_master_questions")
    .select("id,external_key,skill,subskill,prompt,options,correct_answer_index,explanation_vi")
    .in("id", questionIds);
  if (questionsResult.error) return fail("Không thể tải đáp án chuẩn.");

  const questionById = new Map(((questionsResult.data || []) as QuestionRow[]).map((question) => [question.id, question]));
  const answerByQuestion = new Map((answersResult.data || []).map((answer) => [answer.question_id, answer]));
  const orderedQuestions = (mappingsResult.data || []).flatMap((mapping) => {
    const question = questionById.get(mapping.question_id);
    return question ? [question] : [];
  });
  const scoredQuestions = orderedQuestions.filter((question) => question.correct_answer_index !== null);
  const mistakes: ResultMistake[] = [];
  const answerSnapshot: Record<string, number | null> = {};
  const sectionMap = new Map<string, { skill: string; correct: number; total: number; score: number }>();
  let correctCount = 0;

  for (const question of scoredQuestions) {
    const answer = answerByQuestion.get(question.id);
    const selectedIndex = answer?.selected_answer_index ?? null;
    const correctIndex = question.correct_answer_index as number;
    const correct = selectedIndex === correctIndex;
    const options = stringArray(question.options);
    answerSnapshot[question.external_key] = selectedIndex;
    if (correct) correctCount += 1;
    const section = sectionMap.get(question.skill) || { skill: question.skill, correct: 0, total: 0, score: 0 };
    section.total += 1;
    if (correct) section.correct += 1;
    sectionMap.set(question.skill, section);
    if (!correct) {
      mistakes.push({
        questionKey: question.external_key,
        skill: question.skill,
        subskill: question.subskill,
        prompt: question.prompt,
        selectedAnswer: selectedIndex === null ? "Chưa trả lời" : options[selectedIndex] || "Đáp án không hợp lệ",
        selectedAnswerIndex: selectedIndex,
        correctAnswer: options[correctIndex] || "",
        correctAnswerIndex: correctIndex,
        explanation: question.explanation_vi,
      });
    }
  }

  const total = scoredQuestions.length;
  const accuracy = total ? Math.round((correctCount / total) * 100) : 0;
  const score = total ? Math.round((correctCount / total) * 300) : 0;
  const sections = [...sectionMap.values()].map((section) => ({ ...section, score: section.total ? Math.round((section.correct / section.total) * 100) : 0 }));
  const existingAttempt = await context.supabase
    .from("topik_attempts")
    .select("id")
    .eq("topik_master_session_id", sessionId)
    .maybeSingle();
  let attemptId = existingAttempt.data?.id;

  if (!attemptId) {
    const attempt = await context.supabase.from("topik_attempts").insert({
      user_id: context.user.id,
      exam_id: examResult.data.external_key,
      exam_title: examResult.data.title,
      target: examResult.data.exam_type,
      mode: requestBody.mode === "timed" ? "timed" : "practice",
      score_percent: accuracy,
      correct_count: correctCount,
      total_questions: total,
      time_spent_seconds: Math.max(0, examResult.data.duration_minutes * 60 - sessionResult.data.remaining_seconds),
      answers: answerSnapshot,
      mistakes,
      topik_master_session_id: sessionId,
    }).select("id").single();
    if (attempt.error || !attempt.data) return fail("Đã chấm nhưng chưa lưu được kết quả.");
    attemptId = attempt.data.id;
  }

  if (sections.length) {
    const sectionSave = await context.supabase.from("topik_master_attempt_sections").upsert(
      sections.map((section) => ({
        attempt_id: attemptId,
        user_id: context.user.id,
        skill: section.skill,
        correct_count: section.correct,
        total_questions: section.total,
        score_percent: section.score,
      })),
      { onConflict: "attempt_id,skill" }
    );
    if (sectionSave.error) return fail("Kết quả tổng đã lưu nhưng chưa lưu được điểm từng phần.");
  }

  if (mistakes.length) {
    const questionIdByKey = new Map(scoredQuestions.map((question) => [question.external_key, question.id]));
    const mistakeSave = await context.supabase.from("topik_mistakes").upsert(
      mistakes.map((mistake) => ({
        attempt_id: attemptId,
        user_id: context.user.id,
        exam_id: examResult.data.external_key,
        question_id: mistake.questionKey,
        question_uuid: questionIdByKey.get(mistake.questionKey),
        question_key: mistake.questionKey,
        skill: mistake.skill,
        subskill: mistake.subskill,
        prompt: mistake.prompt,
        selected_answer: mistake.selectedAnswer,
        correct_answer: mistake.correctAnswer,
        selected_answer_index: mistake.selectedAnswerIndex,
        correct_answer_index: mistake.correctAnswerIndex,
        explanation: mistake.explanation,
        error_type: mistake.subskill,
        priority: 0.9,
        next_review_at: new Date().toISOString(),
      })),
      { onConflict: "attempt_id,question_id" }
    );
    if (mistakeSave.error) return fail("Kết quả đã lưu nhưng chưa lưu được sổ câu sai.");
  }

  await Promise.all(scoredQuestions.map(async (question) => {
    const answer = answerByQuestion.get(question.id);
    const correct = answer?.selected_answer_index === question.correct_answer_index;
    await context.supabase.rpc("record_topik_master_answer", {
      p_question_key: question.external_key,
      p_skill: question.skill,
      p_subskill: question.subskill,
      p_correct: correct,
      p_selected_answer: answer?.selected_answer_index ?? null,
      p_response_time_ms: answer?.response_time_ms || 0,
      p_confidence: answer?.confidence ?? null,
      p_error_type: correct ? null : question.subskill,
      p_context: { sessionId, attemptId },
    });
  }));

  const result: SessionResult = {
    attemptId,
    correct: correctCount,
    total,
    score,
    accuracy,
    examTitle: examResult.data.title,
    sections,
    mistakes,
    persisted: true,
  };
  const answerUpdates = scoredQuestions.map((question) => ({
    session_id: sessionId,
    question_id: question.id,
    selected_answer_index: answerByQuestion.get(question.id)?.selected_answer_index ?? null,
    response_time_ms: answerByQuestion.get(question.id)?.response_time_ms || 0,
    confidence: answerByQuestion.get(question.id)?.confidence ?? null,
    is_correct: answerByQuestion.get(question.id)?.selected_answer_index === question.correct_answer_index,
    updated_at: new Date().toISOString(),
  }));
  if (answerUpdates.length) await context.supabase.from("topik_master_session_answers").upsert(answerUpdates, { onConflict: "session_id,question_id" });

  const finished = await context.supabase.from("topik_master_practice_sessions").update({
    status: "submitted",
    correct_count: correctCount,
    score_percent: accuracy,
    result_snapshot: result,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", sessionId).eq("user_id", context.user.id);
  if (finished.error) return fail("Kết quả đã lưu nhưng chưa đóng được phiên làm bài.");

  return NextResponse.json({ ok: true, result });
}
