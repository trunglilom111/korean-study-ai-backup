export type GrammarRating = "again" | "hard" | "good" | "easy";

export type GrammarProgressInput = {
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
  easeFactor: number;
  intervalDays: number;
  masteryScore: number;
};

const settings: Record<GrammarRating, { ease: number; mastery: number }> = {
  again: { ease: -0.2, mastery: -18 },
  hard: { ease: -0.08, mastery: -6 },
  good: { ease: 0.04, mastery: 12 },
  easy: { ease: 0.12, mastery: 20 },
};

export function scheduleGrammarReview(input: GrammarProgressInput, rating: GrammarRating, now = new Date()) {
  const nextEase = Math.min(3.2, Math.max(1.3, input.easeFactor + settings[rating].ease));
  const correct = rating === "good" || rating === "easy";
  let intervalDays = 0;
  if (rating === "again") intervalDays = 0;
  else if (rating === "hard") intervalDays = input.intervalDays > 0 ? Math.max(1, input.intervalDays * 1.2) : 1;
  else if (input.reviewCount === 0) intervalDays = rating === "easy" ? 4 : 2;
  else intervalDays = Math.max(2, input.intervalDays * nextEase * (rating === "easy" ? 1.3 : 1));
  intervalDays = Math.round(intervalDays * 10) / 10;

  const masteryScore = Math.min(100, Math.max(0, input.masteryScore + settings[rating].mastery));
  const status = rating === "hard" || rating === "again"
    ? "hard"
    : masteryScore >= 80 && intervalDays >= 14
      ? "mastered"
      : masteryScore >= 45
        ? "understood"
        : "learning";
  const nextReview = new Date(now.getTime() + intervalDays * 86_400_000);
  return {
    status,
    reviewCount: input.reviewCount + 1,
    correctCount: input.correctCount + (correct ? 1 : 0),
    wrongCount: input.wrongCount + (correct ? 0 : 1),
    easeFactor: nextEase,
    intervalDays,
    masteryScore,
    lastStudiedAt: now.toISOString(),
    nextReviewAt: nextReview.toISOString(),
  };
}

