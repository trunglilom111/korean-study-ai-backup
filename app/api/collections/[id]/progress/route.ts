import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";

import { isUuid } from "../../validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Mã bộ từ không hợp lệ." }, { status: 400 });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập để xem tiến độ." }, { status: 401 });
  }

  const supabase = await createClient(request);
  const { data: collection, error: collectionError } = await supabase
    .from("vocabulary_collections")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (collectionError) {
    return NextResponse.json({ error: "Không thể tải tiến độ bộ từ." }, { status: 500 });
  }
  if (!collection) {
    return NextResponse.json({ error: "Không tìm thấy bộ từ." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("vocabulary_collection_progress")
    .select("vocabulary_id,status,review_count,next_review_at,interval_days,difficulty")
    .eq("collection_id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Collection progress list API error:", error);
    return NextResponse.json({ error: "Không thể tải tiến độ bộ từ." }, { status: 500 });
  }

  return NextResponse.json({ progress: data || [] });
}
