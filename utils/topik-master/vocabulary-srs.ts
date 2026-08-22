export type VocabularyRating = "again" | "hard" | "good" | "easy";

export type VocabularySrsState = {
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
  easeFactor: number;
  intervalDays: number;
  masteryScore: number;
};

const minuteInDays = 1 / 1_440;

export function scheduleVocabularyReview(
  previous: VocabularySrsState,
  rating: VocabularyRating,
  now = new Date()
) {
  const reviewCount = previous.reviewCount + 1;
  const correct = rating !== "again";
  let easeFactor = previous.easeFactor || 2.5;
  let intervalDays = previous.intervalDays || 0;
  let masteryScore = previous.masteryScore || 0;

  if (rating === "again") {
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    intervalDays = 10 * minuteInDays;
    masteryScore = Math.max(0, masteryScore - 0.12);
  } else if (rating === "hard") {
    easeFactor = Math.max(1.3, easeFactor - 0.08);
    intervalDays = Math.max(1, intervalDays * 1.2);
    masteryScore = Math.min(1, masteryScore + 0.04);
  } else if (rating === "good") {
    intervalDays = intervalDays < 1 ? 1 : Math.max(2, intervalDays * easeFactor);
    masteryScore = Math.min(1, masteryScore + 0.14);
  } else {
    easeFactor = Math.min(4, easeFactor + 0.15);
    intervalDays = intervalDays < 1 ? 4 : Math.max(5, intervalDays * easeFactor * 1.3);
    masteryScore = Math.min(1, masteryScore + 0.22);
  }

  const roundedInterval = Math.round(intervalDays * 10_000) / 10_000;
  const nextReview = new Date(now.getTime() + roundedInterval * 86_400_000);
  const status = rating === "hard"
    ? "hard"
    : masteryScore >= 0.8 && roundedInterval >= 14
      ? "mastered"
      : "learning";

  return {
    status,
    reviewCount,
    correctCount: previous.correctCount + (correct ? 1 : 0),
    wrongCount: previous.wrongCount + (correct ? 0 : 1),
    easeFactor: Math.round(easeFactor * 100) / 100,
    intervalDays: roundedInterval,
    masteryScore: Math.round(masteryScore * 100) / 100,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: nextReview.toISOString(),
  } as const;
}
