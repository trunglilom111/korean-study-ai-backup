export type PracticeQuestion = {
  id: string;
  externalKey: string;
  position: number;
  skill: "listening" | "reading" | "writing" | "vocabulary" | "grammar";
  subskill: string;
  questionNumber: number | null;
  questionType: string;
  prompt: string;
  passage: string | null;
  audioUrl: string | null;
  transcript: string | null;
  translationVi: string | null;
  audioDurationSeconds: number | null;
  audioSpeakers: Array<{ name: string; gender: "female" | "male"; voice?: string }>;
  vocabulary: Array<{ id: string; lemma: string; meaningVi: string | null }>;
  tags: string[];
  options: string[];
  difficulty: number;
  points: number;
};

export type PracticeAnswer = {
  questionId: string;
  selectedAnswerIndex: number | null;
  responseTimeMs: number;
  confidence: number | null;
};

export type PracticeSession = {
  id: string;
  persisted: boolean;
  mode: "practice" | "timed";
  status: "active" | "submitting" | "submitted" | "abandoned";
  currentPosition: number;
  remainingSeconds: number;
  totalQuestions: number;
  exam: {
    id: string;
    externalKey: string;
    title: string;
    examType: "TOPIK I" | "TOPIK II";
    description: string;
    durationMinutes: number;
  };
  questions: PracticeQuestion[];
  answers: PracticeAnswer[];
};

export type ResultMistake = {
  id?: string;
  questionKey: string;
  skill: string;
  subskill: string;
  prompt: string;
  selectedAnswer: string;
  selectedAnswerIndex: number | null;
  correctAnswer: string;
  correctAnswerIndex: number;
  explanation: string;
};

export type SessionResult = {
  attemptId?: string;
  correct: number;
  total: number;
  score: number;
  accuracy: number;
  examTitle?: string;
  sections?: Array<{ skill: string; correct: number; total: number; score: number }>;
  mistakes?: ResultMistake[];
  persisted?: boolean;
};

export type DashboardData = {
  overallProgress: number;
  streak: number;
  dueReviews: number;
  dueVocabulary: number;
  examDate: string | null;
  daysUntilExam: number | null;
  skills: Array<{ skill: string; mastery: number; weakness: number; attempts: number }>;
  recent: Array<{ id: string; title: string; score: number; createdAt: string }>;
  recommendations: Array<{ skill: string; title: string; reason: string; count: number }>;
};

export type PlannerTask = {
  id: string;
  taskKey: string;
  dueDate: string;
  skill: string;
  taskType: string;
  title: string;
  description: string;
  targetCount: number;
  completedCount: number;
  completed: boolean;
};

export type AiQuestionExplanation = {
  correct: boolean;
  errorType: string;
  explanationVi: string;
  whyUserAnswerWrong: string;
  importantVocabulary: string[];
  importantGrammar: string[];
  trap: string;
  topikTip: string;
  similarQuestion: { prompt: string; options: string[]; answerIndex: number; explanation: string };
};

export type WritingFeedback = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  grammarCorrections: Array<{ original: string; corrected: string; explanation: string }>;
  vocabularySuggestions: string[];
  structureFeedback: string;
  revisedSample: string;
  deterministicMetrics: Record<string, number>;
};
