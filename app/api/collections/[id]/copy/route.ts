import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";

import {
  isUuid,
  normalizeCollectionText,
  serializeCollection,
  serializeCollectionItem,
} from "../../validation";

type Params = { params: Promise<{ id: string }> };

type CollectionRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  copied_from_id: string | null;
};

type SourceItemRow = {
  collection_id: string;
  vocabulary_id: string;
  position: number;
  personal_note: string | null;
  vocabulary_snapshot: unknown;
  created_at: string;
};

type VocabularyRow = {
  id: string;
  korean: string | null;
  meaning: string | null;
  target_code: string | null;
};

type VocabularySnapshot = {
  targetCode: string;
  korean: string;
  meaning: string;
  pronunciation: string;
  partOfSpeech: string;
  level: string;
  categories: string[];
  examples: string[];
};

function databaseErrorResponse(error: { code?: string; message?: string }) {
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này." },
      { status: 403 }
    );
  }

  console.error("Collection copy API error:", error);
  return NextResponse.json(
    { error: "Không thể sao chép bộ từ lúc này." },
    { status: 500 }
  );
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 50)
    : [];
}

function snapshotFrom(value: unknown): VocabularySnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const korean = textValue(source.korean);

  if (!korean) {
    return null;
  }

  return {
    targetCode: textValue(source.targetCode),
    korean,
    meaning: textValue(source.meaning),
    pronunciation: textValue(source.pronunciation),
    partOfSpeech: textValue(source.partOfSpeech),
    level: textValue(source.level),
    categories: stringArray(source.categories),
    examples: stringArray(source.examples),
  };
}

async function getId(context: Params) {
  return (await context.params).id;
}

async function cleanupCopy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  collectionId: string,
  createdVocabularyIds: string[]
) {
  await supabase
    .from("vocabulary_collections")
    .delete()
    .eq("id", collectionId)
    .eq("owner_id", userId);

  if (createdVocabularyIds.length > 0) {
    await supabase
      .from("vocabulary")
      .delete()
      .eq("user_id", userId)
      .in("id", createdVocabularyIds);
  }
}

export async function POST(request: Request, context: Params) {
  const sourceId = await getId(context);

  if (!isUuid(sourceId)) {
    return NextResponse.json(
      { error: "Mã bộ từ không hợp lệ." },
      { status: 400 }
    );
  }

  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để sao chép bộ từ." },
      { status: 401 }
    );
  }

  const supabase = await createClient(request);
  const { data: source, error: sourceError } = await supabase
    .from("vocabulary_collections")
    .select("id,title,description,visibility")
    .eq("id", sourceId)
    .in("visibility", ["PUBLIC", "UNLISTED"])
    .maybeSingle();

  if (sourceError) {
    return databaseErrorResponse(sourceError);
  }

  if (!source) {
    return NextResponse.json(
      { error: "Chỉ có thể sao chép bộ từ công khai hoặc không niêm yết." },
      { status: 404 }
    );
  }

  const { data: sourceItems, error: itemsError } = await supabase
    .from("vocabulary_collection_items")
    .select(
      "collection_id,vocabulary_id,position,personal_note,vocabulary_snapshot,created_at"
    )
    .eq("collection_id", sourceId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemsError) {
    return databaseErrorResponse(itemsError);
  }

  const items = (sourceItems || []) as SourceItemRow[];
  const snapshots = items.map((item) => snapshotFrom(item.vocabulary_snapshot));
  const invalidItem = snapshots.some((snapshot) => snapshot === null);

  if (invalidItem) {
    return NextResponse.json(
      { error: "Bộ từ nguồn có mục chưa đủ dữ liệu để sao chép." },
      { status: 422 }
    );
  }

  const title = normalizeCollectionText(`${source.title} (Copy)`, 120) || "Bộ từ sao chép";
  const { data: copiedCollection, error: copiedCollectionError } = await supabase
    .from("vocabulary_collections")
    .insert({
      owner_id: user.id,
      title,
      description: source.description || "",
      visibility: "PRIVATE",
      copied_from_id: sourceId,
    })
    .select("id,title,description,visibility,created_at,updated_at,copied_from_id")
    .single();

  if (copiedCollectionError || !copiedCollection) {
    return databaseErrorResponse(
      copiedCollectionError || { message: "Copied collection insert returned no data" }
    );
  }

  const createdVocabularyIds: string[] = [];
  const copiedVocabularyIds: string[] = [];
  const validSnapshots = snapshots as VocabularySnapshot[];
  const koreanValues = [...new Set(validSnapshots.map((snapshot) => snapshot.korean))];
  const { data: existingVocabulary, error: existingVocabularyError } =
    koreanValues.length > 0
      ? await supabase
          .from("vocabulary")
          .select("id,korean,meaning,target_code")
          .eq("user_id", user.id)
          .in("korean", koreanValues)
      : { data: [], error: null };

  if (existingVocabularyError) {
    await cleanupCopy(supabase, user.id, copiedCollection.id, createdVocabularyIds);
    return databaseErrorResponse(existingVocabularyError);
  }

  const ownedVocabulary = (existingVocabulary || []) as VocabularyRow[];

  for (const snapshot of validSnapshots) {
    const existing = ownedVocabulary.find(
      (word) =>
        word.korean === snapshot.korean &&
        (!snapshot.targetCode || word.target_code === snapshot.targetCode)
    );

    if (existing) {
      copiedVocabularyIds.push(existing.id);
      continue;
    }

    const { data: createdWord, error: createdWordError } = await supabase
      .from("vocabulary")
      .insert({
        user_id: user.id,
        target_code: snapshot.targetCode || null,
        korean: snapshot.korean,
        meaning: snapshot.meaning || "Chưa có nghĩa tiếng Việt",
        pronunciation: snapshot.pronunciation || null,
        part_of_speech: snapshot.partOfSpeech || null,
        level: snapshot.level || null,
        categories: snapshot.categories,
        examples: snapshot.examples,
        status: "learning",
        review_count: 0,
        correct_count: 0,
        wrong_count: 0,
      })
      .select("id")
      .single();

    if (createdWordError || !createdWord) {
      await cleanupCopy(supabase, user.id, copiedCollection.id, createdVocabularyIds);
      return databaseErrorResponse(
        createdWordError || { message: "Copied vocabulary insert returned no data" }
      );
    }

    createdVocabularyIds.push(createdWord.id);
    copiedVocabularyIds.push(createdWord.id);
    ownedVocabulary.push({
      id: createdWord.id,
      korean: snapshot.korean,
      meaning: snapshot.meaning,
      target_code: snapshot.targetCode || null,
    });
  }

  const copiedItems = items.map((item, index) => ({
    collection_id: copiedCollection.id,
    vocabulary_id: copiedVocabularyIds[index],
    position: item.position,
    personal_note: null,
    vocabulary_snapshot: validSnapshots[index],
  }));
  const { data: insertedItems, error: insertedItemsError } =
    copiedItems.length > 0
      ? await supabase
          .from("vocabulary_collection_items")
          .insert(copiedItems)
          .select(
            "collection_id,vocabulary_id,position,personal_note,vocabulary_snapshot,created_at"
          )
      : { data: [], error: null };

  if (insertedItemsError) {
    await cleanupCopy(supabase, user.id, copiedCollection.id, createdVocabularyIds);
    return databaseErrorResponse(insertedItemsError);
  }

  return NextResponse.json(
    {
      collection: serializeCollection(copiedCollection as CollectionRow),
      items: ((insertedItems || []) as SourceItemRow[]).map(serializeCollectionItem),
    },
    { status: 201 }
  );
}
