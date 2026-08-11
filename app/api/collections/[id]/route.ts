import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";

import {
  isCollectionVisibility,
  isUuid,
  normalizeCollectionText,
  serializeCollection,
  serializeCollectionItem,
} from "../validation";

type CollectionRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  copied_from_id?: string | null;
};

type CollectionItemRow = {
  collection_id: string;
  vocabulary_id: string;
  position: number;
  personal_note: string | null;
  vocabulary_snapshot: unknown;
  created_at: string;
};

function invalidIdResponse(id: string) {
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "Mã bộ từ không hợp lệ." },
      { status: 400 }
    );
  }

  return null;
}

function databaseErrorResponse(error: {
  code?: string;
  message?: string;
}) {
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này." },
      { status: 403 }
    );
  }

  console.error("Collection detail API error:", error);

  return NextResponse.json(
    { error: "Không thể xử lý bộ từ lúc này." },
    { status: 500 }
  );
}

async function collectionIdFromParams(
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return id;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const id = await collectionIdFromParams(context);
  const invalidId = invalidIdResponse(id);

  if (invalidId) {
    return invalidId;
  }

  const supabase = await createClient(request);
  const { data: collection, error: collectionError } = await supabase
    .from("vocabulary_collections")
    .select(
      "id,title,description,visibility,created_at,updated_at,copied_from_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (collectionError) {
    return databaseErrorResponse(collectionError);
  }

  if (!collection) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ từ." },
      { status: 404 }
    );
  }

  const { data: items, error: itemsError } = await supabase
    .from("vocabulary_collection_items")
    .select(
      "collection_id,vocabulary_id,position,personal_note,vocabulary_snapshot,created_at"
    )
    .eq("collection_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemsError) {
    return databaseErrorResponse(itemsError);
  }

  return NextResponse.json({
    collection: serializeCollection(collection as CollectionRow),
    items: ((items || []) as CollectionItemRow[]).map(
      serializeCollectionItem
    ),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const id = await collectionIdFromParams(context);
  const invalidId = invalidIdResponse(id);

  if (invalidId) {
    return invalidId;
  }

  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để sửa bộ từ." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const updates: Record<string, string> = {};

  if (body?.title !== undefined) {
    const title = normalizeCollectionText(body.title, 120);

    if (!title) {
      return NextResponse.json(
        { error: "Tên bộ từ là bắt buộc và tối đa 120 ký tự." },
        { status: 400 }
      );
    }

    updates.title = title;
  }

  if (body?.description !== undefined) {
    if (typeof body.description !== "string") {
      return NextResponse.json(
        { error: "Mô tả bộ từ không hợp lệ." },
        { status: 400 }
      );
    }

    const description = body.description
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ");

    if (description.length > 1000) {
      return NextResponse.json(
        { error: "Mô tả bộ từ tối đa 1000 ký tự." },
        { status: 400 }
      );
    }

    updates.description = description;
  }

  if (body?.visibility !== undefined) {
    if (!isCollectionVisibility(body.visibility)) {
      return NextResponse.json(
        { error: "visibility phải là PRIVATE, UNLISTED hoặc PUBLIC." },
        { status: 400 }
      );
    }

    updates.visibility = String(body.visibility).toUpperCase();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Không có thay đổi hợp lệ." },
      { status: 400 }
    );
  }

  const supabase = await createClient(request);
  const { data, error } = await supabase
    .from("vocabulary_collections")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select(
      "id,title,description,visibility,created_at,updated_at,copied_from_id"
    )
    .maybeSingle();

  if (error) {
    return databaseErrorResponse(error);
  }

  if (!data) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ từ hoặc bạn không có quyền sửa." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    collection: serializeCollection(data as CollectionRow),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const id = await collectionIdFromParams(context);
  const invalidId = invalidIdResponse(id);

  if (invalidId) {
    return invalidId;
  }

  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để xóa bộ từ." },
      { status: 401 }
    );
  }

  const supabase = await createClient(request);
  const { data, error } = await supabase
    .from("vocabulary_collections")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return databaseErrorResponse(error);
  }

  if (!data) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ từ hoặc bạn không có quyền xóa." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, id });
}
