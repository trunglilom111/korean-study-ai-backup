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
  question_number?: number | null;
  question_type: string;
  prompt: string;
  passage: string | null;
  audio_url: string | null;
  transcript?: string | null;
  translation_vi?: string | null;
  audio_duration_seconds?: number | null;
  audio_speakers?: unknown;
  options: unknown;
  difficulty: number;
  tags?: unknown;
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

function audioSpeakers(value: unknown): PracticeQuestion["audioSpeakers"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const speaker = item as Record<string, unknown>;
    const name = typeof speaker.name === "string" ? speaker.name : "";
    const gender = speaker.gender === "male" ? "male" : speaker.gender === "female" ? "female" : null;
    if (!name || !gender) return [];
    return [{ name, gender, voice: typeof speaker.voice === "string" ? speaker.voice : undefined }];
  });
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
  let questionsResult: { data: unknown[] | null; error: unknown } = questionIds.length
    ? await supabase
      .from("topik_master_questions")
      .select("id,external_key,skill,subskill,question_number,question_type,prompt,passage,audio_url,transcript,translation_vi,audio_duration_seconds,audio_speakers,options,difficulty,tags")
      .in("id", questionIds)
    : { data: [], error: null };

  if (questionsResult.error && questionIds.length) {
    questionsResult = await supabase
      .from("topik_master_questions")
      .select("id,external_key,skill,subskill,question_type,prompt,passage,audio_url,options,difficulty")
      .in("id", questionIds);
  }

  if (questionsResult.error) return { session: null, error: questionsResult.error };

  const vocabularyResult = questionIds.length
    ? await supabase
        .from("topik_master_question_vocabulary")
        .select("question_id,topik_master_vocabulary(id,lemma,meaning_vi)")
        .in("question_id", questionIds)
    : { data: [], error: null };
  const vocabularyByQuestion = new Map<string, PracticeQuestion["vocabulary"]>();
  if (!vocabularyResult.error) {
    for (const link of vocabularyResult.data || []) {
      const raw = link.topik_master_vocabulary as unknown;
      const term = (Array.isArray(raw) ? raw[0] : raw) as { id?: string; lemma?: string; meaning_vi?: string | null } | null;
      if (!term?.id || !term.lemma) continue;
      vocabularyByQuestion.set(link.question_id, [...(vocabularyByQuestion.get(link.question_id) || []), { id: term.id, lemma: term.lemma, meaningVi: term.meaning_vi || null }]);
    }
  }

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
      questionNumber: question.question_number ?? mapping.position,
      questionType: question.question_type,
      prompt: question.prompt,
      passage: question.passage,
      audioUrl: question.audio_url,
      transcript: question.transcript ?? null,
      translationVi: question.translation_vi ?? null,
      audioDurationSeconds: question.audio_duration_seconds == null ? null : Number(question.audio_duration_seconds),
      audioSpeakers: audioSpeakers(question.audio_speakers),
      vocabulary: vocabularyByQuestion.get(question.id) || [],
      options: stringArray(question.options),
      difficulty: question.difficulty,
      tags: stringArray(question.tags ?? []),
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
