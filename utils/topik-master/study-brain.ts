export type AdaptiveBucket = "weak" | "target" | "review" | "challenge";

export type AdaptiveCandidate = {
  id: string;
  weakness: number;
  targetMatch: number;
  reviewDue: number;
  challenge: number;
};

export type ReviewInput = {
  correct: boolean;
  previousIntervalDays: number;
  previousEaseFactor: number;
  responseTimeMs?: number;
  confidence?: number | null;
};

export type ReviewDecision = {
  intervalDays: number;
  easeFactor: number;
  priority: number;
  dueInDays: number;
};

const adaptiveWeights: Record<AdaptiveBucket, number> = {
  weak: 0.4,
  target: 0.3,
  review: 0.2,
  challenge: 0.1,
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function allocateAdaptiveMix(total: number): Record<AdaptiveBucket, number> {
  const safeTotal = Math.max(0, Math.floor(total));
  const buckets = Object.keys(adaptiveWeights) as AdaptiveBucket[];
  const allocation = Object.fromEntries(buckets.map((bucket) => [bucket, Math.floor(safeTotal * adaptiveWeights[bucket])])) as Record<AdaptiveBucket, number>;
  let remaining = safeTotal - buckets.reduce((sum, bucket) => sum + allocation[bucket], 0);

  const remainderOrder = [...buckets].sort((left, right) => {
    const rightFraction = safeTotal * adaptiveWeights[right] - Math.floor(safeTotal * adaptiveWeights[right]);
    const leftFraction = safeTotal * adaptiveWeights[left] - Math.floor(safeTotal * adaptiveWeights[left]);
    return rightFraction - leftFraction || adaptiveWeights[right] - adaptiveWeights[left];
  });

  for (let index = 0; remaining > 0; index += 1, remaining -= 1) {
    allocation[remainderOrder[index % remainderOrder.length]] += 1;
  }

  return allocation;
}

export function adaptiveScore(candidate: AdaptiveCandidate) {
  return (
    clamp(candidate.weakness) * adaptiveWeights.weak +
    clamp(candidate.targetMatch) * adaptiveWeights.target +
    clamp(candidate.reviewDue) * adaptiveWeights.review +
    clamp(candidate.challenge) * adaptiveWeights.challenge
  );
}

export function rankAdaptiveCandidates(candidates: AdaptiveCandidate[]) {
  return [...candidates].sort((left, right) => adaptiveScore(right) - adaptiveScore(left) || left.id.localeCompare(right.id));
}

export function scheduleReview(input: ReviewInput): ReviewDecision {
  const previousInterval = Math.max(0, input.previousIntervalDays || 0);
  const previousEase = clamp(input.previousEaseFactor || 2.5, 1.3, 3);
  const slowPenalty = clamp(((input.responseTimeMs || 0) - 30_000) / 90_000);
  const confidencePenalty = input.confidence == null ? 0 : 1 - clamp(input.confidence);

  if (!input.correct) {
    return {
      intervalDays: 0,
      easeFactor: clamp(previousEase - 0.2, 1.3, 3),
      priority: clamp(0.85 + slowPenalty * 0.1 + confidencePenalty * 0.05),
      dueInDays: 0,
    };
  }

  const intervalDays = previousInterval < 1
    ? 1
    : Math.max(2, Math.round(previousInterval * previousEase));
  const easeFactor = clamp(previousEase + (slowPenalty > 0.5 ? -0.05 : 0.05), 1.3, 3);
  const priority = clamp(0.45 - Math.min(intervalDays, 30) / 100 + slowPenalty * 0.15 + confidencePenalty * 0.1, 0.1, 0.8);

  return { intervalDays, easeFactor, priority, dueInDays: intervalDays };
}
