import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import { aiUsageSnapshot, createAiCacheKey, runAiWithRetry, TOPIK_AI_DAILY_LIMIT, TOPIK_AI_MODEL, TOPIK_AI_PROMPT_VERSION } from "@/utils/topik-master/ai";
import type { GrammarComparison } from "@/utils/topik-master/types";

const schema = { type: "object", properties: {
  title: { type: "string" }, overview: { type: "string" },
  items: { type: "array", items: { type: "object", properties: { pattern: { type: "string" }, meaning: { type: "string" }, nuance: { type: "string" }, whenToUse: { type: "string" }, exampleKo: { type: "string" }, exampleVi: { type: "string" } }, required: ["pattern", "meaning", "nuance", "whenToUse", "exampleKo", "exampleVi"] } },
  keyDifferences: { type: "array", items: { type: "string" } }, memoryTip: { type: "string" },
}, required: ["title", "overview", "items", "keyDifferences", "memoryTip"] };

export async function POST(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const ids = Array.isArray(body.grammarIds) ? body.grammarIds.filter((id): id is string => typeof id === "string").slice(0, 4) : [];
  if (ids.length < 2) return NextResponse.json({ ok: false, error: "Hãy chọn từ 2 đến 4 mẫu ngữ pháp." }, { status: 400 });
  const grammar = await context.supabase.from("topik_master_grammar").select("id,pattern,meaning_vi,usage_vi,examples,topik_level,difficulty").in("id", ids);
  if (grammar.error || (grammar.data || []).length < 2) return NextResponse.json({ ok: false, error: "Không tìm đủ mẫu ngữ pháp để so sánh." }, { status: 404 });
  const rows = grammar.data || [];
  const fallback: GrammarComparison = { title: `So sánh ${rows.map((row) => row.pattern).join(" · ")}`,
    overview: "Bảng dưới đây dựa trên nghĩa, cách dùng và ví dụ đã có trong kho ngữ pháp.",
    items: rows.map((row) => { const example = Array.isArray(row.examples) && row.examples[0] && typeof row.examples[0] === "object" ? row.examples[0] as { ko?: string; vi?: string } : {}; return { pattern: row.pattern, meaning: row.meaning_vi, nuance: row.usage_vi || row.meaning_vi, whenToUse: row.usage_vi || "Dùng theo ngữ cảnh và điều kiện gắn kết của mẫu câu.", exampleKo: example.ko || "예문을 준비하고 있습니다.", exampleVi: example.vi || "Ví dụ đang được bổ sung." }; }),
    keyDifferences: rows.map((row) => `${row.pattern}: ${row.usage_vi || row.meaning_vi}`), memoryTip: "So sánh điều kiện nối câu, sắc thái nguyên nhân/đối lập và mức trang trọng trước khi chọn." };
  const cacheKey = createAiCacheKey([TOPIK_AI_PROMPT_VERSION, "grammar-compare", rows.map((row) => row.id).sort()]);
  const cached = await context.supabase.from("topik_master_ai_cache").select("payload,model").eq("user_id", context.user.id).eq("cache_key", cacheKey).maybeSingle();
  if (!cached.error && cached.data?.payload) return NextResponse.json({ ok: true, provider: "cache", comparison: cached.data.payload });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: true, provider: "database", comparison: fallback });
  const utcDayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const usageToday = await context.supabase.from("topik_master_ai_cache").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).gte("created_at", utcDayStart);
  if (!usageToday.error && (usageToday.count || 0) >= TOPIK_AI_DAILY_LIMIT) return NextResponse.json({ ok: true, provider: "database", comparison: fallback, warning: "Đã đạt quota AI hôm nay." });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await runAiWithRetry(() => ai.interactions.create({ model: TOPIK_AI_MODEL, store: false,
      input: `Bạn là giáo viên ngữ pháp tiếng Hàn cho người Việt. So sánh chính xác các mẫu sau dựa duy nhất trên dữ liệu kho học: ${JSON.stringify(rows)}. Nêu sắc thái, lúc dùng, ví dụ tự tạo ngắn, điểm khác nhau và mẹo nhớ. Không bịa quy tắc nếu dữ liệu không đủ.`,
      response_format: { type: "text", mime_type: "application/json", schema } }), 1);
    if (!interaction.output_text) throw new Error("Empty AI response");
    const comparison = JSON.parse(interaction.output_text) as GrammarComparison;
    const usage = aiUsageSnapshot(interaction.usage);
    await context.supabase.from("topik_master_ai_cache").upsert({ user_id: context.user.id, cache_key: cacheKey, kind: "grammar-compare", source_key: rows.map((row) => row.pattern).join("|"), source_version: 1,
      model: TOPIK_AI_MODEL, prompt_version: TOPIK_AI_PROMPT_VERSION, payload: comparison, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, thought_tokens: usage.thoughtTokens, estimated_cost_usd: usage.estimatedCostUsd }, { onConflict: "user_id,cache_key" });
    return NextResponse.json({ ok: true, provider: "gemini", comparison });
  } catch {
    return NextResponse.json({ ok: true, provider: "database", comparison: fallback, warning: "AI tạm thời không khả dụng." });
  }
}
