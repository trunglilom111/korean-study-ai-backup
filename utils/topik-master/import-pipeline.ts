import { createHash } from "node:crypto";

export type ImportEntityType = "vocabulary" | "grammar" | "question";

export type ValidatedImportItem = {
  externalKey: string;
  normalizedHash: string;
  payload: Record<string, unknown>;
  errors: string[];
};

const topikLevels = new Set(["TOPIK I", "TOPIK II"]);
const skills = new Set(["listening", "reading", "writing", "vocabulary", "grammar"]);

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

function integer(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function required(errors: string[], value: string, field: string, maximum = 5000) {
  if (!value) errors.push(`${field} là bắt buộc.`);
  else if (value.length > maximum) errors.push(`${field} vượt quá ${maximum} ký tự.`);
}

export function validateImportItem(entityType: ImportEntityType, input: unknown): ValidatedImportItem {
  const raw = objectValue(input);
  const errors: string[] = [];

  if (entityType === "vocabulary") {
    const lemma = text(raw.lemma);
    const partOfSpeech = text(raw.partOfSpeech || raw.part_of_speech);
    const meaningVi = text(raw.meaningVi || raw.meaning_vi);
    const targetCode = text(raw.targetCode || raw.target_code) || null;
    const homonymNumber = text(raw.homonymNumber || raw.homonym_number);
    required(errors, lemma, "lemma", 120);
    required(errors, partOfSpeech, "partOfSpeech", 80);
    required(errors, meaningVi, "meaningVi", 1000);
    const topikLevel = text(raw.topikLevel || raw.topik_level) || null;
    if (topikLevel && !topikLevels.has(topikLevel)) errors.push("topikLevel phải là TOPIK I hoặc TOPIK II.");
    const payload = {
      lemma,
      normalizedLemma: text(raw.normalizedLemma || raw.normalized_lemma) || lemma.toLocaleLowerCase("ko-KR"),
      partOfSpeech,
      targetCode,
      homonymNumber,
      hanja: text(raw.hanja) || null,
      meaningVi,
      explanationKo: text(raw.explanationKo || raw.explanation_ko),
      niklLevel: text(raw.niklLevel || raw.nikl_level) || null,
      topikLevel,
      frequencyRank: raw.frequencyRank == null && raw.frequency_rank == null ? null : integer(raw.frequencyRank || raw.frequency_rank, 0),
      frequencyScore: Math.min(1, Math.max(0, Number(raw.frequencyScore || raw.frequency_score) || 0)),
      metadata: objectValue(raw.metadata),
    };
    if (payload.frequencyRank !== null && payload.frequencyRank < 1) errors.push("frequencyRank phải lớn hơn 0.");
    const externalKey = targetCode
      ? `krdict:${targetCode}:${payload.normalizedLemma}:${partOfSpeech}:${homonymNumber}`
      : `${payload.normalizedLemma}:${partOfSpeech}${homonymNumber ? `:${homonymNumber}` : ""}`;
    return { externalKey, normalizedHash: hashPayload([entityType, externalKey]), payload, errors };
  }

  if (entityType === "grammar") {
    const pattern = text(raw.pattern);
    const meaningVi = text(raw.meaningVi || raw.meaning_vi);
    const topikLevel = text(raw.topikLevel || raw.topik_level) || null;
    const metadata = objectValue(raw.metadata);
    required(errors, pattern, "pattern", 160);
    required(errors, meaningVi, "meaningVi", 2000);
    if (topikLevel && !topikLevels.has(topikLevel)) errors.push("topikLevel phải là TOPIK I hoặc TOPIK II.");
    if (!topikLevel && metadata.classificationStatus !== "unclassified") errors.push("topikLevel là bắt buộc nếu item chưa được đánh dấu unclassified.");
    const difficulty = integer(raw.difficulty, 1);
    if (difficulty < 1 || difficulty > 5) errors.push("difficulty phải từ 1 đến 5.");
    const examples = Array.isArray(raw.examples) ? raw.examples : [];
    const payload = { pattern, meaningVi, usageVi: text(raw.usageVi || raw.usage_vi), topikLevel, difficulty, examples, metadata };
    return { externalKey: pattern, normalizedHash: hashPayload([entityType, pattern]), payload, errors };
  }

  const externalKey = text(raw.externalKey || raw.external_key);
  const examType = text(raw.examType || raw.exam_type);
  const skill = text(raw.skill);
  const prompt = text(raw.prompt);
  const questionType = text(raw.questionType || raw.question_type);
  const options = Array.isArray(raw.options) ? raw.options.map(text).filter(Boolean) : [];
  const correctAnswerIndex = raw.correctAnswerIndex === null || raw.correct_answer_index === null ? null : integer(raw.correctAnswerIndex ?? raw.correct_answer_index, -1);
  required(errors, externalKey, "externalKey", 160);
  required(errors, prompt, "prompt");
  required(errors, questionType, "questionType", 80);
  if (!topikLevels.has(examType)) errors.push("examType phải là TOPIK I hoặc TOPIK II.");
  if (!skills.has(skill)) errors.push("skill không hợp lệ.");
  if (questionType === "multiple-choice" && options.length < 2) errors.push("Câu trắc nghiệm cần ít nhất 2 lựa chọn.");
  if (correctAnswerIndex !== null && (correctAnswerIndex < 0 || correctAnswerIndex >= options.length)) errors.push("correctAnswerIndex nằm ngoài options.");
  const difficulty = integer(raw.difficulty, 1);
  if (difficulty < 1 || difficulty > 5) errors.push("difficulty phải từ 1 đến 5.");
  const payload = {
    externalKey,
    version: Math.max(1, integer(raw.version, 1)),
    examType,
    skill,
    subskill: text(raw.subskill) || "general",
    questionType,
    prompt,
    passage: text(raw.passage) || null,
    audioUrl: text(raw.audioUrl || raw.audio_url) || null,
    options,
    correctAnswerIndex,
    explanationVi: text(raw.explanationVi || raw.explanation_vi),
    difficulty,
    metadata: objectValue(raw.metadata),
  };
  return { externalKey, normalizedHash: hashPayload([entityType, externalKey, payload.version]), payload, errors };
}

export function validateImportBatch(entityType: ImportEntityType, items: unknown[]) {
  const hashes = new Set<string>();
  let duplicateCount = 0;
  const validated = items.map((item) => {
    const result = validateImportItem(entityType, item);
    if (hashes.has(result.normalizedHash)) {
      duplicateCount += 1;
      return { ...result, errors: [...result.errors, "Bản ghi trùng trong cùng batch."], duplicate: true };
    }
    hashes.add(result.normalizedHash);
    return { ...result, duplicate: false };
  });
  return { validated, duplicateCount, validCount: validated.filter((item) => item.errors.length === 0).length };
}
