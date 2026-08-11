import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";
import { isUuid } from "../../../validation";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string; vocabularyId: string }>;
  }
) {
  const { id, vocabularyId } = await context.params;

  if (!isUuid(id) || !isUuid(vocabularyId)) {
    return NextResponse.json(
      { error: "Mã bộ từ hoặc mã từ vựng không hợp lệ." },
      { status: 400 }
    );
  }

  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để xóa từ khỏi bộ." },
      { status: 401 }
    );
  }

  const supabase = await createClient(request);
  const { data, error } = await supabase
    .from("vocabulary_collection_items")
    .delete()
    .eq("collection_id", id)
    .eq("vocabulary_id", vocabularyId)
    .select("collection_id,vocabulary_id")
    .maybeSingle();

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "Bạn không có quyền chỉnh sửa bộ từ này." },
        { status: 403 }
      );
    }

    console.error("Collection item delete error:", error);

    return NextResponse.json(
      { error: "Không thể xóa từ khỏi bộ lúc này." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Không tìm thấy từ trong bộ hoặc bạn không có quyền xóa." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    collectionId: id,
    vocabularyId,
  });
}
