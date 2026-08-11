import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";

import {
  isCollectionVisibility,
  normalizeCollectionText,
  normalizeCollectionVisibility,
  serializeCollection,
} from "./validation";

type CollectionRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  copied_from_id?: string | null;
};

function databaseErrorResponse(error: {
  code?: string;
  message?: string;
}) {
  if (error.code === "23505") {
    return NextResponse.json(
      { error: "Bộ từ này đã tồn tại." },
      { status: 409 }
    );
  }

  if (error.code === "42501") {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này." },
      { status: 403 }
    );
  }

  console.error("Collections API error:", error);

  return NextResponse.json(
    { error: "Không thể xử lý bộ từ lúc này." },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để xem bộ từ." },
      { status: 401 }
    );
  }

  const supabase = await createClient(request);
  const { data, error } = await supabase
    .from("vocabulary_collections")
    .select(
      "id,title,description,visibility,created_at,updated_at,copied_from_id"
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return databaseErrorResponse(error);
  }

  return NextResponse.json({
    collections: ((data || []) as CollectionRow[]).map(
      serializeCollection
    ),
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để tạo bộ từ." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const title = normalizeCollectionText(body?.title, 120);
  const descriptionValue = body?.description;
  const description =
    descriptionValue === undefined
      ? ""
      : typeof descriptionValue === "string"
        ? descriptionValue
            .normalize("NFC")
            .trim()
            .replace(/\s+/g, " ")
        : null;
  const visibilityValue = body?.visibility;

  if (!title) {
    return NextResponse.json(
      { error: "Tên bộ từ là bắt buộc và tối đa 120 ký tự." },
      { status: 400 }
    );
  }

  if (description === null || description.length > 1000) {
    return NextResponse.json(
      { error: "Mô tả bộ từ tối đa 1000 ký tự." },
      { status: 400 }
    );
  }

  if (
    visibilityValue !== undefined &&
    !isCollectionVisibility(visibilityValue)
  ) {
    return NextResponse.json(
      { error: "visibility phải là PRIVATE, UNLISTED hoặc PUBLIC." },
      { status: 400 }
    );
  }

  const supabase = await createClient(request);
  const { data, error } = await supabase
    .from("vocabulary_collections")
    .insert({
      owner_id: user.id,
      title,
      description,
      visibility: normalizeCollectionVisibility(visibilityValue),
    })
    .select(
      "id,title,description,visibility,created_at,updated_at,copied_from_id"
    )
    .single();

  if (error || !data) {
    return databaseErrorResponse(
      error || { message: "Collection insert returned no data" }
    );
  }

  return NextResponse.json(
    { collection: serializeCollection(data as CollectionRow) },
    { status: 201 }
  );
}
