import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";
import { isTopikMasterOwner } from "@/utils/topik-master/access";

type Resource = "questions" | "vocabulary" | "grammar" | "exams";
const resources = new Set<Resource>(["questions", "vocabulary", "grammar", "exams"]);
type QuestionCatalogRow = {
  id: string; external_key: string; exam_type: string; skill: string; subskill: string; question_type: string;
  prompt: string; passage: string | null; options: unknown; correct_answer_index: number | null;
  source_kind: string; question_number?: number | null; transcript?: string | null; explanation_ko?: string;
  tags?: string[]; exam_year?: number | null; exam_round?: string | null; source_url?: string | null;
  rights_status?: string; [key: string]: unknown;
};

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

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
  const search = (url.searchParams.get("search") || "").trim().slice(0, 80).replace(/[%_,().]/g, "");
  const supabase = await createClient(request);

  if (resource === "questions") {
    let query = supabase
      .from("topik_master_questions")
      .select("id,external_key,version,exam_type,skill,subskill,question_number,question_type,prompt,passage,audio_url,transcript,translation_vi,audio_duration_seconds,audio_speakers,audio_speed,options,correct_answer_index,explanation_vi,explanation_ko,difficulty,tags,exam_year,exam_round,status,source_kind,source_ref,source_url,license_note,rights_status,metadata", { count: "exact" })
      .order("difficulty")
      .order("question_number", { nullsFirst: false })
      .order("external_key")
      .range(offset, offset + limit - 1);
    const status = url.searchParams.get("status") || "published";
    const skill = url.searchParams.get("skill") || url.searchParams.get("section");
    const examType = url.searchParams.get("examType");
    const subskill = url.searchParams.get("subskill");
    const questionType = url.searchParams.get("questionType");
    const difficulty = Number(url.searchParams.get("difficulty") || 0);
    const examYear = Number(url.searchParams.get("examYear") || 0);
    const examRound = url.searchParams.get("examRound");
    const tag = (url.searchParams.get("tag") || "").trim().slice(0, 80);
    if (["draft", "review", "published", "archived"].includes(status)) query = query.eq("status", status);
    else return NextResponse.json({ ok: false, error: "Trạng thái câu hỏi không hợp lệ." }, { status: 400 });
    if (skill) query = query.eq("skill", skill);
    if (examType) query = query.eq("exam_type", examType);
    if (subskill) query = query.eq("subskill", subskill);
    if (questionType) query = query.eq("question_type", questionType);
    if (difficulty >= 1 && difficulty <= 5) query = query.eq("difficulty", difficulty);
    if (examYear >= 1997 && examYear <= 2100) query = query.eq("exam_year", examYear);
    if (examRound) query = query.eq("exam_round", examRound);
    if (tag) query = query.contains("tags", [tag]);
    if (search) query = query.or(`prompt.ilike.%${search}%,passage.ilike.%${search}%,transcript.ilike.%${search}%`);

    let result: { data: unknown[] | null; error: unknown; count?: number | null } = await query;
    let legacySchema = false;
    if (result.error) {
      legacySchema = true;
      let legacyQuery = supabase
        .from("topik_master_questions")
        .select("id,external_key,version,exam_type,skill,subskill,question_type,prompt,passage,audio_url,options,correct_answer_index,explanation_vi,difficulty,status,source_kind,source_ref,license_note,metadata", { count: "exact" })
        .eq("status", status)
        .order("difficulty")
        .order("external_key")
        .range(offset, offset + limit - 1);
      if (skill) legacyQuery = legacyQuery.eq("skill", skill);
      if (examType) legacyQuery = legacyQuery.eq("exam_type", examType);
      if (subskill) legacyQuery = legacyQuery.eq("subskill", subskill);
      if (questionType) legacyQuery = legacyQuery.eq("question_type", questionType);
      if (difficulty >= 1 && difficulty <= 5) legacyQuery = legacyQuery.eq("difficulty", difficulty);
      if (search) legacyQuery = legacyQuery.or(`prompt.ilike.%${search}%,passage.ilike.%${search}%`);
      result = await legacyQuery;
    }
    if (result.error) return responseFor(resource, result);
    const rows = (result.data || []) as QuestionCatalogRow[];
    const questionIds = rows.map((row) => row.id);
    const [vocabularyResult, grammarResult] = questionIds.length ? await Promise.all([
      supabase.from("topik_master_question_vocabulary").select("question_id,relevance,topik_master_vocabulary(id,lemma,meaning_vi,topik_level)").in("question_id", questionIds),
      supabase.from("topik_master_question_grammar").select("question_id,relevance,topik_master_grammar(id,pattern,meaning_vi,topik_level)").in("question_id", questionIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (vocabularyResult.error || grammarResult.error) {
      return NextResponse.json({ ok: false, error: "Không thể tải liên kết từ vựng/ngữ pháp của câu hỏi." }, { status: 503 });
    }
    const vocabularyByQuestion = new Map<string, unknown[]>();
    (vocabularyResult.data || []).forEach((link) => vocabularyByQuestion.set(link.question_id, [...(vocabularyByQuestion.get(link.question_id) || []), link.topik_master_vocabulary]));
    const grammarByQuestion = new Map<string, unknown[]>();
    (grammarResult.data || []).forEach((link) => grammarByQuestion.set(link.question_id, [...(grammarByQuestion.get(link.question_id) || []), link.topik_master_grammar]));
    const data = rows.map((row) => {
      const options = stringArray(row.options);
      return {
        ...row,
        question_id: row.external_key,
        section: row.skill,
        question_text: row.prompt,
        question_number: row.question_number ?? (Number(row.external_key.match(/(\d+)$/)?.[1] || 0) || null),
        transcript: row.transcript ?? null,
        explanation_ko: row.explanation_ko ?? "",
        tags: row.tags ?? [row.exam_type, row.skill, row.subskill, row.question_type],
        exam_year: row.exam_year ?? null,
        exam_round: row.exam_round ?? null,
        source_url: row.source_url ?? null,
        rights_status: row.rights_status ?? (row.source_kind === "original" ? "original" : "permission-required"),
        correct_answer: row.correct_answer_index == null ? null : options[row.correct_answer_index] ?? null,
        vocabulary: vocabularyByQuestion.get(row.id) || [],
        grammar: grammarByQuestion.get(row.id) || [],
      };
    });
    return NextResponse.json({ ok: true, resource, count: data.length, total: result.count ?? data.length, schemaVersion: legacySchema ? "legacy" : "question-bank-v1", data });
  }

  if (resource === "exams") {
    let query = supabase
      .from("topik_master_exams")
      .select("id,external_key,title,exam_type,description,duration_minutes,test_format,exam_year,exam_round,tags,section_counts,source_url,rights_status,metadata", { count: "exact" })
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    const examType = url.searchParams.get("examType");
    if (examType) query = query.eq("exam_type", examType);
    const result = await query;
    if (!result.error) return responseFor(resource, result);
    let legacyQuery = supabase
      .from("topik_master_exams")
      .select("id,external_key,title,exam_type,description,duration_minutes,metadata", { count: "exact" })
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (examType) legacyQuery = legacyQuery.eq("exam_type", examType);
    return responseFor(resource, await legacyQuery);
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
