import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";

import {
  isUuid,
  normalizeCollectionText,
  serializeCollectionItem,
} from "../../validation";

type CollectionItemRow = {
  collection_id: string;
  vocabulary_id: string;
  position: number;
  personal_note: string | null;
  vocabulary_snapshot: unknown;
  created_at: string;
};

function getId(context: { params: Promise<{ id: string }> }) {
  return context.params.then(({ id }) => id);
}

function validateId(id: string) {
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "Mã bộ từ không hợp lệ." },
      { status: 400 }
    );
  }

  return null;
}

function databaseErrorResponse(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return NextResponse.json(
      { error: "Từ này đã có trong bộ từ." },
      { status: 409 }
    );
  }

  if (error.code === "42501") {
    return NextResponse.json(
      { error: "Bạn không có quyền chỉnh sửa bộ từ này." },
      { status: 403 }
    );
  }

  console.error("Collection items API error:", error);

  return NextResponse.json(
    { error: "Không thể xử lý từ trong bộ lúc này." },
    { status: 500 }
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const id = await getId(context);
  const invalidId = validateId(id);

  if (invalidId) {
    return invalidId;
  }

  const supabase = await createClient(request);
  const { data, error } = await supabase
    .from("vocabulary_collection_items")
    .select(
      "collection_id,vocabulary_id,position,personal_note,vocabulary_snapshot,created_at"
    )
    .eq("collection_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return databaseErrorResponse(error);
  }

  return NextResponse.json({
    items: ((data || []) as CollectionItemRow[]).map(
      serializeCollectionItem
    ),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const id = await getId(context);
  const invalidId = validateId(id);

  if (invalidId) {
    return invalidId;
  }

  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để thêm từ vào bộ." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const vocabularyId =
    typeof body?.vocabularyId === "string"
      ? body.vocabularyId.trim()
      : "";
  const personalNote =
    body?.personalNote === undefined
      ? null
      : normalizeCollectionText(body.personalNote, 1000);

  if (!isUuid(vocabularyId)) {
    return NextResponse.json(
      { error: "vocabularyId không hợp lệ." },
      { status: 400 }
    );
  }

  if (body?.personalNote !== undefined && personalNote === null) {
    return NextResponse.json(
      { error: "Ghi chú cá nhân không hợp lệ hoặc quá dài." },
      { status: 400 }
    );
  }

  const supabase = await createClient(request);
  const { data: collection, error: collectionError } = await supabase
    .from("vocabulary_collections")
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (collectionError) {
    return databaseErrorResponse(collectionError);
  }

  if (!collection) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ từ hoặc bạn không có quyền chỉnh sửa." },
      { status: 404 }
    );
  }

  const { data: legacyWord, error: wordError } = await supabase
    .from("vocabulary")
    .select(
      "id,target_code,korean,meaning,pronunciation,part_of_speech,level,categories,examples"
    )
    .eq("id", vocabularyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (wordError) {
    return databaseErrorResponse(wordError);
  }

  const topikWordResult = !legacyWord
    ? await supabase
        .from("topik_master_vocabulary")
        .select("id,lemma,part_of_speech,hanja,meaning_vi,explanation_ko,nikl_level,topik_level,metadata")
        .eq("id", vocabularyId)
        .maybeSingle()
    : { data: null, error: null };

  if (topikWordResult.error) {
    return databaseErrorResponse(topikWordResult.error);
  }

  if (!legacyWord && !topikWordResult.data) {
    return NextResponse.json(
      { error: "Không tìm thấy từ vựng trong kho học của bạn." },
      { status: 404 }
    );
  }

  const word = legacyWord
    ? {
        targetCode: legacyWord.target_code || "",
        korean: legacyWord.korean || "",
        meaning: legacyWord.meaning || "",
        pronunciation: legacyWord.pronunciation || "",
        partOfSpeech: legacyWord.part_of_speech || "",
        level: legacyWord.level || "",
        categories: Array.isArray(legacyWord.categories) ? legacyWord.categories : [],
        examples: Array.isArray(legacyWord.examples) ? legacyWord.examples : [],
        source: "legacy",
      }
    : {
        targetCode: String(topikWordResult.data?.metadata?.targetCode || ""),
        korean: topikWordResult.data?.lemma || "",
        meaning: topikWordResult.data?.meaning_vi || "",
        pronunciation: "",
        partOfSpeech: topikWordResult.data?.part_of_speech || "",
        level: topikWordResult.data?.topik_level || topikWordResult.data?.nikl_level || "",
        categories: ["TOPIK Master"],
        examples: [],
        hanja: topikWordResult.data?.hanja || "",
        explanationKo: topikWordResult.data?.explanation_ko || "",
        source: "topik-master",
      };

  const { data: lastItem, error: lastItemError } = await supabase
    .from("vocabulary_collection_items")
    .select("position")
    .eq("collection_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastItemError) {
    return databaseErrorResponse(lastItemError);
  }

  const { data, error } = await supabase
    .from("vocabulary_collection_items")
    .insert({
      collection_id: id,
      vocabulary_id: vocabularyId,
      position:
        typeof lastItem?.position === "number"
          ? lastItem.position + 1
          : 0,
      personal_note: personalNote,
      vocabulary_snapshot: {
        ...word,
      },
    })
    .select(
      "collection_id,vocabulary_id,position,personal_note,vocabulary_snapshot,created_at"
    )
    .single();

  if (error || !data) {
    return databaseErrorResponse(
      error || { message: "Collection item insert returned no data" }
    );
  }

  return NextResponse.json(
    { item: serializeCollectionItem(data as CollectionItemRow) },
    { status: 201 }
  );
}
