import assert from "node:assert/strict";
import test from "node:test";
import { scheduleGrammarReview } from "./grammar-progress.ts";

const empty = { reviewCount: 0, correctCount: 0, wrongCount: 0, easeFactor: 2.5, intervalDays: 0, masteryScore: 0 };

test("grammar SRS schedules good answers and raises mastery", () => {
  const result = scheduleGrammarReview(empty, "good", new Date("2026-08-22T00:00:00.000Z"));
  assert.equal(result.reviewCount, 1);
  assert.equal(result.correctCount, 1);
  assert.equal(result.intervalDays, 2);
  assert.ok(result.masteryScore > 0);
});

test("grammar SRS marks forgotten grammar hard and due immediately", () => {
  const result = scheduleGrammarReview({ ...empty, reviewCount: 4, intervalDays: 10, masteryScore: 60 }, "again", new Date("2026-08-22T00:00:00.000Z"));
  assert.equal(result.status, "hard");
  assert.equal(result.intervalDays, 0);
  assert.equal(result.wrongCount, 1);
});
