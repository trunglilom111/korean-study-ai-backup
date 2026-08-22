import { NextResponse } from "next/server";
import { getTopikMasterContext } from "@/utils/topik-master/server";

function clean(value: string) { return value.trim().normalize("NFC").slice(0, 80).replace(/[%_,().]/g, ""); }

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const query = clean(new URL(request.url).searchParams.get("q") || "");
  if (query.length < 2) return NextResponse.json({ ok: false, error: "Nhập ít nhất 2 ký tự để tìm kiếm." }, { status: 400 });
  const [vocabulary, grammar, questions, mistakes, collections] = await Promise.all([
    context.supabase.from("topik_master_vocabulary").select("id,lemma,meaning_vi,part_of_speech,topik_level").or(`lemma.ilike.%${query}%,meaning_vi.ilike.%${query}%`).limit(20),
    context.supabase.from("topik_master_grammar").select("id,pattern,meaning_vi,usage_vi,topik_level").or(`pattern.ilike.%${query}%,meaning_vi.ilike.%${query}%,usage_vi.ilike.%${query}%`).limit(15),
    context.supabase.from("topik_master_questions").select("id,external_key,skill,question_number,prompt,passage,transcript").eq("status", "published").or(`prompt.ilike.%${query}%,passage.ilike.%${query}%,transcript.ilike.%${query}%`).limit(20),
    context.supabase.from("topik_mistakes").select("id,question_key,skill,prompt,selected_answer,correct_answer").eq("user_id", context.user.id).or(`prompt.ilike.%${query}%,selected_answer.ilike.%${query}%,correct_answer.ilike.%${query}%`).limit(15),
    context.supabase.from("vocabulary_collections").select("id,title,description").eq("owner_id", context.user.id).or(`title.ilike.%${query}%,description.ilike.%${query}%`).limit(10),
  ]);
  return NextResponse.json({ ok: true, query, results: { vocabulary: vocabulary.data || [], grammar: grammar.data || [], questions: questions.data || [], mistakes: mistakes.data || [], collections: collections.data || [] } });
}
