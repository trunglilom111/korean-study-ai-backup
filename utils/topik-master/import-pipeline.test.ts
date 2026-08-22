import assert from "node:assert/strict";
import { validateImportBatch, validateImportItem } from "./import-pipeline.ts";

const vocabulary = validateImportItem("vocabulary", { lemma: "계획", partOfSpeech: "명사", meaningVi: "kế hoạch", topikLevel: "TOPIK I" });
assert.equal(vocabulary.errors.length, 0);
assert.equal(vocabulary.externalKey, "계획:명사");
assert.equal(vocabulary.normalizedHash.length, 64);

const badQuestion = validateImportItem("question", { externalKey: "q-1", examType: "TOPIK II", skill: "listening", questionType: "multiple-choice", prompt: "질문", options: ["하나"], correctAnswerIndex: 4 });
assert.ok(badQuestion.errors.length >= 2);

const completeQuestion = validateImportItem("question", {
  question_id: "licensed-topik-i-001",
  exam_type: "TOPIK I",
  section: "reading",
  question_number: 1,
  question_type: "main-idea",
  difficulty: 2,
  question_text: "중심 생각을 고르십시오.",
  passage: "매일 조금씩 연습하는 것이 중요합니다.",
  options: ["쉬어야 합니다", "연습해야 합니다"],
  correct_answer: "연습해야 합니다",
  explanation_vi: "Đoạn văn nhấn mạnh việc luyện tập.",
  explanation_ko: "글은 연습의 중요성을 강조한다.",
  vocabulary: ["연습"],
  grammar: ["-는 것이 중요하다"],
  tags: ["TOPIK I", "reading"],
  source_kind: "licensed",
  rights_status: "licensed",
});
assert.deepEqual(completeQuestion.errors, []);
assert.equal(completeQuestion.payload.correctAnswerIndex, 1);
assert.equal(completeQuestion.payload.skill, "reading");
assert.deepEqual(completeQuestion.payload.vocabulary, ["연습"]);

const linkOnlyQuestion = validateImportItem("question", {
  questionId: "official-link-only-001", examType: "TOPIK I", section: "reading",
  questionType: "main-idea", questionText: "질문", options: ["1", "2"], correctAnswer: 0,
  rightsStatus: "public-link-only",
});
assert.ok(linkOnlyQuestion.errors.some((error) => error.includes("public-link-only")));

const duplicateBatch = validateImportBatch("grammar", [
  { pattern: "-기 위해서", meaningVi: "để", topikLevel: "TOPIK I" },
  { pattern: "-기 위해서", meaningVi: "nhằm", topikLevel: "TOPIK I" },
]);
assert.equal(duplicateBatch.duplicateCount, 1);
assert.equal(duplicateBatch.validCount, 1);

console.log("TOPIK import pipeline verification passed.");
