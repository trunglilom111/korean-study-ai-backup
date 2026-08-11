export const COLLECTION_VISIBILITIES = [
  "PRIVATE",
  "UNLISTED",
  "PUBLIC",
] as const;

export type CollectionVisibility =
  (typeof COLLECTION_VISIBILITIES)[number];

export function isCollectionVisibility(
  value: unknown
): value is CollectionVisibility {
  return (
    typeof value === "string" &&
    COLLECTION_VISIBILITIES.includes(
      value.toUpperCase() as CollectionVisibility
    )
  );
}

export function normalizeCollectionVisibility(
  value: unknown,
  fallback: CollectionVisibility = "PRIVATE"
): CollectionVisibility {
  if (!isCollectionVisibility(value)) {
    return fallback;
  }

  return String(value).toUpperCase() as CollectionVisibility;
}

export function normalizeCollectionText(
  value: unknown,
  maxLength: number
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function serializeCollection(row: {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  copied_from_id?: string | null;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    visibility: normalizeCollectionVisibility(row.visibility),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    copiedFromId: row.copied_from_id || null,
  };
}

export function serializeCollectionItem(row: {
  collection_id: string;
  vocabulary_id: string;
  position: number;
  personal_note: string | null;
  vocabulary_snapshot: unknown;
  created_at: string;
}) {
  return {
    collectionId: row.collection_id,
    vocabularyId: row.vocabulary_id,
    position: row.position,
    personalNote: row.personal_note || "",
    vocabulary: row.vocabulary_snapshot,
    createdAt: row.created_at,
  };
}
