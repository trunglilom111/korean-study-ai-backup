import assert from "node:assert/strict";
import {
  adaptiveScore,
  allocateAdaptiveMix,
  rankAdaptiveCandidates,
  scheduleReview,
} from "./study-brain.ts";

assert.deepEqual(allocateAdaptiveMix(10), { weak: 4, target: 3, review: 2, challenge: 1 });
assert.equal(Object.values(allocateAdaptiveMix(7)).reduce((sum, value) => sum + value, 0), 7);
assert.equal(Object.values(allocateAdaptiveMix(0)).reduce((sum, value) => sum + value, 0), 0);

const weak = { id: "weak", weakness: 1, targetMatch: 0, reviewDue: 0, challenge: 0 };
const target = { id: "target", weakness: 0, targetMatch: 1, reviewDue: 0, challenge: 0 };
assert.ok(adaptiveScore(weak) > adaptiveScore(target));
assert.equal(rankAdaptiveCandidates([target, weak])[0].id, "weak");

const wrongReview = scheduleReview({ correct: false, previousIntervalDays: 4, previousEaseFactor: 2.5 });
assert.equal(wrongReview.dueInDays, 0);
assert.ok(wrongReview.priority >= 0.85);

const correctReview = scheduleReview({ correct: true, previousIntervalDays: 4, previousEaseFactor: 2.5 });
assert.equal(correctReview.intervalDays, 10);
assert.equal(correctReview.dueInDays, 10);

console.log("TOPIK Study Brain verification passed.");
