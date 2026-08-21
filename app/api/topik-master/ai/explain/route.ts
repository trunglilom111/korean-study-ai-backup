import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import { aiUsageSnapshot, createAiCacheKey, runAiWithRetry, TOPIK_AI_DAILY_LIMIT, TOPIK_AI_MODEL, TOPIK_AI_PROMPT_VERSION } from "@/utils/topik-master/ai";
import type { AiQuestionExplanation } from "@/utils/topik-master/types";

const explanationSchema = {
  type: "object",
  properties: {
    correct: { type: "boolean" },
    errorType: { type: "string" },
    explanationVi: { type: "string" },
    whyUserAnswerWrong: { type: "string" },
    importantVocabulary: { type: "array", items: { type: "string" } },
    importantGrammar: { type: "array", items: { type: "string" } },
    trap: { type: "string" },
    topikTip: { type: "string" },
    similarQuestion: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        answerIndex: { type: "integer" },
        explanation: { type: "string" },
      },
      required: ["prompt", "options", "answerIndex", "explanation"],
    },
  },
  required: ["correct", "errorType", "explanationVi", "whyUserAnswerWrong", "importantVocabulary", "importantGrammar", "trap", "topikTip", "similarQuestion"],
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const questionKey = typeof body.questionKey === "string" ? body.questionKey.trim() : "";
  const selectedAnswerIndex = body.selectedAnswerIndex === null ? null : Number(body.selectedAnswerIndex);
  if (!questionKey || (selectedAnswerIndex !== null && (!Number.isInteger(selectedAnswerIndex) || selectedAnswerIndex < 0))) {
    return NextResponse.json({ ok: false, error: "Câu hỏi hoặc đáp án đã chọn không hợp lệ." }, { status: 400 });
  }

  const questionResult = await context.supabase
    .from("topik_master_questions")
    .select("external_key,version,skill,subskill,prompt,passage,options,correct_answer_index,explanation_vi")
    .eq("external_key", questionKey)
    .eq("status", "published")
    .maybeSingle();
  if (questionResult.error) return NextResponse.json({ ok: false, error: "Question Bank chưa sẵn sàng." }, { status: 503 });
  if (!questionResult.data || questionResult.data.correct_answer_index === null) {
    return NextResponse.json({ ok: false, error: "Không tìm thấy câu hỏi có thể phân tích." }, { status: 404 });
  }

  const question = questionResult.data;
  const options = stringArray(question.options);
  const correctIndex = question.correct_answer_index;
  const isCorrect = selectedAnswerIndex === correctIndex;
  const fallback: AiQuestionExplanation = {
    correct: isCorrect,
    errorType: isCorrect ? "none" : question.subskill,
    explanationVi: question.explanation_vi || `Đáp án đúng là ${options[correctIndex] || `lựa chọn ${correctIndex + 1}`}.`,
    whyUserAnswerWrong: isCorrect ? "Bạn đã chọn đúng." : `Lựa chọn ${selectedAnswerIndex === null ? "bỏ trống" : options[selectedAnswerIndex] || selectedAnswerIndex + 1} không khớp với tín hiệu chính của câu.`,
    importantVocabulary: [],
    importantGrammar: [],
    trap: `Bẫy thường gặp của dạng ${question.subskill} là chọn chi tiết có xuất hiện nhưng không trả lời đúng trọng tâm.`,
    topikTip: "Xác định loại câu hỏi trước, sau đó ghi lại 1–2 từ khóa quyết định.",
    similarQuestion: {
      prompt: `연습: ${question.prompt}`,
      options,
      answerIndex: correctIndex,
      explanation: question.explanation_vi || "Dùng cùng chiến lược nhận diện từ khóa.",
    },
  };
  const cacheKey = createAiCacheKey([TOPIK_AI_PROMPT_VERSION, question.external_key, question.version, selectedAnswerIndex]);
  const cached = await context.supabase
    .from("topik_master_ai_cache")
    .select("payload,model")
    .eq("user_id", context.user.id)
    .eq("cache_key", cacheKey)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();
  if (!cached.error && cached.data?.payload) {
    return NextResponse.json({ ok: true, provider: "cache", model: cached.data.model, explanation: cached.data.payload });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: true, provider: "fixed", explanation: fallback, warning: "Gemini chưa được cấu hình." });

  const utcDayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const dailyUsage = await context.supabase.from("topik_master_ai_cache").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).gte("created_at", utcDayStart);
  if (!dailyUsage.error && (dailyUsage.count || 0) >= TOPIK_AI_DAILY_LIMIT) {
    return NextResponse.json({ ok: true, provider: "fixed", explanation: fallback, warning: "Đã đạt quota AI hôm nay; đang dùng giải thích kiểm duyệt." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await runAiWithRetry(() => ai.interactions.create({
      model: TOPIK_AI_MODEL,
      input: `
Bạn là giáo viên luyện TOPIK cho người Việt. Phân tích đúng câu hỏi dưới đây, ngắn gọn nhưng có tính dạy học.

CÂU HỎI: ${question.prompt}
ĐOẠN VĂN/NGỮ CẢNH: ${question.passage || "Không có đoạn văn; đây là câu nghe dạng script-only."}
KỸ NĂNG: ${question.skill} / ${question.subskill}
LỰA CHỌN: ${JSON.stringify(options)}
ĐÁP ÁN USER: ${selectedAnswerIndex === null ? "bỏ trống" : selectedAnswerIndex}
ĐÁP ÁN ĐÚNG: ${correctIndex}
GIẢI THÍCH ĐÃ KIỂM DUYỆT: ${question.explanation_vi}

Yêu cầu:
- Giải thích bằng tiếng Việt, không bịa audio hoặc chi tiết không có trong dữ liệu.
- Chỉ ra bẫy và mẹo làm dạng câu này.
- Trích tối đa 5 từ/cụm từ và 3 điểm ngữ pháp thực sự liên quan.
- Tạo đúng 1 câu luyện tương tự nguyên gốc, 4 lựa chọn và answerIndex 0-based.
- similarQuestion không được sao chép câu TOPIK chính thức.
`,
      store: false,
      response_format: { type: "text", mime_type: "application/json", schema: explanationSchema },
    }), 1);
    if (!interaction.output_text) throw new Error("Gemini không trả dữ liệu.");
    const explanation = JSON.parse(interaction.output_text) as AiQuestionExplanation;
    const usage = aiUsageSnapshot(interaction.usage);
    await context.supabase.from("topik_master_ai_cache").upsert({
      user_id: context.user.id,
      cache_key: cacheKey,
      kind: "question-explanation",
      source_key: question.external_key,
      source_version: question.version,
      model: TOPIK_AI_MODEL,
      prompt_version: TOPIK_AI_PROMPT_VERSION,
      payload: explanation,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      thought_tokens: usage.thoughtTokens,
      estimated_cost_usd: usage.estimatedCostUsd,
    }, { onConflict: "user_id,cache_key" });
    await context.supabase.from("topik_master_generated_practice").insert({
      user_id: context.user.id,
      source_question_key: question.external_key,
      model: TOPIK_AI_MODEL,
      prompt_version: TOPIK_AI_PROMPT_VERSION,
      content: explanation.similarQuestion,
      review_status: "draft",
    });
    return NextResponse.json({ ok: true, provider: "gemini", model: TOPIK_AI_MODEL, usage, explanation });
  } catch (error: unknown) {
    console.error("TOPIK MASTER EXPLAIN ERROR:", error);
    return NextResponse.json({ ok: true, provider: "fixed", explanation: fallback, warning: "AI tạm thời không khả dụng; đang dùng giải thích đã kiểm duyệt." });
  }
}
