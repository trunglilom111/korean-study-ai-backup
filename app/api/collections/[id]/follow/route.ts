import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";

import { isUuid } from "../../validation";

type Params = { params: Promise<{ id: string }> };

function invalidIdResponse(id: string) {
  return isUuid(id)
    ? null
    : NextResponse.json({ error: "Mã bộ từ không hợp lệ." }, { status: 400 });
}

function databaseErrorResponse(error: { code?: string; message?: string }) {
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này." },
      { status: 403 }
    );
  }

  console.error("Collection follow API error:", error);
  return NextResponse.json(
    { error: "Không thể cập nhật theo dõi lúc này." },
    { status: 500 }
  );
}

async function getId(context: Params) {
  return (await context.params).id;
}

async function getVisibleCollection(
  request: Request,
  id: string,
  userId?: string
) {
  const supabase = await createClient(request);
  let query = supabase
    .from("vocabulary_collections")
    .select("id,visibility")
    .eq("id", id);

  if (userId) {
    query = query.or(`visibility.in.(PUBLIC,UNLISTED),owner_id.eq.${userId}`);
  } else {
    query = query.in("visibility", ["PUBLIC", "UNLISTED"]);
  }

  return { supabase, result: await query.maybeSingle() };
}

export async function GET(request: Request, context: Params) {
  const id = await getId(context);
  const invalidId = invalidIdResponse(id);

  if (invalidId) {
    return invalidId;
  }

  const user = await getAuthenticatedUser(request);
  const { supabase, result } = await getVisibleCollection(request, id, user?.id);

  if (result.error) {
    return databaseErrorResponse(result.error);
  }

  if (!result.data) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ từ công khai." },
      { status: 404 }
    );
  }

  const [{ count, error: countError }, { data: ownFollow, error: ownFollowError }] =
    await Promise.all([
      supabase
        .from("vocabulary_collection_follows")
        .select("collection_id", { count: "exact", head: true })
        .eq("collection_id", id),
      user
        ? supabase
            .from("vocabulary_collection_follows")
            .select("collection_id")
            .eq("collection_id", id)
            .eq("follower_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (countError || ownFollowError) {
    return databaseErrorResponse(countError || ownFollowError!);
  }

  return NextResponse.json({
    following: Boolean(ownFollow),
    followerCount: count || 0,
  });
}

export async function POST(request: Request, context: Params) {
  const id = await getId(context);
  const invalidId = invalidIdResponse(id);

  if (invalidId) {
    return invalidId;
  }

  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để theo dõi bộ từ." },
      { status: 401 }
    );
  }

  const { supabase, result } = await getVisibleCollection(request, id);

  if (result.error) {
    return databaseErrorResponse(result.error);
  }

  if (!result.data) {
    return NextResponse.json(
      { error: "Chỉ có thể theo dõi bộ từ công khai hoặc không niêm yết." },
      { status: 404 }
    );
  }

  const { error } = await supabase.from("vocabulary_collection_follows").insert({
    collection_id: id,
    follower_id: user.id,
  });

  if (error && error.code !== "23505") {
    return databaseErrorResponse(error);
  }

  return NextResponse.json({ ok: true, following: true });
}

export async function DELETE(request: Request, context: Params) {
  const id = await getId(context);
  const invalidId = invalidIdResponse(id);

  if (invalidId) {
    return invalidId;
  }

  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để bỏ theo dõi bộ từ." },
      { status: 401 }
    );
  }

  const supabase = await createClient(request);
  const { error } = await supabase
    .from("vocabulary_collection_follows")
    .delete()
    .eq("collection_id", id)
    .eq("follower_id", user.id);

  if (error) {
    return databaseErrorResponse(error);
  }

  return NextResponse.json({ ok: true, following: false });
}
