import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import { aiUsageSnapshot, createAiCacheKey, runAiWithRetry, TOPIK_AI_DAILY_LIMIT, TOPIK_AI_MODEL, TOPIK_AI_PROMPT_VERSION } from "@/utils/topik-master/ai";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const sentence = typeof body.sentence === "string" ? body.sentence.normalize("NFC").trim().slice(0, 800) : "";
  if (!uuidPattern.test(questionId) || !sentence) return NextResponse.json({ ok: false, error: "Câu Reading không hợp lệ." }, { status: 400 });
  const [question, vocabulary, grammar] = await Promise.all([
    context.supabase.from("topik_master_questions").select("translation_vi,explanation_vi").eq("id", questionId).maybeSingle(),
    context.supabase.from("topik_master_question_vocabulary").select("topik_master_vocabulary(id,lemma,meaning_vi,part_of_speech,topik_level)").eq("question_id", questionId),
    context.supabase.from("topik_master_question_grammar").select("topik_master_grammar(id,pattern,meaning_vi,usage_vi,topik_level)").eq("question_id", questionId),
  ]);
  if (question.error || vocabulary.error || grammar.error) return NextResponse.json({ ok: false, error: "Không thể phân tích đoạn Reading." }, { status: 503 });
  const tokens = sentence.match(/[가-힣]+|[A-Za-z]+|\d+/g) || [];
  const linkedVocabulary = (vocabulary.data || []).map((row) => row.topik_master_vocabulary);
  const linkedGrammar = (grammar.data || []).map((row) => row.topik_master_grammar);
  const analysis = { sentence, translationVi: question.data?.translation_vi || "Bản dịch chi tiết chưa được gắn cho câu này.",
    structure: `Câu có ${tokens.length} đơn vị; hãy xác định chủ ngữ/chủ đề, vị ngữ cuối câu và các đuôi nối trước.`, tokens,
    vocabulary: linkedVocabulary, grammar: linkedGrammar, topikTip: question.data?.explanation_vi || "Gạch từ nối và động từ cuối câu trước khi dịch từng từ." };
  await context.supabase.from("topik_master_learning_events").insert({ user_id: context.user.id, question_key: `reading-analysis:${questionId}`, skill: "reading", subskill: "passage-analysis", correct: true,
    context: { activityType: "reading_analysis", contentId: questionId, sentence } });
  if (question.data?.translation_vi) return NextResponse.json({ ok: true, provider: "database", analysis });
  const cacheKey = createAiCacheKey([TOPIK_AI_PROMPT_VERSION, "reading-analysis", questionId, sentence]);
  const cached = await context.supabase.from("topik_master_ai_cache").select("payload").eq("user_id", context.user.id).eq("cache_key", cacheKey).maybeSingle();
  if (!cached.error && cached.data?.payload) return NextResponse.json({ ok: true, provider: "cache", analysis: { ...analysis, ...(cached.data.payload as object) } });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: true, provider: "database", analysis });
  const usageToday = await context.supabase.from("topik_master_ai_cache").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).gte("created_at", `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (!usageToday.error && (usageToday.count || 0) >= TOPIK_AI_DAILY_LIMIT) return NextResponse.json({ ok: true, provider: "database", analysis });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await runAiWithRetry(() => ai.interactions.create({ model: TOPIK_AI_MODEL, store: false,
      input: `Phân tích đúng một câu Reading TOPIK cho người Việt. CÂU: ${sentence}\nTỪ LIÊN KẾT: ${JSON.stringify(linkedVocabulary)}\nNGỮ PHÁP LIÊN KẾT: ${JSON.stringify(linkedGrammar)}\nDịch tự nhiên sang tiếng Việt và mô tả cấu trúc câu ngắn gọn. Không bịa ngữ cảnh.`,
      response_format: { type: "text", mime_type: "application/json", schema: { type: "object", properties: { translationVi: { type: "string" }, structure: { type: "string" } }, required: ["translationVi", "structure"] } } }), 1);
    if (!interaction.output_text) throw new Error("Empty AI response");
    const enriched = JSON.parse(interaction.output_text) as { translationVi: string; structure: string };
    const usage = aiUsageSnapshot(interaction.usage);
    await context.supabase.from("topik_master_ai_cache").upsert({ user_id: context.user.id, cache_key: cacheKey, kind: "reading-analysis", source_key: questionId, source_version: 1, model: TOPIK_AI_MODEL,
      prompt_version: TOPIK_AI_PROMPT_VERSION, payload: enriched, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, thought_tokens: usage.thoughtTokens, estimated_cost_usd: usage.estimatedCostUsd }, { onConflict: "user_id,cache_key" });
    return NextResponse.json({ ok: true, provider: "gemini", analysis: { ...analysis, ...enriched } });
  } catch { return NextResponse.json({ ok: true, provider: "database", analysis }); }
}
