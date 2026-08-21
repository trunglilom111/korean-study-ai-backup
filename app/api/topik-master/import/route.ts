import { NextResponse } from "next/server";
import { asObject, getTopikMasterContext } from "@/utils/topik-master/server";
import { validateImportBatch, type ImportEntityType } from "@/utils/topik-master/import-pipeline";

const entityTypes = new Set<ImportEntityType>(["vocabulary", "grammar", "question"]);

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const result = await context.supabase
    .from("topik_master_import_batches")
    .select("id,entity_type,source_name,source_url,license_note,status,total_count,valid_count,duplicate_count,approved_count,committed_at,created_at,updated_at")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (result.error) return NextResponse.json({ ok: false, error: "Import Pipeline chưa được bật bằng migration Giai đoạn 7." }, { status: 503 });
  return NextResponse.json({ ok: true, batches: result.data || [] });
}

export async function POST(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const entityType = typeof body.entityType === "string" ? body.entityType as ImportEntityType : "question";
  const sourceName = typeof body.sourceName === "string" ? body.sourceName.normalize("NFC").trim() : "";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const licenseNote = typeof body.licenseNote === "string" ? body.licenseNote.normalize("NFC").trim() : "";
  const items = Array.isArray(body.items) ? body.items : [];

  if (!entityTypes.has(entityType)) return NextResponse.json({ ok: false, error: "Loại dữ liệu import không hợp lệ." }, { status: 400 });
  if (sourceName.length < 2 || sourceName.length > 160) return NextResponse.json({ ok: false, error: "Tên nguồn cần từ 2 đến 160 ký tự." }, { status: 400 });
  if (licenseNote.length < 10 || licenseNote.length > 1000) return NextResponse.json({ ok: false, error: "Phải ghi rõ license/quyền sử dụng dữ liệu." }, { status: 400 });
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return NextResponse.json({ ok: false, error: "Source URL phải dùng HTTP hoặc HTTPS." }, { status: 400 });
  if (!items.length || items.length > 500) return NextResponse.json({ ok: false, error: "Mỗi batch cần từ 1 đến 500 bản ghi." }, { status: 400 });

  const validation = validateImportBatch(entityType, items);
  const batch = await context.supabase.from("topik_master_import_batches").insert({
    user_id: context.user.id,
    entity_type: entityType,
    source_name: sourceName,
    source_url: sourceUrl || null,
    license_note: licenseNote,
    status: validation.validCount === items.length ? "review" : "needs-fixes",
    total_count: items.length,
    valid_count: validation.validCount,
    duplicate_count: validation.duplicateCount,
  }).select("id,status").single();
  if (batch.error || !batch.data) return NextResponse.json({ ok: false, error: "Không thể tạo import batch." }, { status: 500 });

  const firstByHash = new Map<string, string>();
  const stagedRows = validation.validated.map((item, index) => {
    const duplicateOf = firstByHash.get(item.normalizedHash) || null;
    if (!duplicateOf) firstByHash.set(item.normalizedHash, item.externalKey);
    return {
      batch_id: batch.data.id,
      user_id: context.user.id,
      ordinal: index + 1,
      external_key: item.externalKey || `invalid-${index + 1}`,
      normalized_hash: item.normalizedHash,
      payload: item.payload,
      validation_errors: item.errors,
      duplicate_of: duplicateOf,
    };
  });
  const staged = await context.supabase.from("topik_master_import_items").insert(stagedRows);
  if (staged.error) {
    await context.supabase.from("topik_master_import_batches").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", batch.data.id).eq("user_id", context.user.id);
    return NextResponse.json({ ok: false, error: "Không thể lưu dữ liệu staging." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, batchId: batch.data.id, status: batch.data.status, summary: { total: items.length, valid: validation.validCount, duplicates: validation.duplicateCount, invalid: items.length - validation.validCount } }, { status: 201 });
}
