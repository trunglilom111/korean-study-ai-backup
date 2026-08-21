import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import { aiUsageSnapshot, createAiCacheKey, deterministicWritingMetrics, runAiWithRetry, TOPIK_AI_DAILY_LIMIT, TOPIK_AI_MODEL, TOPIK_AI_PROMPT_VERSION } from "@/utils/topik-master/ai";
import type { WritingFeedback } from "@/utils/topik-master/types";

const feedbackSchema = {
  type: "object",
  properties: {
    score: { type: "integer" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    grammarCorrections: {
      type: "array",
      items: {
        type: "object",
        properties: { original: { type: "string" }, corrected: { type: "string" }, explanation: { type: "string" } },
        required: ["original", "corrected", "explanation"],
      },
    },
    vocabularySuggestions: { type: "array", items: { type: "string" } },
    structureFeedback: { type: "string" },
    revisedSample: { type: "string" },
  },
  required: ["score", "summary", "strengths", "improvements", "grammarCorrections", "vocabularySuggestions", "structureFeedback", "revisedSample"],
};

export async function POST(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const promptKey = typeof body.promptKey === "string" ? body.promptKey.trim() : "writing-54-environment";
  const promptText = typeof body.promptText === "string" ? body.promptText.normalize("NFC").trim() : "";
  const responseText = typeof body.responseText === "string" ? body.responseText.normalize("NFC").trim() : "";
  if (!promptText || responseText.length < 30) return NextResponse.json({ ok: false, error: "Bài viết cần ít nhất 30 ký tự để phân tích." }, { status: 400 });
  if (responseText.length > 5000) return NextResponse.json({ ok: false, error: "Bài viết tối đa 5.000 ký tự." }, { status: 400 });

  const metrics = deterministicWritingMetrics(responseText);
  const fallback: WritingFeedback = {
    score: Math.min(100, Math.round(metrics.lexicalDiversity * 0.35 + Math.min(metrics.koreanCharacters / 6, 50) + Math.min(metrics.connectorCount * 5, 15))),
    summary: "Đã chấm các chỉ số hình thức. Hãy bật Gemini để nhận nhận xét ngữ pháp và nội dung sâu hơn.",
    strengths: [metrics.paragraphCount >= 2 ? "Bài có chia đoạn." : "Bài đã có nội dung tiếng Hàn để đánh giá.", metrics.connectorCount > 0 ? "Đã dùng từ nối." : "Đã bám vào chủ đề."],
    improvements: [metrics.koreanCharacters < 300 ? "Cần phát triển bài dài và đầy đủ luận điểm hơn." : "Cần kiểm tra tính liên kết giữa các luận điểm.", metrics.connectorCount < 2 ? "Nên dùng thêm từ nối học thuật." : "Tránh lặp lại cùng một từ nối."],
    grammarCorrections: [],
    vocabularySuggestions: ["실천하다", "일회용품", "환경 보호", "지속 가능하다"],
    structureFeedback: metrics.paragraphCount >= 3 ? "Đã có cấu trúc nhiều đoạn; hãy đảm bảo mở–thân–kết rõ." : "Nên tổ chức thành mở bài, thân bài và kết luận.",
    revisedSample: responseText,
    deterministicMetrics: metrics,
  };
  const cacheKey = createAiCacheKey([TOPIK_AI_PROMPT_VERSION, promptKey, responseText]);
  const cached = await context.supabase.from("topik_master_ai_cache").select("payload,model").eq("user_id", context.user.id).eq("cache_key", cacheKey).maybeSingle();
  if (!cached.error && cached.data?.payload) return NextResponse.json({ ok: true, provider: "cache", model: cached.data.model, feedback: cached.data.payload });

  const submission = await context.supabase.from("topik_master_writing_submissions").insert({
    user_id: context.user.id,
    prompt_key: promptKey,
    prompt_text: promptText,
    response_text: responseText,
    character_count: metrics.characterCount,
    deterministic_metrics: metrics,
  }).select("id").maybeSingle();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (submission.data) await context.supabase.from("topik_master_writing_feedback").insert({ submission_id: submission.data.id, user_id: context.user.id, provider: "deterministic", prompt_version: TOPIK_AI_PROMPT_VERSION, feedback: fallback });
    return NextResponse.json({ ok: true, provider: "deterministic", feedback: fallback, warning: "Gemini chưa được cấu hình." });
  }

  const utcDayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const dailyUsage = await context.supabase.from("topik_master_ai_cache").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).gte("created_at", utcDayStart);
  if (!dailyUsage.error && (dailyUsage.count || 0) >= TOPIK_AI_DAILY_LIMIT) {
    if (submission.data) await context.supabase.from("topik_master_writing_feedback").insert({ submission_id: submission.data.id, user_id: context.user.id, provider: "deterministic", prompt_version: TOPIK_AI_PROMPT_VERSION, feedback: fallback });
    return NextResponse.json({ ok: true, provider: "deterministic", feedback: fallback, warning: "Đã đạt quota AI hôm nay." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await runAiWithRetry(() => ai.interactions.create({
      model: TOPIK_AI_MODEL,
      input: `
Bạn là giám khảo và giáo viên TOPIK II Writing cho người Việt.

ĐỀ BÀI:
${promptText}

BÀI LÀM:
${responseText}

CHỈ SỐ DETERMINISTIC:
${JSON.stringify(metrics)}

Hãy phản hồi bằng tiếng Việt theo rubric nội dung, cấu trúc, ngữ pháp và từ vựng.
- score từ 0 đến 100.
- Không sửa những chỗ vốn đã đúng.
- grammarCorrections tối đa 8 lỗi thật sự, trích đoạn ngắn.
- revisedSample là bản cải thiện cùng ý của người học, không biến thành bài hoàn toàn khác.
- Không tuyên bố đây là điểm TOPIK chính thức.
`,
      store: false,
      response_format: { type: "text", mime_type: "application/json", schema: feedbackSchema },
    }), 1);
    if (!interaction.output_text) throw new Error("Gemini không trả dữ liệu.");
    const aiFeedback = JSON.parse(interaction.output_text) as Omit<WritingFeedback, "deterministicMetrics">;
    const feedback: WritingFeedback = { ...aiFeedback, score: Math.min(100, Math.max(0, Math.round(aiFeedback.score))), deterministicMetrics: metrics };
    const usage = aiUsageSnapshot(interaction.usage);
    await context.supabase.from("topik_master_ai_cache").upsert({
      user_id: context.user.id,
      cache_key: cacheKey,
      kind: "writing-feedback",
      source_key: promptKey,
      source_version: 1,
      model: TOPIK_AI_MODEL,
      prompt_version: TOPIK_AI_PROMPT_VERSION,
      payload: feedback,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      thought_tokens: usage.thoughtTokens,
      estimated_cost_usd: usage.estimatedCostUsd,
    }, { onConflict: "user_id,cache_key" });
    if (submission.data) {
      await context.supabase.from("topik_master_writing_feedback").insert({ submission_id: submission.data.id, user_id: context.user.id, provider: "gemini", model: TOPIK_AI_MODEL, prompt_version: TOPIK_AI_PROMPT_VERSION, feedback, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, thought_tokens: usage.thoughtTokens, estimated_cost_usd: usage.estimatedCostUsd });
      await context.supabase.from("topik_master_writing_submissions").update({ status: "reviewed", updated_at: new Date().toISOString() }).eq("id", submission.data.id);
    }
    return NextResponse.json({ ok: true, provider: "gemini", model: TOPIK_AI_MODEL, usage, feedback });
  } catch (error: unknown) {
    console.error("TOPIK MASTER WRITING ERROR:", error);
    if (submission.data) await context.supabase.from("topik_master_writing_feedback").insert({ submission_id: submission.data.id, user_id: context.user.id, provider: "deterministic", prompt_version: TOPIK_AI_PROMPT_VERSION, feedback: fallback });
    return NextResponse.json({ ok: true, provider: "deterministic", feedback: fallback, warning: "AI tạm thời không khả dụng." });
  }
}
