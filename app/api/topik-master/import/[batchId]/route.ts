import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";

type Params = { params: Promise<{ batchId: string }> };

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function chunks<T>(items: T[], size = 100) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export async function GET(request: Request, contextParams: Params) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const { batchId } = await contextParams.params;
  const [batch, items] = await Promise.all([
    context.supabase.from("topik_master_import_batches").select("*").eq("id", batchId).eq("user_id", context.user.id).maybeSingle(),
    context.supabase.from("topik_master_import_items").select("id,ordinal,external_key,payload,validation_errors,duplicate_of,review_status,reviewer_note,reviewed_at").eq("batch_id", batchId).eq("user_id", context.user.id).order("ordinal"),
  ]);
  if (batch.error || items.error) return NextResponse.json({ ok: false, error: "Không thể tải import batch." }, { status: 503 });
  if (!batch.data) return NextResponse.json({ ok: false, error: "Không tìm thấy import batch." }, { status: 404 });
  return NextResponse.json({ ok: true, batch: batch.data, items: items.data || [] });
}

export async function PATCH(request: Request, contextParams: Params) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const { batchId } = await contextParams.params;
  const body = asObject(await request.json().catch(() => ({})));
  const action = typeof body.action === "string" ? body.action : "";
  const batch = await context.supabase.from("topik_master_import_batches").select("id,entity_type,source_name,source_url,license_note,status,total_count,valid_count,duplicate_count").eq("id", batchId).eq("user_id", context.user.id).maybeSingle();
  if (batch.error || !batch.data) return NextResponse.json({ ok: false, error: "Không tìm thấy import batch." }, { status: 404 });
  const batchData = batch.data;
  if (["committed", "rejected"].includes(batchData.status)) return NextResponse.json({ ok: false, error: "Batch này đã đóng." }, { status: 409 });

  if (action === "approve-all") {
    if (batchData.valid_count !== batchData.total_count || batchData.duplicate_count > 0) {
      return NextResponse.json({ ok: false, error: "Chỉ có thể duyệt hàng loạt batch hợp lệ và không trùng." }, { status: 409 });
    }
    const reviewedAt = new Date().toISOString();
    const approved = await context.supabase.from("topik_master_import_items").update({
      review_status: "approved",
      reviewer_note: "Auto-approved after local validation and owner confirmation.",
      reviewed_at: reviewedAt,
    }).eq("batch_id", batchId).eq("user_id", context.user.id).eq("review_status", "pending");
    if (approved.error) return NextResponse.json({ ok: false, error: "Không thể duyệt batch hợp lệ." }, { status: 500 });
    const updated = await context.supabase.from("topik_master_import_batches").update({
      approved_count: batchData.total_count,
      status: "ready",
      updated_at: reviewedAt,
    }).eq("id", batchId).eq("user_id", context.user.id);
    if (updated.error) return NextResponse.json({ ok: false, error: "Không thể cập nhật trạng thái batch." }, { status: 500 });
    return NextResponse.json({ ok: true, approvedCount: batchData.total_count, status: "ready" });
  }

  if (action === "review") {
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const reviewStatus = body.reviewStatus === "approved" || body.reviewStatus === "rejected" ? body.reviewStatus : "";
    const reviewerNote = typeof body.reviewerNote === "string" ? body.reviewerNote.normalize("NFC").trim().slice(0, 1000) : "";
    if (!itemId || !reviewStatus) return NextResponse.json({ ok: false, error: "Review action không hợp lệ." }, { status: 400 });
    const item = await context.supabase.from("topik_master_import_items").select("validation_errors").eq("id", itemId).eq("batch_id", batchId).eq("user_id", context.user.id).maybeSingle();
    if (item.error || !item.data) return NextResponse.json({ ok: false, error: "Không tìm thấy item." }, { status: 404 });
    if (reviewStatus === "approved" && Array.isArray(item.data.validation_errors) && item.data.validation_errors.length) {
      return NextResponse.json({ ok: false, error: "Không thể duyệt item còn lỗi validation." }, { status: 409 });
    }
    const updated = await context.supabase.from("topik_master_import_items").update({ review_status: reviewStatus, reviewer_note: reviewerNote, reviewed_at: new Date().toISOString() }).eq("id", itemId).eq("batch_id", batchId).eq("user_id", context.user.id);
    if (updated.error) return NextResponse.json({ ok: false, error: "Không thể lưu review." }, { status: 500 });
    const approved = await context.supabase.from("topik_master_import_items").select("id", { count: "exact", head: true }).eq("batch_id", batchId).eq("user_id", context.user.id).eq("review_status", "approved");
    await context.supabase.from("topik_master_import_batches").update({ approved_count: approved.count || 0, status: "review", updated_at: new Date().toISOString() }).eq("id", batchId).eq("user_id", context.user.id);
    return NextResponse.json({ ok: true, approvedCount: approved.count || 0 });
  }

  if (action !== "commit") return NextResponse.json({ ok: false, error: "Action không hợp lệ." }, { status: 400 });
  const approvedItems = await context.supabase.from("topik_master_import_items").select("payload").eq("batch_id", batchId).eq("user_id", context.user.id).eq("review_status", "approved").order("ordinal");
  if (approvedItems.error || !approvedItems.data?.length) return NextResponse.json({ ok: false, error: "Batch chưa có item đã duyệt để commit." }, { status: 409 });
  const sourceKey = `import:${batchId}`;
  const sourceRef = batchData.source_url || batchData.source_name;
  const now = new Date().toISOString();
  let committed;

  if (batchData.entity_type === "vocabulary") {
    committed = await context.supabase.from("topik_master_vocabulary").upsert(approvedItems.data.map(({ payload }) => ({
      lemma: payload.lemma, normalized_lemma: payload.normalizedLemma, part_of_speech: payload.partOfSpeech, hanja: payload.hanja,
      source_target_code: payload.targetCode || "", homonym_number: payload.homonymNumber,
      meaning_vi: payload.meaningVi, explanation_ko: payload.explanationKo, nikl_level: payload.niklLevel, topik_level: payload.topikLevel,
      frequency_rank: payload.frequencyRank, frequency_score: payload.frequencyScore, source_key: sourceKey, source_url: batchData.source_url,
      license_note: batchData.license_note, metadata: payload.metadata, updated_at: now,
    })), { onConflict: "normalized_lemma,part_of_speech,homonym_number,source_target_code", ignoreDuplicates: false });
  } else if (batchData.entity_type === "grammar") {
    committed = await context.supabase.from("topik_master_grammar").upsert(approvedItems.data.map(({ payload }) => ({
      pattern: payload.pattern, meaning_vi: payload.meaningVi, usage_vi: payload.usageVi, topik_level: payload.topikLevel,
      difficulty: payload.difficulty, examples: payload.examples, source_key: sourceKey, source_url: batchData.source_url,
      license_note: batchData.license_note, metadata: payload.metadata, updated_at: now,
    })), { onConflict: "pattern", ignoreDuplicates: false });
  } else {
    committed = await context.supabase.from("topik_master_questions").upsert(approvedItems.data.map(({ payload }) => ({
      external_key: payload.externalKey, version: payload.version, exam_type: payload.examType, skill: payload.skill, subskill: payload.subskill,
      question_number: payload.questionNumber, question_type: payload.questionType, prompt: payload.prompt, passage: payload.passage,
      audio_url: payload.audioUrl, transcript: payload.transcript, options: payload.options, correct_answer_index: payload.correctAnswerIndex,
      explanation_vi: payload.explanationVi, explanation_ko: payload.explanationKo, difficulty: payload.difficulty, tags: payload.tags,
      exam_year: payload.examYear, exam_round: payload.examRound, status: "draft", source_kind: payload.sourceKind,
      source_ref: sourceRef, source_url: batchData.source_url, license_note: batchData.license_note, rights_status: payload.rightsStatus,
      metadata: payload.metadata, updated_at: now,
    })), { onConflict: "external_key", ignoreDuplicates: false });
  }
  if (committed.error) return NextResponse.json({ ok: false, error: "Commit catalog thất bại; batch vẫn ở trạng thái review." }, { status: 500 });

  let linkedVocabulary = 0;
  let linkedGrammar = 0;
  const unresolvedVocabulary = new Set<string>();
  const unresolvedGrammar = new Set<string>();
  if (batchData.entity_type === "question") {
    const questionPayloads = approvedItems.data.map(({ payload }) => payload);
    const externalKeys = [...new Set(questionPayloads.map((payload) => String(payload.externalKey || "")).filter(Boolean))];
    const vocabularyRefs = [...new Set(questionPayloads.flatMap((payload) => stringArray(payload.vocabulary)).map((item) => item.normalize("NFC").trim().toLocaleLowerCase("ko-KR")))];
    const grammarRefs = [...new Set(questionPayloads.flatMap((payload) => stringArray(payload.grammar)).map((item) => item.normalize("NFC").trim()))];
    const questionRows: Array<{ id: string; external_key: string }> = [];
    const vocabularyRows: Array<{ id: string; normalized_lemma: string }> = [];
    const grammarRows: Array<{ id: string; pattern: string }> = [];

    for (const group of chunks(externalKeys)) {
      const result = await context.supabase.from("topik_master_questions").select("id,external_key").in("external_key", group);
      if (!result.error) questionRows.push(...(result.data || []));
    }
    for (const group of chunks(vocabularyRefs)) {
      const result = await context.supabase.from("topik_master_vocabulary").select("id,normalized_lemma,frequency_score").in("normalized_lemma", group).order("frequency_score", { ascending: false });
      if (!result.error) vocabularyRows.push(...(result.data || []));
    }
    for (const group of chunks(grammarRefs)) {
      const result = await context.supabase.from("topik_master_grammar").select("id,pattern").in("pattern", group);
      if (!result.error) grammarRows.push(...(result.data || []));
    }

    const questionByKey = new Map(questionRows.map((row) => [row.external_key, row.id]));
    const vocabularyByLemma = new Map<string, string>();
    vocabularyRows.forEach((row) => { if (!vocabularyByLemma.has(row.normalized_lemma)) vocabularyByLemma.set(row.normalized_lemma, row.id); });
    const grammarByPattern = new Map(grammarRows.map((row) => [row.pattern, row.id]));
    const vocabularyLinks: Array<{ question_id: string; vocabulary_id: string; relevance: number }> = [];
    const grammarLinks: Array<{ question_id: string; grammar_id: string; relevance: number }> = [];

    questionPayloads.forEach((payload) => {
      const questionId = questionByKey.get(String(payload.externalKey || ""));
      if (!questionId) return;
      stringArray(payload.vocabulary).forEach((reference) => {
        const normalized = reference.normalize("NFC").trim().toLocaleLowerCase("ko-KR");
        const vocabularyId = vocabularyByLemma.get(normalized);
        if (vocabularyId) vocabularyLinks.push({ question_id: questionId, vocabulary_id: vocabularyId, relevance: 1 });
        else unresolvedVocabulary.add(reference);
      });
      stringArray(payload.grammar).forEach((reference) => {
        const grammarId = grammarByPattern.get(reference.normalize("NFC").trim());
        if (grammarId) grammarLinks.push({ question_id: questionId, grammar_id: grammarId, relevance: 1 });
        else unresolvedGrammar.add(reference);
      });
    });

    if (vocabularyLinks.length) {
      const linked = await context.supabase.from("topik_master_question_vocabulary").upsert(vocabularyLinks, { onConflict: "question_id,vocabulary_id", ignoreDuplicates: true });
      if (!linked.error) linkedVocabulary = vocabularyLinks.length;
    }
    if (grammarLinks.length) {
      const linked = await context.supabase.from("topik_master_question_grammar").upsert(grammarLinks, { onConflict: "question_id,grammar_id", ignoreDuplicates: true });
      if (!linked.error) linkedGrammar = grammarLinks.length;
    }
  }
  await context.supabase.from("topik_master_import_batches").update({ status: "committed", approved_count: approvedItems.data.length, committed_at: now, updated_at: now }).eq("id", batchId).eq("user_id", context.user.id);
  return NextResponse.json({
    ok: true,
    committed: approvedItems.data.length,
    publishState: "draft",
    links: {
      vocabulary: linkedVocabulary,
      grammar: linkedGrammar,
      unresolvedVocabulary: [...unresolvedVocabulary],
      unresolvedGrammar: [...unresolvedGrammar],
    },
  });
}
