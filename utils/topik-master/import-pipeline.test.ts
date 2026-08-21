import assert from "node:assert/strict";
import { validateImportBatch, validateImportItem } from "./import-pipeline.ts";

const vocabulary = validateImportItem("vocabulary", { lemma: "계획", partOfSpeech: "명사", meaningVi: "kế hoạch", topikLevel: "TOPIK I" });
assert.equal(vocabulary.errors.length, 0);
assert.equal(vocabulary.externalKey, "계획:명사");
assert.equal(vocabulary.normalizedHash.length, 64);

const badQuestion = validateImportItem("question", { externalKey: "q-1", examType: "TOPIK II", skill: "listening", questionType: "multiple-choice", prompt: "질문", options: ["하나"], correctAnswerIndex: 4 });
assert.ok(badQuestion.errors.length >= 2);

const duplicateBatch = validateImportBatch("grammar", [
  { pattern: "-기 위해서", meaningVi: "để", topikLevel: "TOPIK I" },
  { pattern: "-기 위해서", meaningVi: "nhằm", topikLevel: "TOPIK I" },
]);
assert.equal(duplicateBatch.duplicateCount, 1);
assert.equal(duplicateBatch.validCount, 1);

console.log("TOPIK import pipeline verification passed.");
