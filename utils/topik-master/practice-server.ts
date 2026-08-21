import type { SupabaseClient } from "@supabase/supabase-js";
import type { PracticeAnswer, PracticeQuestion, PracticeSession } from "@/utils/topik-master/types";

type SessionRow = {
  id: string;
  exam_id: string;
  mode: "practice" | "timed";
  status: "active" | "submitting" | "submitted" | "abandoned";
  current_position: number;
  remaining_seconds: number;
  total_questions: number;
};

type ExamRow = {
  id: string;
  external_key: string;
  title: string;
  exam_type: "TOPIK I" | "TOPIK II";
  description: string;
  duration_minutes: number;
};

type MappingRow = { question_id: string; position: number; points: number };
type QuestionRow = {
  id: string;
  external_key: string;
  skill: PracticeQuestion["skill"];
  subskill: string;
  question_type: string;
  prompt: string;
  passage: string | null;
  audio_url: string | null;
  options: unknown;
  difficulty: number;
};
type AnswerRow = {
  question_id: string;
  selected_answer_index: number | null;
  response_time_ms: number;
  confidence: number | null;
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function loadPracticeSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<{ session: PracticeSession | null; error: unknown }> {
  const sessionResult = await supabase
    .from("topik_master_practice_sessions")
    .select("id,exam_id,mode,status,current_position,remaining_seconds,total_questions")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionResult.error || !sessionResult.data) {
    return { session: null, error: sessionResult.error || new Error("Practice session not found") };
  }
  const sessionRow = sessionResult.data as SessionRow;
  const [examResult, mappingsResult, answersResult] = await Promise.all([
    supabase
      .from("topik_master_exams")
      .select("id,external_key,title,exam_type,description,duration_minutes")
      .eq("id", sessionRow.exam_id)
      .single(),
    supabase
      .from("topik_master_exam_questions")
      .select("question_id,position,points")
      .eq("exam_id", sessionRow.exam_id)
      .order("position"),
    supabase
      .from("topik_master_session_answers")
      .select("question_id,selected_answer_index,response_time_ms,confidence")
      .eq("session_id", sessionId),
  ]);

  if (examResult.error || mappingsResult.error || answersResult.error || !examResult.data) {
    return { session: null, error: examResult.error || mappingsResult.error || answersResult.error };
  }

  const mappings = (mappingsResult.data || []) as MappingRow[];
  const questionIds = mappings.map((mapping) => mapping.question_id);
  const questionsResult = questionIds.length
    ? await supabase
      .from("topik_master_questions")
      .select("id,external_key,skill,subskill,question_type,prompt,passage,audio_url,options,difficulty")
      .in("id", questionIds)
    : { data: [], error: null };

  if (questionsResult.error) return { session: null, error: questionsResult.error };

  const questionById = new Map(((questionsResult.data || []) as QuestionRow[]).map((question) => [question.id, question]));
  const questions = mappings.flatMap((mapping) => {
    const question = questionById.get(mapping.question_id);
    if (!question) return [];
    return [{
      id: question.id,
      externalKey: question.external_key,
      position: mapping.position,
      skill: question.skill,
      subskill: question.subskill,
      questionType: question.question_type,
      prompt: question.prompt,
      passage: question.passage,
      audioUrl: question.audio_url,
      options: stringArray(question.options),
      difficulty: question.difficulty,
      points: Number(mapping.points),
    } satisfies PracticeQuestion];
  });

  const answers: PracticeAnswer[] = ((answersResult.data || []) as AnswerRow[]).map((answer) => ({
    questionId: answer.question_id,
    selectedAnswerIndex: answer.selected_answer_index,
    responseTimeMs: answer.response_time_ms,
    confidence: answer.confidence == null ? null : Number(answer.confidence),
  }));
  const exam = examResult.data as ExamRow;

  return {
    session: {
      id: sessionRow.id,
      persisted: true,
      mode: sessionRow.mode,
      status: sessionRow.status,
      currentPosition: sessionRow.current_position,
      remainingSeconds: sessionRow.remaining_seconds,
      totalQuestions: sessionRow.total_questions,
      exam: {
        id: exam.id,
        externalKey: exam.external_key,
        title: exam.title,
        examType: exam.exam_type,
        description: exam.description,
        durationMinutes: exam.duration_minutes,
      },
      questions,
      answers,
    },
    error: null,
  };
}
