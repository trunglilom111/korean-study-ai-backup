"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/utils/api-client";
import { preloadSpeechVoices, speakKorean } from "@/utils/speech";
import type {
  AiQuestionExplanation,
  DashboardData,
  PlannerTask,
  PracticeSession,
  ResultMistake,
  SessionResult,
  WritingFeedback,
} from "@/utils/topik-master/types";
import styles from "./topik-master.module.css";

const recommendations = [
  { icon: "🎧", title: "Luyện nghe thực chiến", subtitle: "15 câu · 30 phút", tone: "mint", screen: "Làm bài" },
  { icon: "📝", title: "Bài đọc trọng tâm", subtitle: "20 câu · 25 phút", tone: "blue", screen: "Reading" },
  { icon: "🃏", title: "100 từ TOPIK", subtitle: "Ôn nhanh · 15 phút", tone: "green", screen: "Vocabulary" },
  { icon: "✍️", title: "Viết câu 54", subtitle: "Chủ đề môi trường", tone: "violet", screen: "Viết bài" },
] as const;

type Screen = "Home" | "Dashboard" | "Học tập" | "Reading" | "Vocabulary" | "Bộ từ cá nhân" | "Grammar" | "TOPIK Practice" | "Ngân hàng câu hỏi" | "Làm bài" | "Viết bài" | "Kết quả" | "Ôn tập" | "Kế hoạch" | "Cộng đồng" | "Cá nhân";
type TopikMasterProfile = {
  display_name: string;
  current_level: string;
  target_level: string;
  exam_date: string | null;
  weekly_study_minutes: number;
  preferred_skills: string[];
  current_streak: number;
  longest_streak: number;
};

type CatalogExam = {
  external_key: string;
  title: string;
  exam_type: "TOPIK I" | "TOPIK II";
  description: string;
  duration_minutes: number;
  metadata?: Record<string, unknown>;
};

type VocabularyCatalogItem = {
  id: string;
  lemma: string;
  part_of_speech: string | null;
  hanja: string | null;
  meaning_vi: string | null;
  explanation_ko: string | null;
  nikl_level: string | null;
  topik_level: "TOPIK I" | "TOPIK II" | null;
  frequency_rank: number | null;
};

type GrammarExample = { ko?: string; vi?: string };
type GrammarCatalogItem = {
  id: string;
  pattern: string;
  meaning_vi: string | null;
  usage_vi: string | null;
  topik_level: "TOPIK I" | "TOPIK II" | null;
  difficulty: number;
  examples: GrammarExample[] | null;
};

type VocabularySrsState = {
  vocabularyId: string;
  status: "unseen" | "learning" | "mastered" | "due" | "hard";
  bookmarked: boolean;
  nextReview: string | null;
  reviewCount: number;
  mastery: number;
};

type VocabularyCollection = {
  id: string;
  title: string;
  description: string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  updatedAt: string;
};

type CollectionVocabulary = {
  korean?: string;
  meaning?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  level?: string;
  hanja?: string;
  source?: "legacy" | "topik-master";
};

type VocabularyCollectionItem = {
  collectionId: string;
  vocabularyId: string;
  position: number;
  personalNote: string;
  vocabulary: CollectionVocabulary;
};

type QuestionBankTerm = { id: string; lemma?: string; pattern?: string; meaning_vi?: string | null; topik_level?: string | null };
type QuestionBankItem = {
  id: string;
  question_id: string;
  exam_type: "TOPIK I" | "TOPIK II";
  section: "listening" | "reading" | "writing" | "vocabulary" | "grammar";
  subskill: string;
  question_number: number | null;
  question_type: string;
  question_text: string;
  passage: string | null;
  audio_url: string | null;
  transcript: string | null;
  options: string[];
  correct_answer_index: number | null;
  correct_answer: string | null;
  explanation_vi: string;
  explanation_ko: string;
  difficulty: number;
  tags: string[];
  exam_year: number | null;
  exam_round: string | null;
  source_kind: string;
  source_ref: string;
  source_url: string | null;
  license_note: string;
  rights_status: string;
  vocabulary: QuestionBankTerm[];
  grammar: QuestionBankTerm[];
};

const fallbackCatalogExams: CatalogExam[] = [
  { external_key: "tm-original-diagnostic-listening-001", exam_type: "TOPIK II", title: "Bài chẩn đoán Listening", description: "Bộ câu hỏi nguyên gốc để đo nền tảng.", duration_minutes: 25, metadata: { skill: "Listening", difficulty: "Foundation" } },
  { external_key: "local-topik-i", exam_type: "TOPIK I", title: "Thi thử TOPIK I", description: "Khung đề dành cho giai đoạn dữ liệu tiếp theo.", duration_minutes: 70, metadata: { skill: "Reading", difficulty: "Sắp mở" } },
  { external_key: "local-writing-54", exam_type: "TOPIK II", title: "Chuyên đề câu 54", description: "Luyện viết và nhận phản hồi AI.", duration_minutes: 50, metadata: { skill: "Writing", difficulty: "Cấp 4–6" } },
];

type MistakeRecord = {
  id?: string;
  question_key: string;
  skill: string;
  subskill: string;
  prompt: string;
  selected_answer: string;
  selected_answer_index: number | null;
  correct_answer: string;
  correct_answer_index: number;
  explanation: string;
  next_review_at?: string | null;
};

const defaultProfile: TopikMasterProfile = {
  display_name: "Linh",
  current_level: "TOPIK II · Cấp 4",
  target_level: "TOPIK II · Cấp 6",
  exam_date: null,
  weekly_study_minutes: 420,
  preferred_skills: ["listening", "reading"],
  current_streak: 0,
  longest_streak: 0,
};

const topikLevels = [
  "TOPIK I · Cấp 1", "TOPIK I · Cấp 2", "TOPIK II · Cấp 3",
  "TOPIK II · Cấp 4", "TOPIK II · Cấp 5", "TOPIK II · Cấp 6",
];

const practiceQuestions = [
  { prompt: "여자는 왜 이 이야기를 하고 있습니까?", options: ["여행 계획을 변경하려고", "여행 준비물을 문의하려고", "여행 경험을 이야기하려고", "여행 일정을 확인하려고"], answer: 1 },
  { prompt: "두 사람은 무엇에 대해 이야기하고 있습니까?", options: ["회사 행사", "주말 약속", "교통 상황", "건강 관리"], answer: 2 },
  { prompt: "남자의 생각으로 맞는 것을 고르십시오.", options: ["시간을 아껴야 한다", "운동을 자주 해야 한다", "계획을 바꿔야 한다", "친구에게 알려야 한다"], answer: 0 },
  { prompt: "이 대화가 이루어지는 장소는 어디입니까?", options: ["은행", "도서관", "병원", "우체국"], answer: 3 },
  { prompt: "여자가 다음에 할 일은 무엇입니까?", options: ["자료를 정리한다", "전화를 건다", "회의실에 간다", "음식을 주문한다"], answer: 2 },
  { prompt: "들은 내용과 같은 것을 고르십시오.", options: ["행사가 취소되었다", "신청 기간이 늘었다", "장소가 변경되었다", "참가비가 필요하다"], answer: 1 },
  { prompt: "남자가 이 일을 하는 이유는 무엇입니까?", options: ["경험을 쌓기 위해", "돈을 절약하기 위해", "친구를 돕기 위해", "건강을 지키기 위해"], answer: 0 },
  { prompt: "여자의 태도로 가장 알맞은 것을 고르십시오.", options: ["걱정스럽다", "만족스럽다", "부끄럽다", "무관심하다"], answer: 1 },
];

const practiceTranscripts = [
  "여자: 안녕하세요. 다음 주 제주도 여행을 예약했는데요. 비가 와도 출발하나요? 그리고 따로 준비해야 할 물건이 있습니까?\n남자: 네, 우산과 편한 신발을 준비해 주세요.",
  "여자: 오늘 길이 많이 막히네요. 회의에 늦지 않을까요?\n남자: 지하철로 갈아타면 시간을 줄일 수 있을 거예요.",
  "여자: 보고서 정리가 아직 많이 남았어요.\n남자: 중요한 부분부터 처리하면 시간을 아낄 수 있어요.",
  "남자: 이 소포를 부산으로 보내려고 하는데요.\n여자: 내용물을 확인한 뒤에 무게를 재겠습니다. 우표는 여기에서 사시면 됩니다.",
  "남자: 회의 자료를 다 정리했어요?\n여자: 네. 지금 바로 자료를 가지고 회의실로 가겠습니다.",
  "여자: 이번 문화 행사 신청 기간이 금요일까지 연장되었습니다. 장소와 참가비는 이전과 같습니다.",
  "여자: 방학에도 회사에서 일해요?\n남자: 네. 전공과 관련된 경험을 쌓기 위해서 인턴으로 일하고 있어요.",
  "남자: 새로 이용한 도서관은 어땠어요?\n여자: 공간도 넓고 필요한 자료도 많아서 아주 만족스러웠어요.",
];

const fallbackDashboard: DashboardData = {
  overallProgress: 72,
  streak: 12,
  dueReviews: 9,
  dueVocabulary: 37,
  examDate: "2026-07-13",
  daysUntilExam: 56,
  skills: [
    { skill: "listening", mastery: 80, weakness: 20, attempts: 15 },
    { skill: "reading", mastery: 68, weakness: 32, attempts: 20 },
    { skill: "writing", mastery: 65, weakness: 35, attempts: 4 },
    { skill: "vocabulary", mastery: 75, weakness: 25, attempts: 50 },
  ],
  recent: [],
  recommendations: [],
};

function localPracticeSession(mode: "practice" | "timed" = "practice"): PracticeSession {
  return {
    id: "local-foundation-session",
    persisted: false,
    mode,
    status: "active",
    currentPosition: 1,
    remainingSeconds: 25 * 60,
    totalQuestions: practiceQuestions.length,
    exam: {
      id: "local-foundation-exam",
      externalKey: "tm-original-diagnostic-listening-001",
      title: "Bài chẩn đoán Listening · Foundation",
      examType: "TOPIK II",
      description: "Chế độ local fallback trước khi migration được apply.",
      durationMinutes: 25,
    },
    questions: practiceQuestions.map((question, index) => ({
      id: `local-question-${index + 1}`,
      externalKey: `tm-original-listening-${String(index + 1).padStart(3, "0")}`,
      position: index + 1,
      skill: "listening",
      subskill: ["speaker-intention", "topic", "opinion", "place", "next-action", "detail-match", "reason", "attitude"][index],
      questionNumber: index + 1,
      questionType: "multiple-choice",
      prompt: question.prompt,
      passage: null,
      audioUrl: null,
      transcript: practiceTranscripts[index],
      translationVi: null,
      audioDurationSeconds: null,
      audioSpeakers: [],
      vocabulary: [],
      options: question.options,
      difficulty: index > 5 ? 4 : 3,
      tags: ["TOPIK II", "listening", "original"],
      points: 1,
    })),
    answers: [],
  };
}

const navItems: { icon: string; label: Screen }[] = [
  { icon: "⌂", label: "Home" },
  { icon: "▦", label: "Dashboard" },
  { icon: "▣", label: "Học tập" },
  { icon: "▥", label: "Bộ từ cá nhân" },
  { icon: "▶", label: "TOPIK Practice" },
  { icon: "▤", label: "Ngân hàng câu hỏi" },
  { icon: "◉", label: "Làm bài" },
  { icon: "✓", label: "Kết quả" },
  { icon: "↻", label: "Ôn tập" },
  { icon: "◎", label: "Kế hoạch" },
  { icon: "♧", label: "Cộng đồng" },
];

function Brand() {
  return (
    <div className={styles.brand} aria-label="TOPIK Master">
      <span className={styles.brandStar}>★</span>
      <span><b>TOPIK</b><small>MASTER</small></span>
    </div>
  );
}

function ProgressRing({ value, color = "#21b59d", size = "large" }: { value: number; color?: string; size?: "small" | "large" }) {
  return (
    <div
      className={`${styles.progressRing} ${size === "small" ? styles.progressRingSmall : ""}`}
      style={{ "--progress": `${value * 3.6}deg`, "--ring-color": color } as React.CSSProperties}
      aria-label={`Tiến độ ${value}%`}
    >
      <div><strong>{value}</strong><span>%</span></div>
    </div>
  );
}

function ScreenIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className={styles.screenIntro}>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function ListeningScreen({ session, setNotice, onComplete }: { session: PracticeSession; setNotice: (message: string) => void; onComplete: (result: SessionResult) => void }) {
  const [current, setCurrent] = useState(Math.max(0, Math.min(session.questions.length - 1, session.currentPosition - 1)));
  const [answers, setAnswers] = useState<Record<string, number>>(() => Object.fromEntries(session.answers.flatMap((answer) => answer.selectedAnswerIndex === null ? [] : [[answer.questionId, answer.selectedAnswerIndex]])));
  const [responseTimes, setResponseTimes] = useState<Record<string, number>>(() => Object.fromEntries(session.answers.map((answer) => [answer.questionId, answer.responseTimeMs])));
  const [secondsLeft, setSecondsLeft] = useState(session.remainingSeconds);
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishRef = useRef<() => void>(() => undefined);
  const autosaveState = useRef({ answers, responseTimes, current, secondsLeft });
  const question = session.questions[current];
  const isListening = question.skill === "listening";

  useEffect(() => {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setAudioPlaying(false);
    setAudioTime(0);
    setReplayCount(0);
    return () => window.speechSynthesis?.cancel();
  }, [question.id]);

  useEffect(() => {
    preloadSpeechVoices();
  }, []);

  const toggleSpeech = () => {
    if (session.mode === "timed") {
      setNotice("Chế độ Exam chỉ phát file audio ở tốc độ chuẩn 1×.");
      return;
    }
    if (!question.transcript || !("speechSynthesis" in window)) {
      setNotice("Thiết bị này chưa hỗ trợ phát giọng Hàn tự động.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    speakKorean(question.transcript, {
      rate: speechRate,
      onEnd: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        setNotice("Không phát được giọng Hàn trên thiết bị này.");
      },
    });
    setSpeaking(true);
  };

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setAudioPlaying(false);
      return;
    }
    if (audio.ended || audio.currentTime >= audio.duration - 0.1) {
      audio.currentTime = 0;
      setReplayCount((value) => value + 1);
    }
    audio.playbackRate = session.mode === "timed" ? 1 : speechRate;
    try {
      await audio.play();
      setAudioPlaying(true);
    } catch {
      setNotice("Trình duyệt đang chặn phát audio. Hãy chạm lại nút Phát.");
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const save = async (nextAnswers = answers, nextCurrent = current, nextSeconds = secondsLeft) => {
    if (!session.persisted) return true;
    const response = await apiFetch(`/api/topik-master/practice/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPosition: nextCurrent + 1,
        remainingSeconds: nextSeconds,
        answers: Object.entries(nextAnswers).map(([questionId, selectedAnswerIndex]) => ({
          questionId,
          selectedAnswerIndex,
          responseTimeMs: responseTimes[questionId] || 0,
        })),
      }),
    });
    return response.ok;
  };

  useEffect(() => {
    autosaveState.current = { answers, responseTimes, current, secondsLeft };
  }, [answers, responseTimes, current, secondsLeft]);

  useEffect(() => {
    if (!session.persisted) return;
    const autosave = window.setInterval(() => {
      const snapshot = autosaveState.current;
      void apiFetch(`/api/topik-master/practice/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPosition: snapshot.current + 1,
          remainingSeconds: snapshot.secondsLeft,
          answers: Object.entries(snapshot.answers).map(([questionId, selectedAnswerIndex]) => ({
            questionId,
            selectedAnswerIndex,
            responseTimeMs: snapshot.responseTimes[questionId] || 0,
          })),
        }),
      });
    }, 15_000);
    return () => window.clearInterval(autosave);
  }, [session.id, session.persisted]);

  const finish = async () => {
    if (submitting) return;
    setSubmitting(true);
    if (session.persisted) {
      const saved = await save();
      if (!saved) setNotice("Autosave cuối chưa xác nhận; đang thử nộp bài trực tiếp.");
      const response = await apiFetch(`/api/topik-master/practice/${session.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: session.mode }),
      });
      const payload = await response.json();
      if (response.ok && payload.result) {
        onComplete(payload.result as SessionResult);
        return;
      }
      setNotice(payload.error || "Chưa thể nộp bài; đáp án vẫn được giữ trên màn hình.");
      setSubmitting(false);
      return;
    }
    const correct = practiceQuestions.reduce((total, item, index) => total + (answers[`local-question-${index + 1}`] === item.answer ? 1 : 0), 0);
    const total = practiceQuestions.length;
    const mistakes: ResultMistake[] = practiceQuestions.flatMap((item, index) => {
      const selected = answers[`local-question-${index + 1}`];
      return selected === item.answer ? [] : [{
        questionKey: `tm-original-listening-${String(index + 1).padStart(3, "0")}`,
        skill: "listening",
        subskill: session.questions[index].subskill,
        prompt: item.prompt,
        selectedAnswer: selected === undefined ? "Chưa trả lời" : item.options[selected],
        selectedAnswerIndex: selected ?? null,
        correctAnswer: item.options[item.answer],
        correctAnswerIndex: item.answer,
        explanation: "Đáp án đúng phù hợp với mục đích và từ khóa trung tâm của câu.",
      }];
    });
    onComplete({ correct, total, score: Math.round((correct / total) * 300), accuracy: Math.round((correct / total) * 100), examTitle: session.exam.title, mistakes, persisted: false });
  };
  finishRef.current = () => { void finish(); };

  useEffect(() => {
    if (secondsLeft !== 0 || submitting) return;
    setNotice("Đã hết giờ. Hệ thống đang tự động nộp bài.");
    finishRef.current();
  }, [secondsLeft, setNotice, submitting]);

  const moveTo = (index: number) => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    audioRef.current?.pause();
    setAudioPlaying(false);
    setCurrent(index);
    void save(answers, index, secondsLeft);
  };

  const selectAnswer = (index: number) => {
    const nextAnswers = { ...answers, [question.id]: index };
    setAnswers(nextAnswers);
    setResponseTimes((currentTimes) => ({ ...currentTimes, [question.id]: currentTimes[question.id] || 0 }));
    void save(nextAnswers, current, secondsLeft);
  };

  const next = () => {
    if (answers[question.id] === undefined) {
      setNotice("Hãy chọn một đáp án trước khi tiếp tục.");
      return;
    }
    if (current === session.questions.length - 1) void finish();
    else moveTo(current + 1);
  };

  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const audioTimeText = `${Math.floor(audioTime / 60)}:${String(Math.floor(audioTime % 60)).padStart(2, "0")}`;
  const audioDurationText = `${Math.floor(audioDuration / 60)}:${String(Math.floor(audioDuration % 60)).padStart(2, "0")}`;

  return (
    <section className={`${styles.workspace} ${styles.listeningWorkspace}`}>
      <ScreenIntro eyebrow={session.mode === "timed" ? "EXAM · THI MÔ PHỎNG" : "PRACTICE · LUYỆN CÓ HƯỚNG DẪN"} title={session.exam.title} description={`${session.exam.examType} · ${session.questions.length} câu · ${session.exam.durationMinutes} phút`} />
      <div className={styles.workspaceGrid}>
        <aside className={styles.questionRail} aria-label="Danh sách câu hỏi">
          {session.questions.map((item, index) => (
            <button key={item.id} aria-current={index === current ? "step" : undefined} aria-label={`Câu ${index + 1}${answers[item.id] !== undefined ? ", đã trả lời" : ""}`} className={index === current ? styles.currentQuestion : answers[item.id] !== undefined ? styles.doneQuestion : ""} onClick={() => moveTo(index)}>{index + 1}</button>
          ))}
        </aside>
        <article className={styles.practicePanel}>
          <div className={styles.practiceTop}><div><b>Câu {current + 1} / {session.questions.length}</b><span>{session.persisted ? "Đang autosave" : "Local fallback"} · {question.subskill}</span></div><time>{timerText}</time><button onClick={() => setNotice(`Đã trả lời ${Object.keys(answers).length}/${session.questions.length} câu.`)}>Bản đồ câu hỏi</button></div>
          <div className={styles.practiceProgress}><i style={{ width: `${((current + 1) / session.questions.length) * 100}%` }} /></div>
          {question.passage && <div className={styles.questionPassage}>{question.passage}</div>}
          {isListening && question.audioUrl && <div className={styles.realAudioPlayer}>
            <audio ref={audioRef} key={question.audioUrl} preload="metadata" src={question.audioUrl} onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || question.audioDurationSeconds || 0)} onTimeUpdate={(event) => setAudioTime(event.currentTarget.currentTime)} onEnded={() => setAudioPlaying(false)}>Trình duyệt không hỗ trợ audio.</audio>
            <div className={styles.audioControls}><button onClick={() => void toggleAudio()}>{audioPlaying ? "Ⅱ Tạm dừng" : audioTime > 0 ? "↻ Phát lại" : "▶ Phát audio"}</button><div><span>{audioTimeText}</span><progress max={audioDuration || 1} value={audioTime} /><span>{audioDurationText}</span></div>{session.mode === "practice" ? <label><span>Tốc độ</span><select value={speechRate} onChange={(event) => { const rate = Number(event.target.value); setSpeechRate(rate); if (audioRef.current) audioRef.current.playbackRate = rate; }}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label> : <b>1× cố định</b>}</div>
            <small>{question.audioSpeakers.map((speaker) => `${speaker.gender === "female" ? "Nữ" : "Nam"}: ${speaker.name}`).join(" · ") || "Giọng chuẩn Hàn"} · đã phát lại {replayCount} lần</small>
          </div>}
          {isListening && !question.audioUrl && question.transcript && session.mode === "practice" && <div className={styles.speechFallback}><div><button onClick={toggleSpeech}>{speaking ? "■ Dừng" : "▶ Phát giọng Hàn dự phòng"}</button><label><span>Tốc độ</span><select value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label></div></div>}
          {isListening && !question.audioUrl && !question.transcript && <div className={styles.audioPlayer}><span>Audio chưa có trong bản fallback</span><div className={styles.waveform}>{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ height: `${18 + ((i * 17) % 50)}%` }} />)}</div></div>}
          {isListening && !question.audioUrl && session.mode === "timed" && <div className={styles.catalogError}>Câu này chưa có file audio nên không thể dùng đúng chuẩn Exam.</div>}
          {isListening && session.mode === "practice" && question.transcript && <details className={styles.practiceTranscript}><summary>Transcript</summary><p>{question.transcript}</p></details>}
          {isListening && session.mode === "practice" && question.translationVi && <details className={styles.practiceTranscript}><summary>Dịch tiếng Việt</summary><p>{question.translationVi}</p></details>}
          {isListening && session.mode === "practice" && question.vocabulary.length > 0 && <div className={styles.listeningVocabulary}><strong>Tra từ nhanh</strong><div>{question.vocabulary.map((word) => <button key={word.id} onClick={() => setNotice(`${word.lemma}: ${word.meaningVi || "Chưa có nghĩa tiếng Việt"}`)}>{word.lemma}</button>)}</div></div>}
          <h2>{question.prompt}</h2>
          <div className={styles.answerGrid}>
            {question.options.map((answer, index) => (
              <button key={answer} className={answers[question.id] === index ? styles.selectedAnswer : ""} onClick={() => selectAnswer(index)}><i />{answer}</button>
            ))}
          </div>
          <div className={styles.practiceActions}><button disabled={current === 0 || submitting} onClick={() => moveTo(Math.max(0, current - 1))}>‹ Câu trước</button><button className={styles.answerButton} disabled={submitting} onClick={next}>{submitting ? "Đang chấm..." : current === session.questions.length - 1 ? "Nộp bài" : "Lưu & tiếp tục"}</button><button disabled={current === session.questions.length - 1 || submitting} onClick={() => moveTo(Math.min(session.questions.length - 1, current + 1))}>Câu sau ›</button></div>
        </article>
        {session.mode === "practice" && <aside className={styles.helpPanel}><strong>Trợ giúp học tập</strong><span>💡 Tập trung vào từ khóa về mục đích.</span><p>Đáp án bạn chọn sẽ được phân tích khi kết nối dữ liệu.</p></aside>}
      </div>
    </section>
  );
}

function ExamScreen({ setNotice }: { setNotice: (message: string) => void }) {
  const promptText = "환경 보호는 우리 모두의 미래를 위해 매우 중요합니다. 일회용품 사용을 줄이고 환경 보호를 실천할 수 있는 방법에 대해 쓰십시오.";
  const [writing, setWriting] = useState("환경 보호는 우리 모두의 미래를 위해 매우 중요합니다. 최근 일회용품 사용 줄이기, 분리수거 생활화, 대중교통 이용 등 다양한 활동이 진행되고 있습니다.\n\n저는 일상생활에서 텀블러 사용하기, 플라스틱 제품 사용 줄이기, 가까운 거리는 걷거나 자전거 이용하기 등을 실천하고 있습니다.");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch("/api/topik-master/writing-draft?promptKey=writing-54-environment")
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload?.draft?.response_text) setWriting(payload.draft.response_text); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const saveDraft = async () => {
    setSaving(true);
    const response = await apiFetch("/api/topik-master/writing-draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptKey: "writing-54-environment", promptText, responseText: writing }),
    });
    const payload = await response.json();
    setNotice(response.ok ? "Đã lưu bản nháp bài viết." : payload.error || "Chưa thể lưu bản nháp.");
    setSaving(false);
  };

  const requestFeedback = async () => {
    setAnalyzing(true);
    const response = await apiFetch("/api/topik-master/ai/writing-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptKey: "writing-54-environment", promptText, responseText: writing }),
    });
    const payload = await response.json();
    if (response.ok && payload.feedback) {
      setFeedback(payload.feedback as WritingFeedback);
      setNotice(`Đã phân tích bài viết bằng ${payload.provider}.`);
    } else setNotice(payload.error || "Chưa thể phân tích bài viết.");
    setAnalyzing(false);
  };

  return (
    <section className={`${styles.workspace} ${styles.examWorkspace}`}>
      <div className={styles.examHeading}><ScreenIntro eyebrow="THI THỬ" title="TOPIK II · Đề số 3" description="Viết · Câu 54" /><div><span>Thời gian còn lại</span><strong>01:23:45</strong><button disabled={saving} onClick={() => void saveDraft()}>{saving ? "Đang lưu" : "Lưu tạm"}</button></div></div>
      <div className={styles.examLayout}>
        <aside className={styles.examSections}><strong>Cấu trúc đề</strong><button>▣ Nghe · 50 câu</button><button>▤ Đọc · 50 câu</button><button className={styles.examSectionActive}>✎ Viết · 4 câu</button><button>▧ Nói · 2 câu</button></aside>
        <article className={styles.writingPanel}>
          <div className={styles.writingPrompt}><b>Đề bài</b><p>{promptText}</p></div>
          <div className={styles.wordCount}>Số ký tự: <b>{writing.length} / 700</b></div>
          <div className={styles.editor}>
            <div className={styles.toolbar}><b>B</b><i>I</i><u>U</u><span>≡</span><span>☷</span><span>↶</span><span>↷</span></div>
            <textarea aria-label="Bài viết TOPIK" value={writing} onChange={(event) => setWriting(event.target.value)} maxLength={5000} />
          </div>
          <div className={styles.editorActions}><button onClick={() => void saveDraft()}>Lưu bản nháp</button><button disabled={analyzing} onClick={() => void requestFeedback()}>{analyzing ? "AI đang phân tích..." : "Nhận phản hồi AI →"}</button></div>
          {feedback && <section className={styles.writingFeedback}><div><strong>{feedback.score}/100</strong><p>{feedback.summary}</p></div><h3>Cần cải thiện</h3><ul>{feedback.improvements.map((item) => <li key={item}>{item}</li>)}</ul><h3>Cấu trúc</h3><p>{feedback.structureFeedback}</p>{feedback.grammarCorrections.length > 0 && <><h3>Sửa ngữ pháp</h3>{feedback.grammarCorrections.map((item) => <p key={`${item.original}-${item.corrected}`}><del>{item.original}</del> → <b>{item.corrected}</b><br /><small>{item.explanation}</small></p>)}</>}</section>}
        </article>
        <aside className={styles.writingTips}><strong>Lưu ý</strong><ul><li>Viết 600–700 chữ.</li><li>Trình bày rõ mở bài và kết luận.</li><li>Dùng ngữ pháp phù hợp.</li></ul><div><span>Số chữ yêu cầu</span><b>600–700</b></div></aside>
      </div>
    </section>
  );
}

function PlanScreen({ setNotice }: { setNotice: (message: string) => void }) {
  const fallbackTasks: PlannerTask[] = [
    { id: "local-listening", taskKey: "local-listening", dueDate: "Hôm nay", skill: "listening", taskType: "practice", title: "Nghe phản xạ và bắt từ khóa", description: "Luyện 10 câu theo điểm yếu.", targetCount: 10, completedCount: 0, completed: false },
    { id: "local-review", taskKey: "local-review", dueDate: "Hôm nay", skill: "review", taskType: "review", title: "Ôn lại câu đến hạn", description: "Ưu tiên SRS trước nội dung mới.", targetCount: 5, completedCount: 0, completed: false },
    { id: "local-reading", taskKey: "local-reading", dueDate: "Hôm nay", skill: "reading", taskType: "lesson", title: "Đọc hiểu và suy luận", description: "Giữ cân bằng kỹ năng.", targetCount: 1, completedCount: 0, completed: false },
    { id: "local-writing", taskKey: "local-writing", dueDate: "Hôm nay", skill: "writing", taskType: "writing", title: "Luyện viết câu 54", description: "Viết và nhận phản hồi theo rubric.", targetCount: 1, completedCount: 0, completed: false },
  ];
  const [tasks, setTasks] = useState<PlannerTask[]>(fallbackTasks);
  const [activeWeek, setActiveWeek] = useState(0);
  const completedCount = tasks.filter((task) => task.completed).length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  useEffect(() => {
    let active = true;
    void apiFetch("/api/topik-master/planner")
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload?.tasks?.length) setTasks(payload.tasks as PlannerTask[]); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const toggleTask = async (task: PlannerTask) => {
    const nextCompleted = !task.completed;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: nextCompleted, completedCount: nextCompleted ? item.targetCount : 0 } : item));
    if (!task.id.startsWith("local-")) {
      const response = await apiFetch("/api/topik-master/planner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, completedCount: nextCompleted ? task.targetCount : 0 }),
      });
      if (!response.ok) setNotice("Chưa đồng bộ được nhiệm vụ; trạng thái tạm giữ trên thiết bị.");
      else setNotice(`Đã đồng bộ nhiệm vụ: ${task.title}.`);
      return;
    }
    setNotice(`Đã cập nhật nhiệm vụ mẫu: ${task.title}.`);
  };

  return (
    <section className={`${styles.workspace} ${styles.planWorkspace}`}>
      <ScreenIntro eyebrow="KẾ HOẠCH CÁ NHÂN" title="Kế hoạch chinh phục TOPIK 6" description="Nhiệm vụ hôm nay được tạo từ điểm yếu và lịch ôn SRS." />
      <div className={styles.planTabs}><button className={styles.planTabActive}>Kế hoạch học</button><button>Cộng đồng</button><button>Q&A</button><button>Tài liệu</button></div>
      <div className={styles.weekTabs}>{["Hôm nay", "Ngày mai", "Tuần này", "Tuần sau"].map((week, index) => <button key={week} className={index === activeWeek ? styles.activeWeek : ""} onClick={() => setActiveWeek(index)}><b>{week}</b><span>{index === 0 ? "Đang hoạt động" : "Sắp mở"}</span></button>)}</div>
      <article className={styles.planBoard}>
        <div>
          <div className={styles.cardHeader}><strong>{activeWeek === 0 ? "Nhiệm vụ hôm nay" : "Khung kế hoạch tiếp theo"}</strong><span>{completedCount}/{tasks.length} nhiệm vụ</span></div>
          <div className={styles.weekTasks}>
            {tasks.map((task) => (
              <button className={`${styles.plannerTask} ${task.completed ? styles.plannerTaskDone : ""}`} key={task.id} onClick={() => void toggleTask(task)}><i>{task.completed ? "✓" : ""}</i><span>{task.title}<small>{task.description}</small></span><strong>{task.completed ? "Hoàn thành" : `${task.completedCount}/${task.targetCount}`}</strong></button>
            ))}
          </div>
        </div>
        <div className={styles.planSummary}><ProgressRing value={progress} /><strong>{completedCount} nhiệm vụ xong</strong><span>Mục tiêu {tasks.length} nhiệm vụ</span><button onClick={() => setNotice("Hãy hoàn thành từng nhiệm vụ để lịch SRS được cập nhật chính xác.")}>Cách tính tiến độ</button></div>
      </article>
    </section>
  );
}

function ResultsScreen({ goTo, result }: { goTo: (screen: Screen) => void; result: SessionResult }) {
  const accuracy = result.accuracy ?? (result.total ? Math.round((result.correct / result.total) * 100) : 0);
  const skillLabels: Record<string, string> = { listening: "Nghe", reading: "Đọc", writing: "Viết", vocabulary: "Từ vựng", grammar: "Ngữ pháp" };
  const colors = ["#775ce5", "#607ee8", "#8b64df", "#21b39b"];
  const scores: Array<[string, number, string]> = result.sections?.length
    ? result.sections.map((section, index) => [skillLabels[section.skill] || section.skill, Math.round(section.score), colors[index % colors.length]])
    : [["Nghe", accuracy, colors[0]]];
  const weakArea = result.mistakes?.[0]?.subskill || "Chưa xác định";
  const detailRows = result.sections?.length
    ? result.sections.map((section) => [skillLabels[section.skill] || section.skill, `${section.correct}/${section.total}`, "80%", `${Math.round(section.score) - 80}%`])
    : [["Tổng hợp", `${result.correct}/${result.total}`, "80%", `${accuracy - 80}%`]];
  const level = result.score >= 230 ? "Cấp 6" : result.score >= 190 ? "Cấp 5" : result.score >= 150 ? "Cấp 4" : "Đang đánh giá";
  return (
    <section className={`${styles.workspace} ${styles.resultsWorkspace}`}>
      <ScreenIntro eyebrow="KẾT QUẢ THI THỬ" title="Phân tích thành tích" description={result.examTitle || "Kết quả phiên luyện gần nhất."} />
      <div className={styles.resultSummary}><div><span>Đúng</span><strong>{result.correct} câu</strong></div><div><span>Sai</span><strong>{Math.max(0, result.total - result.correct)} câu</strong></div><div><span>Dạng yếu</span><strong>{weakArea}</strong></div><button onClick={() => goTo("Ôn tập")}>Làm lại câu sai ↻</button></div>
      <div className={styles.resultGrid}>
        <article className={styles.totalScore}><span>Tổng điểm quy đổi</span><strong>{result.score}<small>/300</small></strong><div><b>{level}</b><span>{accuracy}% chính xác</span></div><button onClick={() => window.print()}>In bảng điểm ↓</button></article>
        <article className={styles.scoreCard}><div className={styles.scoreRings}>{scores.map(([label, score, color]) => <div key={label}><ProgressRing value={score} color={color} size="small" /><span>{label}</span></div>)}</div></article>
        <article className={styles.resultInsight}><strong>Điểm mạnh & điểm yếu</strong><div className={styles.badges}><span className={styles.good}>Đúng</span><b>{result.correct} câu</b><b>{accuracy}%</b></div><div className={styles.badges}><span className={styles.weak}>Ưu tiên</span><b>{weakArea}</b><b>{result.mistakes?.length || 0} câu sai</b></div><button onClick={() => goTo("Ôn tập")}>Nhận bài luyện phù hợp</button></article>
      </div>
      <article className={styles.analysisTable}>
        <div className={styles.analysisTitle}><div><span>PHÂN TÍCH CHI TIẾT</span><h2>Độ chính xác theo kỹ năng</h2></div><span className={styles.trophy}>🏆</span></div>
        <div className={styles.tableHead}><span>Kỹ năng</span><span>Kết quả</span><span>Mục tiêu</span><span>So sánh</span></div>
        {detailRows.map((row) => <div className={styles.tableRow} key={row[0]}>{row.map((cell, index) => <span key={`${cell}-${index}`}>{cell}</span>)}</div>)}
      </article>
    </section>
  );
}

function HomeScreen({ goTo, onStart }: { goTo: (screen: Screen) => void; onStart: () => Promise<void> }) {
  const shortcuts: { icon: string; title: string; description: string; screen: Screen; tone: string }[] = [
    { icon: "가", title: "Từ vựng", description: "Học từ theo cấp TOPIK", screen: "Vocabulary", tone: "mint" },
    { icon: "文", title: "Ngữ pháp", description: "Mẫu câu trọng tâm", screen: "Grammar", tone: "blue" },
    { icon: "✎", title: "Luyện đề", description: "Đề thi TOPIK I & II", screen: "TOPIK Practice", tone: "violet" },
    { icon: "★", title: "TOPIK", description: "Mục tiêu và tiến độ", screen: "Dashboard", tone: "green" },
  ];

  return (
    <section className={styles.workspace}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>TOPIK MASTER · D-56</span>
          <h1>TOPIK 합격의<br />모든 것, <em>TOPIK MASTER</em></h1>
          <p>Lộ trình học và luyện thi cá nhân hóa dành riêng cho người Việt.</p>
          <div className={styles.heroButtons}>
            <button className={styles.primaryButton} onClick={() => goTo("Dashboard")}>Bắt đầu học</button>
            <button className={styles.secondaryButton} onClick={() => void onStart()}>Test trình độ</button>
          </div>
        </div>
        <div className={styles.heroMascot}>
          <span className={styles.speechBubble}>Cố lên nhé!</span>
          <Image src="/topik-master/tiger-mascot.webp" alt="Hổ trắng TOPIK Master đang động viên" width={560} height={560} priority sizes="(max-width: 699px) 64vw, 390px" />
        </div>
      </section>
      <section className={styles.shortcutSection}>
        <div className={styles.sectionTitle}><div><span>BẮT ĐẦU NHANH</span><h2>Hôm nay bạn muốn học gì?</h2></div></div>
        <div className={styles.shortcutGrid}>
          {shortcuts.map((item) => <button key={item.title} className={`${styles.shortcutCard} ${styles[item.tone]}`} onClick={() => goTo(item.screen)}><i>{item.icon}</i><span><strong>{item.title}</strong><small>{item.description}</small></span><b>›</b></button>)}
        </div>
      </section>
    </section>
  );
}

function DashboardScreen({ goTo, notice, setNotice, dashboard, profile }: { goTo: (screen: Screen) => void; notice: string; setNotice: (message: string) => void; dashboard: DashboardData; profile: TopikMasterProfile }) {
  const skillLabels: Record<string, string> = { listening: "Listening", reading: "Reading", writing: "Writing", vocabulary: "Vocabulary", grammar: "Grammar" };
  const destinationBySkill: Record<string, Screen> = { listening: "Làm bài", reading: "Reading", writing: "Viết bài", vocabulary: "Vocabulary", grammar: "Grammar", review: "Ôn tập" };
  const visibleSkills = dashboard.skills.length ? dashboard.skills.slice(0, 4) : fallbackDashboard.skills;
  const dateLabel = dashboard.examDate ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${dashboard.examDate}T00:00:00`)) : "Chưa đặt ngày";
  const cards = dashboard.recommendations.length
    ? dashboard.recommendations.map((item, index) => ({ icon: item.skill === "review" ? "↻" : item.skill === "listening" ? "🎧" : item.skill === "writing" ? "✍️" : item.skill === "vocabulary" ? "🃏" : item.skill === "grammar" ? "文" : "📖", title: item.title, subtitle: `${item.count} mục · ${item.reason}`, tone: recommendations[index % recommendations.length].tone, screen: destinationBySkill[item.skill.toLowerCase()] || "Học tập" }))
    : recommendations;
  return (
    <section className={styles.workspace}>
      <ScreenIntro eyebrow="DASHBOARD" title="Hôm nay học gì?" description="Mọi chỉ số TOPIK quan trọng trong một nơi." />
      <p className={styles.notice} role="status">✨ {notice}</p>
      <section className={styles.goalStrip}>
        <div><span>Mục tiêu hiện tại</span><strong>{profile.target_level}</strong></div>
        <div><span>Countdown ngày thi</span><strong>{dashboard.daysUntilExam === null ? "—" : `D-${dashboard.daysUntilExam}`} <small>{dateLabel}</small></strong></div>
        <button onClick={() => goTo("Kế hoạch")}>Xem kế hoạch</button>
        <div className={styles.streak}><span>🔥</span><strong>{dashboard.streak} ngày<small>{dashboard.dueReviews} câu · {dashboard.dueVocabulary} từ cần ôn</small></strong></div>
      </section>
      <section className={styles.statsGrid} aria-label="Tổng quan học tập">
        <article className={styles.card}><div className={styles.cardHeader}><strong>Tổng tiến độ</strong><span>Theo mastery</span></div><div className={styles.progressWrap}><ProgressRing value={dashboard.overallProgress || fallbackDashboard.overallProgress} /><ul className={styles.skillList}>{visibleSkills.map((skill, index) => <li key={skill.skill}><i className={[styles.tealDot, styles.blueDot, styles.purpleDot, styles.coralDot][index]} />{skillLabels[skill.skill] || skill.skill} <b>{skill.mastery}%</b></li>)}</ul></div></article>
        <article className={styles.card}><div className={styles.cardHeader}><strong>Học gần đây</strong><span>{dashboard.recent.length || "Mẫu"}</span></div><div className={styles.recentList}>{dashboard.recent.length ? dashboard.recent.map((item) => <button key={item.id} onClick={() => goTo("Kết quả")}><i>✓</i><span><b>{item.title}</b><small>{new Intl.DateTimeFormat("vi-VN").format(new Date(item.createdAt))}</small></span><em>{Math.round(item.score)}%</em></button>) : <><button onClick={() => goTo("Làm bài")}><i>🎧</i><span><b>Luyện nghe chẩn đoán</b><small>Chưa đồng bộ dữ liệu</small></span><em>—</em></button><button onClick={() => goTo("Ôn tập")}><i>↻</i><span><b>Ôn lại câu sai</b><small>Sẵn sàng sau bài đầu tiên</small></span><em>{dashboard.dueReviews}</em></button></>}</div></article>
        <article className={`${styles.card} ${styles.insightCard}`}><div className={styles.cardHeader}><strong>Điểm mạnh & điểm yếu</strong><span>Study Brain</span></div><div className={styles.badges}><span className={styles.good}>Mạnh</span><b>{[...visibleSkills].sort((a, b) => b.mastery - a.mastery)[0]?.skill || "Chưa đủ dữ liệu"}</b></div><div className={styles.badges}><span className={styles.weak}>Yếu</span><b>{[...visibleSkills].sort((a, b) => b.weakness - a.weakness)[0]?.skill || "Chưa đủ dữ liệu"}</b></div><button onClick={() => goTo("Kết quả")}>Xem phân tích chi tiết</button></article>
      </section>
      <section className={styles.recommendationSection}>
        <div className={styles.sectionTitle}><div><span>GỢI Ý HÔM NAY</span><h2>Bài học dành cho bạn</h2></div><button onClick={() => setNotice("Đã làm mới gợi ý mẫu cho hôm nay.")}>Làm mới ↻</button></div>
        <div className={styles.recommendationGrid}>{cards.map((item, index) => <button key={`${item.title}-${index}`} className={`${styles.lessonCard} ${styles[item.tone]}`} onClick={() => goTo(item.screen as Screen)}><span className={styles.lessonIcon}>{item.icon}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small><em>Học ngay →</em></div></button>)}</div>
      </section>
    </section>
  );
}

function StudyHub({ goTo, onStart }: { goTo: (screen: Screen) => void; onStart: () => Promise<void> }) {
  const [catalogCounts, setCatalogCounts] = useState({ vocabulary: 53884, grammar: 990 });

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiFetch("/api/topik-master/catalog?resource=vocabulary&limit=1").then(async (response) => response.ok ? response.json() : null),
      apiFetch("/api/topik-master/catalog?resource=grammar&limit=1").then(async (response) => response.ok ? response.json() : null),
    ]).then(([vocabulary, grammar]) => {
      if (!active) return;
      setCatalogCounts({
        vocabulary: Number(vocabulary?.total || 53884),
        grammar: Number(grammar?.total || 990),
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const skills: { icon: string; title: string; description: string; count: string; tone: string; screen?: Screen; start?: boolean }[] = [
    { icon: "🎧", title: "Listening", description: "Luyện nghe theo dạng câu TOPIK", count: "15 bài", tone: "mint", start: true },
    { icon: "📖", title: "Reading", description: "Đọc hiểu, suy luận và tìm ý chính", count: "Khung kỹ năng", tone: "blue", screen: "Reading" },
    { icon: "✍️", title: "Writing", description: "Câu 51–54 và bài viết TOPIK II", count: "12 bài", tone: "violet", screen: "Viết bài" },
    { icon: "가", title: "Vocabulary", description: "Từ vựng theo cấp và tần suất", count: `${catalogCounts.vocabulary.toLocaleString("vi-VN")} từ`, tone: "green", screen: "Vocabulary" },
    { icon: "文", title: "Grammar", description: "Ngữ pháp trọng tâm và gần nghĩa", count: `${catalogCounts.grammar.toLocaleString("vi-VN")} mẫu`, tone: "orange", screen: "Grammar" },
    { icon: "▤", title: "Question Bank", description: "Lọc câu theo cấp, kỹ năng và dạng bài", count: "TOPIK I–II", tone: "blue", screen: "Ngân hàng câu hỏi" },
  ];

  return <section className={styles.workspace}><ScreenIntro eyebrow="HỌC TẬP" title="Chọn kỹ năng cần luyện" description="Mỗi kỹ năng có lộ trình và tiến độ riêng." /><div className={styles.skillHub}>{skills.map((item) => <button key={item.title} className={`${styles.skillHubCard} ${styles[item.tone]}`} onClick={() => item.start ? void onStart() : item.screen && goTo(item.screen)}><i>{item.icon}</i><span><strong>{item.title}</strong><small>{item.description}</small><em>{item.count}</em></span><b>→</b></button>)}</div></section>;
}

function ReadingHub({ goTo, onOpenBank }: { goTo: (screen: Screen) => void; onOpenBank: () => void }) {
  const modes = [
    { icon: "핵", title: "Tìm ý chính", description: "Nhận diện chủ đề và câu trung tâm", count: "TOPIK I–II" },
    { icon: "順", title: "Sắp xếp đoạn", description: "Nối mạch logic giữa các câu", count: "Dạng câu 13–15" },
    { icon: "推", title: "Suy luận", description: "Đọc ẩn ý và thái độ người viết", count: "Dạng nâng cao" },
    { icon: "速", title: "Đọc bấm giờ", description: "Rèn tốc độ theo thời lượng thi thật", count: "Chế độ tập trung" },
  ];
  return <section className={styles.workspace}><button className={styles.catalogBack} onClick={() => goTo("Học tập")}>← Học tập</button><ScreenIntro eyebrow="READING" title="Luyện đọc theo dạng câu" description="Chọn dạng đọc trọng tâm, sau đó mở ngân hàng để lọc đúng cấp độ và độ khó." /><div className={styles.skillHub}>{modes.map((item) => <button key={item.title} className={`${styles.skillHubCard} ${styles.blue}`} onClick={onOpenBank}><i>{item.icon}</i><span><strong>{item.title}</strong><small>{item.description}</small><em>{item.count}</em></span><b>→</b></button>)}</div><button className={styles.catalogPrimary} onClick={onOpenBank}>Mở ngân hàng Reading →</button></section>;
}

function LearningCatalog({ kind, goTo, setNotice }: { kind: "vocabulary" | "grammar"; goTo: (screen: Screen) => void; setNotice: (message: string) => void }) {
  const pageSize = 30;
  const [items, setItems] = useState<(VocabularyCatalogItem | GrammarCatalogItem)[]>([]);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("Tất cả");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [srsStates, setSrsStates] = useState<Record<string, VocabularySrsState>>({});
  const [collections, setCollections] = useState<VocabularyCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const isVocabulary = kind === "vocabulary";

  useEffect(() => {
    if (!isVocabulary) return;
    let active = true;
    void apiFetch("/api/collections")
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active || !payload?.collections) return;
        const next = payload.collections as VocabularyCollection[];
        setCollections(next);
        setSelectedCollectionId((current) => current || next[0]?.id || "");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isVocabulary]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ resource: kind, limit: String(pageSize), offset: "0" });
      if (query.trim()) params.set("search", query.trim());
      if (level !== "Tất cả") params.set("topikLevel", level === "Chưa phân cấp" ? "unclassified" : level);
      void apiFetch(`/api/topik-master/catalog?${params.toString()}`)
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Không tải được dữ liệu học.");
          if (active) {
            setItems(payload.data || []);
            setTotal(Number(payload.total || 0));
          }
        })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu học."); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [kind, level, query]);

  useEffect(() => {
    if (!isVocabulary) return;
    const ids = items.map((item) => item.id).join(",");
    if (!ids) { setSrsStates({}); return; }
    let active = true;
    void apiFetch(`/api/topik-master/vocabulary-srs?ids=${encodeURIComponent(ids)}&limit=100`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active || !payload?.states) return;
        setSrsStates(Object.fromEntries((payload.states as VocabularySrsState[]).map((state) => [state.vocabularyId, state])));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isVocabulary, items]);

  const loadMore = async () => {
    setLoadingMore(true);
    const params = new URLSearchParams({ resource: kind, limit: String(pageSize), offset: String(items.length) });
    if (query.trim()) params.set("search", query.trim());
    if (level !== "Tất cả") params.set("topikLevel", level === "Chưa phân cấp" ? "unclassified" : level);
    try {
      const response = await apiFetch(`/api/topik-master/catalog?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải thêm được dữ liệu.");
      setItems((current) => [...current, ...(payload.data || [])]);
      setTotal(Number(payload.total || total));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải thêm được dữ liệu.");
    } finally {
      setLoadingMore(false);
    }
  };

  const saveSrs = async (vocabularyId: string, update: { rating?: "again" | "hard" | "good" | "easy"; bookmarked?: boolean }) => {
    setSavingWord(vocabularyId);
    try {
      const response = await apiFetch("/api/topik-master/vocabulary-srs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vocabularyId, ...update }) });
      const payload = await response.json();
      if (!response.ok || !payload.state) throw new Error(payload.error || "Không lưu được tiến độ từ.");
      setSrsStates((current) => ({ ...current, [vocabularyId]: payload.state as VocabularySrsState }));
      setNotice(update.rating ? `Đã xếp lịch ôn: ${update.rating}.` : update.bookmarked ? "Đã bookmark từ." : "Đã bỏ bookmark.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không lưu được tiến độ từ.");
    } finally {
      setSavingWord(null);
    }
  };

  const addToCollection = async (vocabularyId: string) => {
    if (!selectedCollectionId) { setNotice("Hãy tạo một bộ từ cá nhân trước."); goTo("Bộ từ cá nhân"); return; }
    setSavingWord(vocabularyId);
    const response = await apiFetch(`/api/collections/${selectedCollectionId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vocabularyId }) });
    const payload = await response.json();
    setSavingWord(null);
    setNotice(response.ok ? "Đã thêm từ vào bộ cá nhân." : payload.error || "Không thêm được từ vào bộ.");
  };

  return <section className={styles.workspace}>
    <button className={styles.catalogBack} onClick={() => goTo("Học tập")}>← Học tập</button>
    <ScreenIntro eyebrow={isVocabulary ? "VOCABULARY" : "GRAMMAR"} title={isVocabulary ? "Kho từ vựng tiếng Hàn" : "Kho ngữ pháp TOPIK"} description={isVocabulary ? `${total.toLocaleString("vi-VN")} mục trong từ điển riêng của bạn.` : `${total.toLocaleString("vi-VN")} mẫu câu trong kho học riêng của bạn.`} />
    <div className={styles.catalogToolbar}>
      <label><span className={styles.srOnly}>{isVocabulary ? "Tìm từ vựng" : "Tìm ngữ pháp"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVocabulary ? "Tìm từ tiếng Hàn, ví dụ: 가다" : "Tìm mẫu ngữ pháp, ví dụ: -기 위해"} /><b>⌕</b></label>
      <div className={styles.filterRow}>{["Tất cả", "TOPIK I", "TOPIK II", "Chưa phân cấp"].map((item) => <button key={item} className={level === item ? styles.filterActive : ""} onClick={() => setLevel(item)}>{item}</button>)}</div>
    </div>
    {isVocabulary && <div className={styles.vocabularyActionsBar}><button onClick={() => goTo("Bộ từ cá nhân")}>▥ Bộ từ của tôi</button><label><span>Thêm nhanh vào</span><select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)}><option value="">Chưa có bộ từ</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label></div>}
    {error && <p className={styles.catalogError} role="alert">{error}</p>}
    {loading ? <div className={styles.catalogState}>Đang mở kho dữ liệu…</div> : items.length === 0 ? <div className={styles.catalogState}>Không tìm thấy mục phù hợp.</div> : <div className={styles.catalogList}>
      {items.map((rawItem) => isVocabulary ? (() => {
        const item = rawItem as VocabularyCatalogItem;
        const state = srsStates[item.id];
        return <article key={item.id}><div className={styles.catalogItemTop}><span className={styles.catalogGlyph}>가</span><div><h2>{item.lemma}{item.hanja ? <small> · {item.hanja}</small> : null}</h2><p>{item.meaning_vi || "Chưa có nghĩa tiếng Việt"}</p></div><span className={item.topik_level === "TOPIK I" ? styles.levelOne : styles.levelTwo}>{item.topik_level || item.nikl_level || "NIKL"}</span></div><div className={styles.catalogMeta}><span>{item.part_of_speech || "Từ vựng"}</span>{item.frequency_rank ? <span>Tần suất #{item.frequency_rank.toLocaleString("vi-VN")}</span> : null}<span>{state?.status === "due" ? "Cần ôn" : state?.status === "mastered" ? "Đã nhớ" : state?.status === "hard" ? "Khó" : state ? "Đang học" : "Chưa học"}</span></div>{item.explanation_ko ? <p className={styles.catalogExplanation}>{item.explanation_ko}</p> : null}<div className={styles.wordStudyActions}><button disabled={savingWord === item.id} onClick={() => void saveSrs(item.id, { bookmarked: !state?.bookmarked })}>{state?.bookmarked ? "★ Đã lưu" : "☆ Bookmark"}</button><button disabled={savingWord === item.id} onClick={() => void addToCollection(item.id)}>＋ Bộ từ</button><div><button disabled={savingWord === item.id} onClick={() => void saveSrs(item.id, { rating: "again" })}>Lại</button><button disabled={savingWord === item.id} onClick={() => void saveSrs(item.id, { rating: "hard" })}>Khó</button><button disabled={savingWord === item.id} onClick={() => void saveSrs(item.id, { rating: "good" })}>Tốt</button><button disabled={savingWord === item.id} onClick={() => void saveSrs(item.id, { rating: "easy" })}>Dễ</button></div></div></article>;
      })() : (() => {
        const item = rawItem as GrammarCatalogItem;
        const example = Array.isArray(item.examples) ? item.examples[0] : undefined;
        return <article key={item.id}><div className={styles.catalogItemTop}><span className={styles.catalogGlyph}>文</span><div><h2>{item.pattern}</h2><p>{item.meaning_vi || "Chưa có nghĩa tiếng Việt"}</p></div><span className={item.topik_level === "TOPIK I" ? styles.levelOne : styles.levelTwo}>{item.topik_level || "Chưa phân cấp"}</span></div>{item.usage_vi ? <p className={styles.catalogExplanation}>{item.usage_vi}</p> : null}{example?.ko ? <div className={styles.catalogExample}><b>{example.ko}</b>{example.vi ? <span>{example.vi}</span> : null}</div> : null}<div className={styles.catalogMeta}><span>Độ khó {item.difficulty || 1}/5</span></div></article>;
      })())}
    </div>}
    {!loading && items.length < total && <button className={styles.loadMoreButton} disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Đang tải…" : `Tải thêm · đang xem ${items.length.toLocaleString("vi-VN")}/${total.toLocaleString("vi-VN")}`}</button>}
  </section>;
}

function PersonalCollectionsScreen({ goTo, setNotice }: { goTo: (screen: Screen) => void; setNotice: (message: string) => void }) {
  const [collections, setCollections] = useState<VocabularyCollection[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [items, setItems] = useState<VocabularyCollectionItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [mode, setMode] = useState<"list" | "flashcard" | "quiz">("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quizChoice, setQuizChoice] = useState<string | null>(null);
  const selected = collections.find((collection) => collection.id === selectedId);
  const currentItem = items[cardIndex % Math.max(1, items.length)];

  const reloadCollections = async (preferredId?: string) => {
    const response = await apiFetch("/api/collections");
    const payload = await response.json();
    if (!response.ok) { setNotice(payload.error || "Không tải được bộ từ."); return; }
    const next = (payload.collections || []) as VocabularyCollection[];
    setCollections(next);
    setSelectedId((current) => preferredId || (next.some((item) => item.id === current) ? current : next[0]?.id || ""));
  };

  useEffect(() => { void reloadCollections(); }, []);

  useEffect(() => {
    if (!selectedId) { setItems([]); return; }
    let active = true;
    void apiFetch(`/api/collections/${selectedId}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload?.items) { setItems(payload.items as VocabularyCollectionItem[]); setCardIndex(0); setFlipped(false); setQuizChoice(null); } })
      .catch(() => undefined);
    return () => { active = false; };
  }, [selectedId]);

  const createCollection = async () => {
    if (!newTitle.trim()) { setNotice("Hãy nhập tên bộ từ."); return; }
    const response = await apiFetch("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle, visibility: "PRIVATE" }) });
    const payload = await response.json();
    if (!response.ok || !payload.collection) { setNotice(payload.error || "Không tạo được bộ từ."); return; }
    setNewTitle("");
    await reloadCollections(payload.collection.id);
    setNotice("Đã tạo bộ từ riêng tư.");
  };

  const renameCollection = async () => {
    if (!selected) return;
    const title = window.prompt("Tên mới cho bộ từ", selected.title)?.trim();
    if (!title || title === selected.title) return;
    const response = await apiFetch(`/api/collections/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const payload = await response.json();
    if (response.ok) { await reloadCollections(selected.id); setNotice("Đã đổi tên bộ từ."); }
    else setNotice(payload.error || "Không đổi được tên bộ từ.");
  };

  const updateVisibility = async (visibility: VocabularyCollection["visibility"]) => {
    if (!selected) return;
    const response = await apiFetch(`/api/collections/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility }) });
    const payload = await response.json();
    if (response.ok) { await reloadCollections(selected.id); setNotice(visibility === "PRIVATE" ? "Bộ từ chỉ mình bạn xem." : "Đã bật chia sẻ bộ từ."); }
    else setNotice(payload.error || "Không đổi được quyền xem.");
  };

  const deleteCollection = async () => {
    if (!selected || !window.confirm(`Xóa bộ “${selected.title}”? Từ gốc trong kho vẫn được giữ.`)) return;
    const response = await apiFetch(`/api/collections/${selected.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (response.ok) { await reloadCollections(); setNotice("Đã xóa bộ từ; kho từ gốc không bị ảnh hưởng."); }
    else setNotice(payload.error || "Không xóa được bộ từ.");
  };

  const removeWord = async (item: VocabularyCollectionItem) => {
    const response = await apiFetch(`/api/collections/${item.collectionId}/items/${item.vocabularyId}`, { method: "DELETE" });
    const payload = await response.json();
    if (response.ok) { setItems((current) => current.filter((word) => word.vocabularyId !== item.vocabularyId)); setNotice("Đã bỏ từ khỏi bộ."); }
    else setNotice(payload.error || "Không bỏ được từ khỏi bộ.");
  };

  const rateCard = async (rating: "again" | "hard" | "good" | "easy") => {
    if (!currentItem) return;
    const endpoint = currentItem.vocabulary.source === "topik-master"
      ? "/api/topik-master/vocabulary-srs"
      : `/api/collections/${currentItem.collectionId}/progress/${currentItem.vocabularyId}`;
    const response = await apiFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vocabularyId: currentItem.vocabularyId, rating }) });
    const payload = await response.json();
    if (!response.ok) { setNotice(payload.error || "Không lưu được lượt ôn."); return; }
    setNotice(`Đã lưu ${rating}; lịch ôn tiếp theo đã cập nhật.`);
    setCardIndex((index) => (index + 1) % Math.max(1, items.length));
    setFlipped(false);
    setQuizChoice(null);
  };

  const quizOptions = currentItem
    ? [currentItem, ...items.filter((item) => item.vocabularyId !== currentItem.vocabularyId)].slice(0, 4).map((item) => item.vocabulary.meaning || "Chưa có nghĩa")
    : [];

  return <section className={styles.workspace}>
    <button className={styles.catalogBack} onClick={() => goTo("Vocabulary")}>← Kho từ vựng</button>
    <ScreenIntro eyebrow="PERSONAL VOCABULARY" title="Bộ từ của tôi" description="Tạo collection, học flashcard, làm quiz và đồng bộ lịch ôn SRS." />
    <div className={styles.collectionCreate}><input value={newTitle} maxLength={120} onChange={(event) => setNewTitle(event.target.value)} placeholder="Ví dụ: 🔥 TOPIK II từ hay gặp" onKeyDown={(event) => { if (event.key === "Enter") void createCollection(); }} /><button onClick={() => void createCollection()}>＋ Tạo bộ riêng tư</button></div>
    <div className={styles.collectionsWorkspace}>
      <aside className={styles.collectionRail}>{collections.length ? collections.map((collection) => <button key={collection.id} className={selectedId === collection.id ? styles.collectionActive : ""} onClick={() => setSelectedId(collection.id)}><b>{collection.title}</b><span>{collection.visibility === "PRIVATE" ? "Chỉ mình tôi" : collection.visibility === "UNLISTED" ? "Có link mới xem" : "Công khai"}</span></button>) : <p>Chưa có bộ từ. Tạo bộ đầu tiên ở trên nhé.</p>}</aside>
      <div className={styles.collectionPanel}>{selected ? <>
        <div className={styles.collectionHeader}><div><h2>{selected.title}</h2><p>{items.length} từ · {selected.visibility}</p></div><div><button onClick={() => void renameCollection()}>Đổi tên</button><select value={selected.visibility} onChange={(event) => void updateVisibility(event.target.value as VocabularyCollection["visibility"])}><option value="PRIVATE">Chỉ mình tôi</option><option value="UNLISTED">Chia sẻ bằng link</option><option value="PUBLIC">Công khai</option></select><button onClick={() => void deleteCollection()}>Xóa bộ</button></div></div>
        <div className={styles.collectionModes}><button className={mode === "list" ? styles.filterActive : ""} onClick={() => setMode("list")}>Danh sách</button><button className={mode === "flashcard" ? styles.filterActive : ""} onClick={() => { setMode("flashcard"); setFlipped(false); }}>Flashcard</button><button className={mode === "quiz" ? styles.filterActive : ""} onClick={() => { setMode("quiz"); setQuizChoice(null); }}>Quiz</button></div>
        {!items.length ? <div className={styles.catalogState}>Bộ này chưa có từ. Mở Kho từ vựng và nhấn “＋ Bộ từ”.</div> : mode === "list" ? <div className={styles.collectionWordList}>{items.map((item) => <article key={item.vocabularyId}><div><b>{item.vocabulary.korean || "Từ vựng"}</b><span>{item.vocabulary.meaning || "Chưa có nghĩa"}</span></div><small>{item.vocabulary.level || item.vocabulary.partOfSpeech || "TOPIK Master"}</small><button onClick={() => void removeWord(item)}>Bỏ khỏi bộ</button></article>)}</div> : mode === "flashcard" && currentItem ? <div className={styles.flashcardStudy}><button className={styles.flashcardFace} onClick={() => setFlipped((value) => !value)}><small>{cardIndex + 1}/{items.length} · chạm để lật</small><strong>{flipped ? currentItem.vocabulary.meaning || "Chưa có nghĩa" : currentItem.vocabulary.korean || "Từ vựng"}</strong><span>{flipped ? currentItem.vocabulary.korean : currentItem.vocabulary.pronunciation}</span></button><div className={styles.srsRatingButtons}><button onClick={() => void rateCard("again")}>Lại</button><button onClick={() => void rateCard("hard")}>Khó</button><button onClick={() => void rateCard("good")}>Tốt</button><button onClick={() => void rateCard("easy")}>Dễ</button></div></div> : currentItem ? <div className={styles.collectionQuiz}><small>Câu {cardIndex + 1}/{items.length}</small><h2>{currentItem.vocabulary.korean}</h2><p>Chọn nghĩa đúng</p><div>{quizOptions.map((option) => <button key={option} className={quizChoice === option ? (option === currentItem.vocabulary.meaning ? styles.quizCorrect : styles.quizWrong) : ""} onClick={() => setQuizChoice(option)}>{option}</button>)}</div>{quizChoice && <button className={styles.catalogPrimary} onClick={() => { setCardIndex((index) => (index + 1) % items.length); setQuizChoice(null); }}>Câu tiếp theo →</button>}</div> : null}
      </> : <div className={styles.catalogState}>Chọn hoặc tạo một bộ từ.</div>}</div>
    </div>
  </section>;
}

function QuestionBankScreen({ goTo, initialSection = "Tất cả" }: { goTo: (screen: Screen) => void; initialSection?: string }) {
  const pageSize = 24;
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [examType, setExamType] = useState("Tất cả");
  const [section, setSection] = useState(initialSection);
  const [questionType, setQuestionType] = useState("Tất cả");
  const [difficulty, setDifficulty] = useState("Tất cả");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const paramsFor = (offset: number) => {
    const params = new URLSearchParams({ resource: "questions", limit: String(pageSize), offset: String(offset) });
    if (query.trim()) params.set("search", query.trim());
    if (examType !== "Tất cả") params.set("examType", examType);
    if (section !== "Tất cả") params.set("section", section.toLowerCase());
    if (questionType !== "Tất cả") params.set("questionType", questionType);
    if (difficulty !== "Tất cả") params.set("difficulty", difficulty);
    return params;
  };

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void apiFetch(`/api/topik-master/catalog?${paramsFor(0).toString()}`)
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Không tải được ngân hàng câu hỏi.");
          if (active) {
            setItems(payload.data || []);
            setTotal(Number(payload.total || 0));
            setExpanded(null);
          }
        })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Không tải được ngân hàng câu hỏi."); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  // paramsFor is intentionally derived from these filter states.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, examType, questionType, query, section]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const response = await apiFetch(`/api/topik-master/catalog?${paramsFor(items.length).toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải thêm được câu hỏi.");
      setItems((current) => [...current, ...(payload.data || [])]);
      setTotal(Number(payload.total || total));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải thêm được câu hỏi.");
    } finally {
      setLoadingMore(false);
    }
  };

  const clearFilters = () => {
    setQuery(""); setExamType("Tất cả"); setSection("Tất cả"); setQuestionType("Tất cả"); setDifficulty("Tất cả");
  };

  return <section className={styles.workspace}>
    <button className={styles.catalogBack} onClick={() => goTo("TOPIK Practice")}>← TOPIK Practice</button>
    <ScreenIntro eyebrow="QUESTION BANK" title="Ngân hàng câu hỏi TOPIK" description={`${total.toLocaleString("vi-VN")} câu đã xuất bản, có nguồn và trạng thái quyền sử dụng rõ ràng.`} />
    <div className={styles.questionBankToolbar}>
      <label className={styles.questionSearch}><span className={styles.srOnly}>Tìm câu hỏi</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm trong đề bài, đoạn văn hoặc transcript…" /></label>
      <select aria-label="Loại kỳ thi" value={examType} onChange={(event) => setExamType(event.target.value)}>{["Tất cả", "TOPIK I", "TOPIK II"].map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Kỹ năng" value={section} onChange={(event) => setSection(event.target.value)}>{["Tất cả", "Listening", "Reading", "Writing"].map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Dạng câu" value={questionType} onChange={(event) => setQuestionType(event.target.value)}>{["Tất cả", "multiple-choice", "response", "place", "next-action", "detail-match", "vocabulary-blank", "grammar-blank", "main-idea", "context-blank", "inference", "sentence-order", "headline"].map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Độ khó" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>{["Tất cả", "1", "2", "3", "4", "5"].map((item) => <option key={item} value={item}>{item === "Tất cả" ? item : `Độ khó ${item}`}</option>)}</select>
      <button onClick={clearFilters}>Xóa lọc</button>
    </div>
    <div className={styles.questionBankSummary}><span><b>{items.length}</b>/{total.toLocaleString("vi-VN")} câu đang hiển thị</span><span><i className={styles.sourceOriginal} /> Tự biên soạn</span><span><i className={styles.sourceLicensed} /> Được cấp quyền</span></div>
    {loading ? <div className={styles.catalogState}>Đang tải ngân hàng câu hỏi…</div> : error ? <div className={styles.catalogState}><b>Chưa thể tải dữ liệu</b><span>{error}</span></div> : items.length === 0 ? <div className={styles.catalogState}><b>Không có câu phù hợp.</b><span>Hãy thử xóa bớt bộ lọc.</span></div> : <div className={styles.questionBankList}>{items.map((item) => {
      const open = expanded === item.id;
      return <article key={item.id} className={open ? styles.questionCardOpen : ""}>
        <button className={styles.questionCardHead} aria-expanded={open} onClick={() => setExpanded(open ? null : item.id)}>
          <span className={item.exam_type === "TOPIK I" ? styles.levelOne : styles.levelTwo}>{item.exam_type}</span>
          <span className={styles.questionSection}>{item.section}</span>
          <span className={styles.questionNumber}>#{item.question_number || "—"}</span>
          <span className={styles.questionDifficulty}>Khó {item.difficulty}/5</span>
          <b>{item.question_type}</b><em>{open ? "Thu gọn ↑" : "Xem đáp án ↓"}</em>
        </button>
        <div className={styles.questionCardBody}>
          <h2>{item.question_text}</h2>
          {item.passage && <p className={styles.bankPassage}>{item.passage}</p>}
          {item.transcript && <details className={styles.bankTranscript}><summary>Transcript</summary><p>{item.transcript}</p></details>}
          {item.audio_url && <audio controls preload="none" src={item.audio_url}>Trình duyệt không hỗ trợ audio.</audio>}
          <ol>{item.options.map((option, index) => <li key={`${item.id}-${index}`} className={open && index === item.correct_answer_index ? styles.correctOption : ""}><span>{index + 1}</span>{option}</li>)}</ol>
        </div>
        {open && <div className={styles.questionAnswer}>
          <div><span>Đáp án đúng</span><strong>{item.correct_answer_index == null ? "Tự luận" : `${item.correct_answer_index + 1}. ${item.correct_answer || ""}`}</strong></div>
          <div><span>Giải thích tiếng Việt</span><p>{item.explanation_vi || "Chưa có giải thích."}</p></div>
          {item.explanation_ko && <div><span>한국어 해설</span><p>{item.explanation_ko}</p></div>}
          {(item.vocabulary.length > 0 || item.grammar.length > 0) && <div className={styles.questionLinks}><span>Liên kết học tập</span><p>{item.vocabulary.map((term) => <i key={term.id}>{term.lemma}</i>)}{item.grammar.map((term) => <i key={term.id}>{term.pattern}</i>)}</p></div>}
          <div className={styles.questionTags}>{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          <small>Nguồn: {item.source_ref} · {item.rights_status === "original" ? "Nội dung tự biên soạn" : item.rights_status === "licensed" ? "Có quyền sử dụng" : "Cần kiểm tra quyền"}</small>
        </div>}
      </article>;
    })}</div>}
    {!loading && items.length < total && <button className={styles.loadMoreButton} disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Đang tải…" : "Tải thêm câu hỏi"}</button>}
  </section>;
}

function PracticeLibrary({ onStart, onOpenReading, onOpenWriting, onOpenBank }: { onStart: (examKey?: string, mode?: "practice" | "timed") => Promise<void>; onOpenReading: () => void; onOpenWriting: () => void; onOpenBank: () => void }) {
  const [filter, setFilter] = useState("Tất cả");
  const [mode, setMode] = useState<"practice" | "timed">("practice");
  const [starting, setStarting] = useState<string | null>(null);
  const [exams, setExams] = useState<CatalogExam[]>(fallbackCatalogExams);

  useEffect(() => {
    let active = true;
    void apiFetch("/api/topik-master/catalog?resource=exams&limit=50")
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active || !payload?.data?.length) return;
        const realExams = payload.data as CatalogExam[];
        setExams([...realExams, ...fallbackCatalogExams.filter((fallback) => !realExams.some((exam) => exam.external_key === fallback.external_key))]);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const visibleExams = exams.filter((exam) => {
    const skill = String(exam.metadata?.skill || (exam.title.toLowerCase().includes("listening") ? "Listening" : exam.title.toLowerCase().includes("reading") ? "Reading" : exam.title.toLowerCase().includes("writing") || exam.title.includes("câu 54") ? "Writing" : ""));
    return filter === "Tất cả" || exam.exam_type === filter || skill.toLowerCase() === filter.toLowerCase();
  });
  const start = async (exam: CatalogExam) => {
    setStarting(exam.external_key);
    await onStart(exam.external_key, mode);
    setStarting(null);
  };
  return <section className={styles.workspace}><ScreenIntro eyebrow="TOPIK PRACTICE" title="Kho đề luyện thi" description={`${visibleExams.length} bộ đề phù hợp với bộ lọc hiện tại.`} /><div className={styles.practiceModeSwitch}><button className={mode === "practice" ? styles.filterActive : ""} onClick={() => setMode("practice")}><b>Practice</b><span>Có transcript, dịch, tra từ và giảm tốc</span></button><button className={mode === "timed" ? styles.filterActive : ""} onClick={() => setMode("timed")}><b>Exam</b><span>Ẩn trợ giúp, tốc độ 1× và timer thật</span></button></div><div className={styles.practiceLibraryActions}><button onClick={onOpenBank}>▤ Mở ngân hàng câu hỏi</button><span>Lọc từng câu theo dạng, độ khó và kỹ năng</span></div><div className={styles.filterRow}>{["Tất cả", "TOPIK I", "TOPIK II", "Listening", "Reading", "Writing"].map((item) => <button key={item} className={filter === item ? styles.filterActive : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className={styles.examLibrary}>{visibleExams.map((exam) => { const skill = String(exam.metadata?.skill || (exam.title.toLowerCase().includes("listening") ? "Listening" : exam.title.toLowerCase().includes("reading") ? "Reading" : exam.title.toLowerCase().includes("writing") || exam.title.includes("câu 54") ? "Writing" : "Tổng hợp")); const isLocalStub = exam.external_key.startsWith("local-"); const open = () => { if (isLocalStub && skill === "Writing") onOpenWriting(); else if (isLocalStub && skill === "Reading") onOpenReading(); else void start(exam); }; return <article key={exam.external_key}><span className={exam.exam_type === "TOPIK I" ? styles.levelOne : styles.levelTwo}>{exam.exam_type}</span><h2>{exam.title}</h2><p>{exam.duration_minutes} phút · {skill}</p><div><small>{String(exam.metadata?.difficulty || "Thích ứng")}</small><b>{isLocalStub ? "Khung dữ liệu" : mode === "practice" ? "Luyện có trợ giúp" : "Thi mô phỏng"}</b></div><button disabled={starting !== null} onClick={open}>{starting === exam.external_key ? "Đang chuẩn bị..." : isLocalStub ? "Mở khung" : mode === "practice" ? "Bắt đầu luyện" : "Bắt đầu thi"} →</button></article>; })}</div></section>;
}

function MistakesScreen({ goTo, fallbackMistakes, setNotice }: { goTo: (screen: Screen) => void; fallbackMistakes: ResultMistake[]; setNotice: (message: string) => void }) {
  const [filter, setFilter] = useState("Tất cả");
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [explanations, setExplanations] = useState<Record<string, AiQuestionExplanation>>({});
  const [loadingAi, setLoadingAi] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const skill = filter === "Tất cả" ? "" : `?skill=${filter.toLowerCase()}`;
    void apiFetch(`/api/topik-master/mistakes${skill}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active) return;
        if (payload?.mistakes) setMistakes(payload.mistakes as MistakeRecord[]);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [filter]);

  const localRecords: MistakeRecord[] = fallbackMistakes.map((mistake) => ({ id: mistake.id, question_key: mistake.questionKey, skill: mistake.skill, subskill: mistake.subskill, prompt: mistake.prompt, selected_answer: mistake.selectedAnswer, selected_answer_index: mistake.selectedAnswerIndex, correct_answer: mistake.correctAnswer, correct_answer_index: mistake.correctAnswerIndex, explanation: mistake.explanation }));
  const source = mistakes.length ? mistakes : localRecords;
  const visibleMistakes = source.filter((mistake) => filter === "Tất cả" || mistake.skill.toLowerCase() === filter.toLowerCase());

  const explain = async (mistake: MistakeRecord) => {
    setLoadingAi(mistake.question_key);
    const response = await apiFetch("/api/topik-master/ai/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionKey: mistake.question_key, selectedAnswerIndex: mistake.selected_answer_index }) });
    const payload = await response.json();
    if (response.ok && payload.explanation) {
      setExplanations((current) => ({ ...current, [mistake.question_key]: payload.explanation as AiQuestionExplanation }));
      setNotice(`Đã tạo giải thích bằng ${payload.provider}.`);
    } else setNotice(payload.error || "Chưa thể tạo giải thích AI.");
    setLoadingAi(null);
  };

  const rate = async (mistake: MistakeRecord, rating: "again" | "hard" | "good" | "easy") => {
    if (!mistake.id) { setNotice("Lượt ôn mẫu chưa đồng bộ vào SRS."); return; }
    const response = await apiFetch("/api/topik-master/mistakes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mistake.id, rating }) });
    const payload = await response.json();
    setNotice(response.ok ? `Đã xếp lịch ôn tiếp theo: ${new Intl.DateTimeFormat("vi-VN").format(new Date(payload.nextReviewAt))}.` : payload.error || "Chưa cập nhật được SRS.");
  };

  return <section className={styles.workspace}><ScreenIntro eyebrow="오답노트" title="Sổ câu sai" description={`${visibleMistakes.length} câu cần ôn trong nhóm ${filter}.`} /><div className={styles.filterRow}>{["Tất cả", "Listening", "Reading", "Writing"].map((item) => <button key={item} className={filter === item ? styles.filterActive : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className={styles.mistakeList}>{visibleMistakes.length ? visibleMistakes.map((mistake, index) => { const ai = explanations[mistake.question_key]; return <article key={`${mistake.question_key}-${index}`}><div><span>{mistake.skill}</span><b>Câu {index + 1}</b><small>{mistake.next_review_at ? `Ôn ${new Intl.DateTimeFormat("vi-VN").format(new Date(mistake.next_review_at))}` : "Ôn lại hôm nay"}</small></div><h2>{mistake.prompt}</h2><dl><div><dt>Đã chọn</dt><dd>{mistake.selected_answer}</dd></div><div><dt>Đáp án đúng</dt><dd>{mistake.correct_answer}</dd></div></dl><details><summary>Xem giải thích</summary><p>{mistake.explanation}</p>{ai && <div className={styles.aiExplanation}><strong>AI Coach · {ai.errorType}</strong><p>{ai.explanationVi}</p><p><b>Bẫy:</b> {ai.trap}</p><p><b>Mẹo:</b> {ai.topikTip}</p><div><b>Câu tương tự</b><p>{ai.similarQuestion.prompt}</p>{ai.similarQuestion.options.map((option, optionIndex) => <span key={option}>{optionIndex + 1}. {option}</span>)}</div></div>}<button disabled={loadingAi === mistake.question_key} onClick={() => void explain(mistake)}>{loadingAi === mistake.question_key ? "AI đang phân tích..." : "Giải thích sâu + câu tương tự"}</button></details><div className={styles.reviewRatings}><span>Đánh giá lượt ôn:</span><button onClick={() => void rate(mistake, "again")}>Lại</button><button onClick={() => void rate(mistake, "hard")}>Khó</button><button onClick={() => void rate(mistake, "good")}>Tốt</button><button onClick={() => void rate(mistake, "easy")}>Dễ</button></div></article>; }) : <article><h2>Chưa có câu sai trong bộ lọc này.</h2><p>Hoàn thành một bài luyện để Study Brain tạo lịch ôn.</p></article>}</div><button className={styles.retryButton} onClick={() => goTo("Làm bài")}>Làm lại {visibleMistakes.length} câu sai</button></section>;
}

function CommunityScreen() {
  const [tab, setTab] = useState("Bài đăng");
  const posts = [{ category: "Bộ từ vựng", author: "Minh Anh", title: "Mẹo nhớ từ vựng TOPIK II theo chủ đề", meta: "24 bình luận · 86 lượt thích" }, { category: "Study plan", author: "Hải Yến", title: "Chia sẻ study plan 8 tuần lên cấp 5", meta: "18 bình luận · 64 lượt thích" }, { category: "Q&A", author: "Tuấn", title: "Q&A: phân biệt -도록 và -게", meta: "12 câu trả lời · Đã giải đáp" }];
  const visiblePosts = tab === "Bài đăng" ? posts : posts.filter((post) => post.category === tab);
  return <section className={styles.workspace}><ScreenIntro eyebrow="COMMUNITY" title="Học cùng cộng đồng" description={`Đang xem ${tab.toLowerCase()} được chia sẻ.`} /><div className={styles.communityTabs}>{["Bài đăng", "Bộ từ vựng", "Study plan", "Q&A"].map((item) => <button key={item} className={tab === item ? styles.filterActive : ""} onClick={() => setTab(item)}>{item}</button>)}</div><div className={styles.communityLayout}><div className={styles.postList}>{visiblePosts.map((post, index) => <article key={post.title}><div><span>{post.author.slice(0, 1)}</span><p><b>{post.author}</b><small>{index + 1} giờ trước · {post.category}</small></p></div><h2>{post.title}</h2><p>{index === 0 ? "Mình gom nội dung theo nhóm dễ nhớ và chia sẻ để mọi người cùng học nhé!" : "Nội dung mẫu của cộng đồng sẽ được nối ở bước dữ liệu."}</p><small>{post.meta}</small></article>)}</div><aside className={styles.sharedCollections}><strong>Nổi bật tuần này</strong><button onClick={() => setTab("Bộ từ vựng")}>📚 500 từ TOPIK II hay gặp</button><button onClick={() => setTab("Study plan")}>🗓 Kế hoạch cấp 6 trong 8 tuần</button><button onClick={() => setTab("Q&A")}>💬 Hỏi đáp ngữ pháp mỗi ngày</button></aside></div></section>;
}

function ProfileScreen({ goTo, profile, onSave }: { goTo: (screen: Screen) => void; profile: TopikMasterProfile; onSave: (profile: TopikMasterProfile) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(profile);

  const submit = async () => {
    setSaving(true);
    const saved = await onSave(draft);
    setSaving(false);
    if (saved) setEditing(false);
  };

  const toggleSkill = (skill: string) => setDraft((current) => ({
    ...current,
    preferred_skills: current.preferred_skills.includes(skill)
      ? current.preferred_skills.filter((item) => item !== skill)
      : [...current.preferred_skills, skill],
  }));

  return <section className={styles.workspace}>
    <div className={styles.profileHero}><span className={styles.profileAvatar}>{profile.display_name.slice(0, 1).toUpperCase()}</span><div><h1>{profile.display_name}</h1><p>Mục tiêu {profile.target_level}</p></div><button onClick={() => { if (!editing) setDraft(profile); setEditing((value) => !value); }}>{editing ? "Đóng" : "Chỉnh sửa"}</button></div>
    {editing && <div className={styles.profileForm}>
      <label><span>Tên hiển thị</span><input value={draft.display_name} maxLength={80} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} /></label>
      <label><span>Trình độ hiện tại</span><select value={draft.current_level} onChange={(event) => setDraft({ ...draft, current_level: event.target.value })}>{topikLevels.map((level) => <option key={level}>{level}</option>)}</select></label>
      <label><span>Mục tiêu</span><select value={draft.target_level} onChange={(event) => setDraft({ ...draft, target_level: event.target.value })}>{topikLevels.map((level) => <option key={level}>{level}</option>)}</select></label>
      <label><span>Ngày thi</span><input type="date" value={draft.exam_date || ""} onChange={(event) => setDraft({ ...draft, exam_date: event.target.value || null })} /></label>
      <label><span>Phút học mỗi tuần</span><input type="number" min={30} max={10080} value={draft.weekly_study_minutes} onChange={(event) => setDraft({ ...draft, weekly_study_minutes: Number(event.target.value) })} /></label>
      <fieldset><legend>Kỹ năng ưu tiên</legend><div>{["listening", "reading", "writing", "vocabulary", "grammar"].map((skill) => <button type="button" key={skill} className={draft.preferred_skills.includes(skill) ? styles.selectedSkill : ""} onClick={() => toggleSkill(skill)}>{skill}</button>)}</div></fieldset>
      <button className={styles.saveProfile} onClick={submit} disabled={saving}>{saving ? "Đang lưu..." : "Lưu hồ sơ"}</button>
    </div>}
    <div className={styles.profileStats}><article><strong>{profile.current_streak}</strong><span>Streak</span></article><article><strong>{Math.round(profile.weekly_study_minutes / 60)}h</strong><span>Mỗi tuần</span></article><article><strong>{profile.longest_streak}</strong><span>Streak cao nhất</span></article></div>
    <div className={styles.profileMenu}><button onClick={() => goTo("Dashboard")}><span>▦</span><b>Dashboard</b><em>›</em></button><button onClick={() => goTo("Kết quả")}><span>✓</span><b>Kết quả học tập</b><em>›</em></button><button onClick={() => goTo("Kế hoạch")}><span>◎</span><b>Study Planner</b><em>›</em></button><button onClick={() => goTo("Cộng đồng")}><span>♧</span><b>Community</b><em>›</em></button></div>
  </section>;
}

export default function TopikMasterPage() {
  const [activeNav, setActiveNav] = useState<Screen>("Home");
  const [notice, setNotice] = useState("Hôm nay học nhẹ nhưng đều nhé!");
  const [lastResult, setLastResult] = useState<SessionResult>({ correct: 6, total: 8, score: 225, accuracy: 75, examTitle: "Bài mẫu Foundation", mistakes: [], persisted: false });
  const [profile, setProfile] = useState<TopikMasterProfile>(defaultProfile);
  const [dashboard, setDashboard] = useState<DashboardData>(fallbackDashboard);
  const [practiceSession, setPracticeSession] = useState<PracticeSession>(() => localPracticeSession());
  const [questionBankSection, setQuestionBankSection] = useState("Tất cả");

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiFetch("/api/topik-master/profile").then(async (response) => response.ok ? response.json() : null),
      apiFetch("/api/topik-master/dashboard").then(async (response) => response.ok ? response.json() : null),
      apiFetch("/api/topik-master/practice").then(async (response) => response.ok ? response.json() : null),
    ]).then(([profilePayload, dashboardPayload, practicePayload]) => {
      if (!active) return;
      if (profilePayload?.profile) setProfile(profilePayload.profile as TopikMasterProfile);
      if (dashboardPayload?.dashboard) setDashboard(dashboardPayload.dashboard as DashboardData);
      if (practicePayload?.session?.questions?.length) {
        setPracticeSession(practicePayload.session as PracticeSession);
        setNotice("Đã khôi phục phiên làm bài đang dở.");
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const goTo = (screen: Screen) => {
    setActiveNav(screen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openQuestionBank = (section = "Tất cả") => {
    setQuestionBankSection(section);
    goTo("Ngân hàng câu hỏi");
  };

  const isMobileActive = (screen: Screen) => {
    if (screen === "Home") return activeNav === "Home" || activeNav === "Dashboard";
    if (screen === "Học tập") return activeNav === "Học tập" || activeNav === "Reading" || activeNav === "Vocabulary" || activeNav === "Bộ từ cá nhân" || activeNav === "Grammar";
    if (screen === "TOPIK Practice") return ["TOPIK Practice", "Ngân hàng câu hỏi", "Làm bài", "Viết bài", "Kết quả"].includes(activeNav);
    return activeNav === screen;
  };

  const completePractice = (result: SessionResult) => {
    setLastResult(result);
    setNotice(`Đã chấm xong: ${result.correct}/${result.total} câu đúng.`);
    void apiFetch("/api/topik-master/dashboard")
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (payload?.dashboard) setDashboard(payload.dashboard as DashboardData); })
      .catch(() => undefined);
    goTo("Kết quả");
  };

  const startPractice = async (examKey = "tm-original-diagnostic-listening-001", mode: "practice" | "timed" = "practice") => {
    try {
      const response = await apiFetch("/api/topik-master/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examKey, mode }),
      });
      const payload = await response.json();
      if (response.ok && payload.session?.questions?.length) {
        setPracticeSession(payload.session as PracticeSession);
        setNotice(mode === "timed" ? "Chế độ Exam đã sẵn sàng: ẩn transcript, tốc độ 1×, tự nộp khi hết giờ." : "Chế độ Practice đã sẵn sàng với transcript, dịch và tra từ.");
      } else {
        setPracticeSession(localPracticeSession(mode));
        setNotice(payload.error ? `${payload.error} Đang mở bản local fallback.` : "Đang mở bản local fallback.");
      }
    } catch {
      setPracticeSession(localPracticeSession(mode));
      setNotice("Không thể nối Practice Engine; đang mở bản local fallback.");
    }
    goTo("Làm bài");
  };

  const saveProfile = async (nextProfile: TopikMasterProfile) => {
    try {
      const response = await apiFetch("/api/topik-master/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: nextProfile.display_name,
          currentLevel: nextProfile.current_level,
          targetLevel: nextProfile.target_level,
          examDate: nextProfile.exam_date,
          weeklyStudyMinutes: nextProfile.weekly_study_minutes,
          preferredSkills: nextProfile.preferred_skills,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.profile) {
        setNotice(payload.error || "Chưa thể lưu hồ sơ.");
        return false;
      }
      setProfile(payload.profile as TopikMasterProfile);
      setNotice("Đã lưu hồ sơ TOPIK Master.");
      return true;
    } catch {
      setNotice("Không thể kết nối để lưu hồ sơ.");
      return false;
    }
  };

  return (
    <main className={styles.page}>
      <a className={styles.skipLink} href="#topik-master-content">Bỏ qua điều hướng</a>
      <aside className={styles.sidebar}>
        <Brand />
        <nav className={styles.sideNav} aria-label="Điều hướng TOPIK Master">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={activeNav === item.label ? styles.activeNav : ""}
              aria-current={activeNav === item.label ? "page" : undefined}
              onClick={() => item.label === "Ngân hàng câu hỏi" ? openQuestionBank() : goTo(item.label)}
            >
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className={styles.premiumCard}>
          <span>♛</span>
          <strong>Premium</strong>
          <p>Mở khóa toàn bộ lộ trình cá nhân hóa</p>
        </div>
      </aside>

      <section className={styles.main}>
        <header className={styles.mobileHeader}>
          <Brand />
          <div className={styles.headerActions}><button aria-label="Thông báo">♢</button><span className={styles.avatar}>L</span></div>
        </header>

        <div className={styles.desktopTopbar}>
          <div><strong>Xin chào, {profile.display_name} 👋</strong><span>Chúc bạn một ngày học thật hiệu quả!</span></div>
          <div className={styles.headerActions}><button aria-label="Trợ giúp">?</button><button aria-label="Thông báo">♢</button><span className={styles.avatar}>L</span></div>
        </div>

        <div className={styles.content} id="topik-master-content" tabIndex={-1}>
          {activeNav === "Home" && <HomeScreen goTo={goTo} onStart={startPractice} />}
          {activeNav === "Dashboard" && <DashboardScreen goTo={goTo} notice={notice} setNotice={setNotice} dashboard={dashboard} profile={profile} />}
          {activeNav === "Học tập" && <StudyHub goTo={goTo} onStart={startPractice} />}
          {activeNav === "Reading" && <ReadingHub goTo={goTo} onOpenBank={() => openQuestionBank("Reading")} />}
          {activeNav === "Vocabulary" && <LearningCatalog kind="vocabulary" goTo={goTo} setNotice={setNotice} />}
          {activeNav === "Bộ từ cá nhân" && <PersonalCollectionsScreen goTo={goTo} setNotice={setNotice} />}
          {activeNav === "Grammar" && <LearningCatalog kind="grammar" goTo={goTo} setNotice={setNotice} />}
          {activeNav === "TOPIK Practice" && <PracticeLibrary onStart={startPractice} onOpenReading={() => goTo("Reading")} onOpenWriting={() => goTo("Viết bài")} onOpenBank={() => openQuestionBank()} />}
          {activeNav === "Ngân hàng câu hỏi" && <QuestionBankScreen goTo={goTo} initialSection={questionBankSection} />}
          {activeNav === "Làm bài" && <ListeningScreen key={practiceSession.id} session={practiceSession} setNotice={setNotice} onComplete={completePractice} />}
          {activeNav === "Viết bài" && <ExamScreen setNotice={setNotice} />}
          {activeNav === "Kết quả" && <ResultsScreen goTo={goTo} result={lastResult} />}
          {activeNav === "Ôn tập" && <MistakesScreen goTo={goTo} fallbackMistakes={lastResult.mistakes || []} setNotice={setNotice} />}
          {activeNav === "Kế hoạch" && <PlanScreen setNotice={setNotice} />}
          {activeNav === "Cộng đồng" && <CommunityScreen />}
          {activeNav === "Cá nhân" && <ProfileScreen goTo={goTo} profile={profile} onSave={saveProfile} />}
        </div>
      </section>

      <nav className={styles.bottomNav} aria-label="Điều hướng mobile">
        {[
          ["⌂", "Home", "Home"],
          ["▣", "Học", "Học tập"],
          ["▶", "TOPIK", "TOPIK Practice"],
          ["↻", "Ôn tập", "Ôn tập"],
          ["●", "Cá nhân", "Cá nhân"],
        ].map(([icon, label, screen]) => (
          <button key={label} aria-current={isMobileActive(screen as Screen) ? "page" : undefined} className={isMobileActive(screen as Screen) ? styles.activeBottom : ""} onClick={() => goTo(screen as Screen)}>
            <span>{icon}</span><small>{label}</small>
          </button>
        ))}
      </nav>
    </main>
  );
}
