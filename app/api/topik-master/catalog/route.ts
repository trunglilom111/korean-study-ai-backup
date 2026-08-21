import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";
import { isTopikMasterOwner } from "@/utils/topik-master/access";

type Resource = "questions" | "vocabulary" | "grammar" | "exams";
const resources = new Set<Resource>(["questions", "vocabulary", "grammar", "exams"]);

function responseFor(resource: Resource, result: { data: unknown[] | null; error: unknown; count?: number | null }) {
  if (result.error) {
    return NextResponse.json(
      { ok: false, error: "Learning Data schema chưa được apply hoặc truy vấn không thành công." },
      { status: 503 }
    );
  }
  const data = result.data || [];
  return NextResponse.json({ ok: true, resource, count: data.length, total: result.count ?? data.length, data });
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Bạn cần đăng nhập." }, { status: 401 });
  if (!isTopikMasterOwner(user.email)) {
    return NextResponse.json({ ok: false, error: "Tài khoản này không có quyền dùng TOPIK Master." }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedResource = url.searchParams.get("resource") || "questions";
  if (!resources.has(requestedResource as Resource)) {
    return NextResponse.json({ ok: false, error: "Catalog resource không hợp lệ." }, { status: 400 });
  }

  const resource = requestedResource as Resource;
  const requestedLimit = Number(url.searchParams.get("limit") || 30);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 30;
  const requestedOffset = Number(url.searchParams.get("offset") || 0);
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;
  const search = (url.searchParams.get("search") || "").trim().slice(0, 80).replace(/[%_]/g, "");
  const supabase = await createClient(request);

  if (resource === "questions") {
    let query = supabase
      .from("topik_master_questions")
      .select("id,external_key,version,exam_type,skill,subskill,question_type,prompt,passage,audio_url,options,difficulty,metadata")
      .eq("status", "published")
      .order("difficulty")
      .order("external_key")
      .limit(limit);
    const skill = url.searchParams.get("skill");
    const examType = url.searchParams.get("examType");
    const subskill = url.searchParams.get("subskill");
    if (skill) query = query.eq("skill", skill);
    if (examType) query = query.eq("exam_type", examType);
    if (subskill) query = query.eq("subskill", subskill);
    return responseFor(resource, await query);
  }

  if (resource === "exams") {
    let query = supabase
      .from("topik_master_exams")
      .select("id,external_key,title,exam_type,description,duration_minutes,metadata")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(limit);
    const examType = url.searchParams.get("examType");
    if (examType) query = query.eq("exam_type", examType);
    return responseFor(resource, await query);
  }

  const topikLevel = url.searchParams.get("topikLevel");
  if (resource === "vocabulary") {
    let query = supabase
      .from("topik_master_vocabulary")
      .select("id,lemma,part_of_speech,hanja,meaning_vi,explanation_ko,nikl_level,topik_level,frequency_rank,frequency_score,metadata", { count: "exact" })
      .order("frequency_score", { ascending: false })
      .order("lemma")
      .range(offset, offset + limit - 1);
    if (topikLevel === "unclassified") query = query.is("topik_level", null);
    else if (topikLevel) query = query.eq("topik_level", topikLevel);
    if (search) query = query.ilike("lemma", `%${search}%`);
    return responseFor(resource, await query);
  }

  let query = supabase
    .from("topik_master_grammar")
    .select("id,pattern,meaning_vi,usage_vi,topik_level,difficulty,examples,metadata", { count: "exact" })
    .order("difficulty")
    .order("pattern")
    .range(offset, offset + limit - 1);
  if (topikLevel === "unclassified") query = query.is("topik_level", null);
  else if (topikLevel) query = query.eq("topik_level", topikLevel);
  if (search) query = query.ilike("pattern", `%${search}%`);
  return responseFor(resource, await query);
}
