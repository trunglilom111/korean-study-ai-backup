export const TOPIK_PERSONAL_ADMIN_EMAIL = "trunglilom11@gmail.com";
export const TOPIK_FIRST_MONTH_DAYS = 30;
export const TOPIK_TARGET_ACCURACY = 80;

export type TopikPersonalPhase = "topik-i" | "reading" | "listening" | "writing";

export type TopikDailyVocabulary = {
  korean: string;
  meaning: string;
  partOfSpeech: string;
  exampleKorean: string;
  exampleVietnamese: string;
};

export type TopikDailyGrammar = {
  pattern: string;
  meaning: string;
  usage: string;
  exampleKorean: string;
  exampleVietnamese: string;
};

export type TopikSkillTask = {
  title: string;
  content: string;
  question: string;
  answerGuide: string;
};

export type TopikDailyLesson = {
  title: string;
  objective: string;
  vocabulary: TopikDailyVocabulary[];
  grammar: TopikDailyGrammar[];
  listening: TopikSkillTask;
  reading: TopikSkillTask;
  writing: TopikSkillTask;
};

export type TopikDailyProgress = {
  vocabularyCompleted: string[];
  grammarCompleted: string[];
  listeningScore: number;
  readingScore: number;
  writingCompleted: boolean;
};

export type TopikPersonalPlanResponse = {
  ok: boolean;
  error?: string;
  studyDate: string;
  startDate: string;
  dayNumber: number;
  phase: TopikPersonalPhase;
  phaseLabel: string;
  targetAccuracy: number;
  lesson: TopikDailyLesson;
  progress: TopikDailyProgress;
  persisted: boolean;
};

export const emptyTopikDailyProgress: TopikDailyProgress = {
  vocabularyCompleted: [],
  grammarCompleted: [],
  listeningScore: 0,
  readingScore: 0,
  writingCompleted: false,
};

export function isTopikPersonalAdmin(email?: string | null) {
  return email?.trim().toLowerCase() === TOPIK_PERSONAL_ADMIN_EMAIL;
}

export function getSeoulDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${value.year}-${value.month}-${value.day}`;
}

export function getDayNumber(startDate: string, studyDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const current = Date.parse(`${studyDate}T00:00:00Z`);

  if (!Number.isFinite(start) || !Number.isFinite(current)) return 1;
  return Math.max(1, Math.floor((current - start) / 86_400_000) + 1);
}

export function getTopikPhase(dayNumber: number): {
  phase: TopikPersonalPhase;
  label: string;
  target: string;
} {
  if (dayNumber <= TOPIK_FIRST_MONTH_DAYS) {
    return {
      phase: "topik-i",
      label: "Tháng 1 · TOPIK I cấp 2",
      target: "Nghe và đọc hiểu đạt tối thiểu 80%",
    };
  }

  const cycleDay = (dayNumber - TOPIK_FIRST_MONTH_DAYS - 1) % 30;
  if (cycleDay < 10) {
    return { phase: "reading", label: "TOPIK II · Chặng đọc", target: "Đọc nhanh, tìm ý chính và suy luận" };
  }
  if (cycleDay < 20) {
    return { phase: "listening", label: "TOPIK II · Chặng nghe", target: "Nghe từ khóa, thái độ và quan hệ ý" };
  }
  return { phase: "writing", label: "TOPIK II · Chặng viết", target: "Viết câu, biểu đồ và đoạn lập luận" };
}

export function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)));
}
