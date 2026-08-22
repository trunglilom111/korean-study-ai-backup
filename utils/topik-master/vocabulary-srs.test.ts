import assert from "node:assert/strict";
import { scheduleVocabularyReview } from "./vocabulary-srs.ts";

const base = { reviewCount: 0, correctCount: 0, wrongCount: 0, easeFactor: 2.5, intervalDays: 0, masteryScore: 0 };
const now = new Date("2026-08-22T00:00:00.000Z");
const again = scheduleVocabularyReview(base, "again", now);
assert.equal(again.status, "learning");
assert.equal(again.wrongCount, 1);
assert.ok(again.intervalDays < 1);

const hard = scheduleVocabularyReview(base, "hard", now);
assert.equal(hard.status, "hard");
assert.equal(hard.correctCount, 1);
assert.equal(hard.intervalDays, 1);

const easy = scheduleVocabularyReview({ ...base, intervalDays: 10, masteryScore: 0.7 }, "easy", now);
assert.equal(easy.status, "mastered");
assert.ok(easy.intervalDays >= 30);

console.log("TOPIK vocabulary SRS verification passed.");
