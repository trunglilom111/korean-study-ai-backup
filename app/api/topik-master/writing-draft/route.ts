import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import { deterministicWritingMetrics } from "@/utils/topik-master/ai";

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const promptKey = new URL(request.url).searchParams.get("promptKey") || "writing-54-environment";
  const draft = await context.supabase
    .from("topik_master_writing_submissions")
    .select("id,response_text,updated_at")
    .eq("user_id", context.user.id)
    .eq("prompt_key", promptKey)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (draft.error) return NextResponse.json({ ok: false, error: "Writing storage chưa sẵn sàng." }, { status: 503 });
  return NextResponse.json({ ok: true, draft: draft.data || null });
}

export async function PUT(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const promptKey = typeof body.promptKey === "string" ? body.promptKey.trim() : "writing-54-environment";
  const promptText = typeof body.promptText === "string" ? body.promptText.normalize("NFC").trim() : "";
  const responseText = typeof body.responseText === "string" ? body.responseText.normalize("NFC") : "";
  if (!promptText || responseText.length > 5000) return NextResponse.json({ ok: false, error: "Bản nháp không hợp lệ." }, { status: 400 });
  const metrics = deterministicWritingMetrics(responseText);
  const existing = await context.supabase
    .from("topik_master_writing_submissions")
    .select("id")
    .eq("user_id", context.user.id)
    .eq("prompt_key", promptKey)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ ok: false, error: "Writing storage chưa sẵn sàng." }, { status: 503 });
  const values = {
    prompt_text: promptText,
    response_text: responseText,
    character_count: metrics.characterCount,
    deterministic_metrics: metrics,
    updated_at: new Date().toISOString(),
  };
  const saved = existing.data
    ? await context.supabase.from("topik_master_writing_submissions").update(values).eq("id", existing.data.id).eq("user_id", context.user.id)
    : await context.supabase.from("topik_master_writing_submissions").insert({ ...values, user_id: context.user.id, prompt_key: promptKey, status: "draft" });
  if (saved.error) return NextResponse.json({ ok: false, error: "Không thể lưu bản nháp." }, { status: 500 });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString(), metrics });
}
