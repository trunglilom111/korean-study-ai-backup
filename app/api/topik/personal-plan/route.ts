import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";
import {
  TOPIK_PERSONAL_ADMIN_EMAIL,
  TOPIK_TARGET_ACCURACY,
  emptyTopikDailyProgress,
  getDayNumber,
  getSeoulDate,
  getTopikPhase,
  isIsoDate,
  isTopikPersonalAdmin,
  type TopikDailyLesson,
  type TopikDailyProgress,
} from "@/utils/topik-personal-plan";

const skillTaskSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    question: { type: "string" },
    answerGuide: { type: "string" },
  },
  required: ["title", "content", "question", "answerGuide"],
};

const lessonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          korean: { type: "string" },
          meaning: { type: "string" },
          partOfSpeech: { type: "string" },
          exampleKorean: { type: "string" },
          exampleVietnamese: { type: "string" },
        },
        required: ["korean", "meaning", "partOfSpeech", "exampleKorean", "exampleVietnamese"],
      },
    },
    grammar: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          meaning: { type: "string" },
          usage: { type: "string" },
          exampleKorean: { type: "string" },
          exampleVietnamese: { type: "string" },
        },
        required: ["pattern", "meaning", "usage", "exampleKorean", "exampleVietnamese"],
      },
    },
    listening: skillTaskSchema,
    reading: skillTaskSchema,
    writing: skillTaskSchema,
  },
  required: ["title", "objective", "vocabulary", "grammar", "listening", "reading", "writing"],
};

const themes = [
  "sinh hoạt hằng ngày",
  "trường học và học tập",
  "công việc và lịch hẹn",
  "giao thông và chỉ đường",
  "mua sắm và dịch vụ",
  "sức khỏe và bệnh viện",
  "gia đình và quan hệ",
  "du lịch và trải nghiệm",
  "môi trường và đời sống đô thị",
  "văn hóa và truyền thông",
];

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function score(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : 0;
}

function normalizeProgress(value: unknown): TopikDailyProgress {
  const progress = asObject(value);
  return {
    vocabularyCompleted: stringArray(progress.vocabularyCompleted),
    grammarCompleted: stringArray(progress.grammarCompleted),
    listeningScore: score(progress.listeningScore),
    readingScore: score(progress.readingScore),
    writingCompleted: progress.writingCompleted === true,
  };
}

function normalizeLesson(value: unknown, vocabularyCount: number, grammarCount: number) {
  const lesson = asObject(value) as Partial<TopikDailyLesson>;
  if (!lesson.title || !lesson.objective || !Array.isArray(lesson.vocabulary) || !Array.isArray(lesson.grammar)) return null;
  if (!lesson.listening || !lesson.reading || !lesson.writing) return null;

  return {
    ...lesson,
    vocabulary: lesson.vocabulary.slice(0, vocabularyCount),
    grammar: lesson.grammar.slice(0, grammarCount),
  } as TopikDailyLesson;
}

async function generateLesson({
  dayNumber,
  studyDate,
  phase,
  phaseLabel,
  phaseTarget,
  previousVocabulary,
}: {
  dayNumber: number;
  studyDate: string;
  phase: string;
  phaseLabel: string;
  phaseTarget: string;
  previousVocabulary: string[];
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Thiếu GEMINI_API_KEY để tự tạo bài học TOPIK mỗi ngày.");

  const vocabularyCount = 10 + (dayNumber % 6);
  const grammarCount = 2 + (dayNumber % 2);
  const theme = themes[(dayNumber - 1) % themes.length];
  const previousList = previousVocabulary.slice(0, 100).join(", ");
  const firstMonth = dayNumber <= 30;

  const prompt = `
Bạn là giáo viên cá nhân luyện TOPIK cho một người Việt tự học, không có giáo viên trực tiếp.

Tạo BÀI HỌC NGÀY ${dayNumber} (${studyDate}).
Lộ trình hiện tại: ${phaseLabel}.
Mục tiêu kỹ năng: ${phaseTarget}.
Chủ đề hôm nay: ${theme}.

YÊU CẦU BẮT BUỘC:
- Tạo chính xác ${vocabularyCount} từ/cụm từ tiếng Hàn mới, phổ biến và có ích cho TOPIK.
- Tạo chính xác ${grammarCount} mẫu ngữ pháp.
- Từ vựng phải ở mức ${firstMonth ? "sơ cấp cao, làm cầu nối lên trung cấp nhưng vẫn phù hợp TOPIK I cấp 2" : "trung cấp phù hợp TOPIK II cấp 3–4"}.
- Không lặp từ trong danh sách cần tránh: ${previousList || "chưa có"}.
- Mỗi từ có nghĩa tiếng Việt tự nhiên, loại từ và một câu ví dụ ngắn.
- Mỗi ngữ pháp có nghĩa, cách dùng ngắn gọn và ví dụ dịch sang tiếng Việt.
- Bài nghe: nội dung tiếng Hàn nguyên gốc, đủ ngắn để nghe 2–3 lần; có câu hỏi và hướng dẫn đáp án.
- Bài đọc: đoạn tiếng Hàn nguyên gốc, có câu hỏi tìm ý chính/chi tiết và hướng dẫn đáp án.
- Bài viết: ${phase === "writing" ? "là nhiệm vụ chính, có yêu cầu rõ và khung tự chấm" : "là bài củng cố ngắn, không chiếm quá 10 phút"}.
- ${firstMonth ? "Ưu tiên nghe và đọc; mục tiêu cuối tháng là đạt tối thiểu 80% ở cả hai kỹ năng." : `Ưu tiên sâu kỹ năng ${phase}.`}
- Không sao chép câu hỏi TOPIK chính thức, đề quá khứ hoặc tài liệu có bản quyền.
- Chỉ trả về JSON đúng schema.
`;

  const ai = new GoogleGenAI({ apiKey });
  const interaction = await ai.interactions.create({
    model: "gemini-3.6-flash",
    input: prompt,
    store: false,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: lessonSchema,
    },
  });

  if (!interaction.output_text) throw new Error("AI chưa tạo được bài học TOPIK hôm nay.");
  const parsed = JSON.parse(interaction.output_text) as unknown;
  const lesson = normalizeLesson(parsed, vocabularyCount, grammarCount);
  if (!lesson || lesson.vocabulary.length < 10 || lesson.grammar.length < 2) {
    throw new Error("Bài học tự động chưa đủ từ vựng hoặc ngữ pháp. Hãy tải lại để tạo lại.");
  }

  return lesson;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ ok: false, error: "Bạn cần đăng nhập." }, { status: 401 });
    if (!isTopikPersonalAdmin(user.email)) {
      return NextResponse.json({ ok: false, error: "Khu mục tiêu TOPIK này chỉ dành cho tài khoản admin." }, { status: 403 });
    }

    const url = new URL(request.url);
    const studyDate = getSeoulDate();
    const requestedStart = url.searchParams.get("start");
    let startDate = isIsoDate(requestedStart) && requestedStart <= studyDate ? requestedStart : studyDate;
    let persisted = true;
    const supabase = await createClient(request);

    const goalResult = await supabase
      .from("topik_personal_goals")
      .select("started_on, target_accuracy")
      .eq("user_id", user.id)
      .maybeSingle();

    if (goalResult.error) {
      persisted = false;
    } else if (goalResult.data) {
      startDate = goalResult.data.started_on;
    } else {
      const insertGoal = await supabase.from("topik_personal_goals").insert({
        user_id: user.id,
        owner_email: TOPIK_PERSONAL_ADMIN_EMAIL,
        started_on: startDate,
        target_accuracy: TOPIK_TARGET_ACCURACY,
      });
      if (insertGoal.error) persisted = false;
    }

    const dayNumber = getDayNumber(startDate, studyDate);
    const phaseInfo = getTopikPhase(dayNumber);

    if (persisted) {
      const existing = await supabase
        .from("topik_daily_lessons")
        .select("lesson, progress")
        .eq("user_id", user.id)
        .eq("study_date", studyDate)
        .maybeSingle();

      if (existing.data) {
        return NextResponse.json({
          ok: true,
          studyDate,
          startDate,
          dayNumber,
          phase: phaseInfo.phase,
          phaseLabel: phaseInfo.label,
          targetAccuracy: TOPIK_TARGET_ACCURACY,
          lesson: existing.data.lesson,
          progress: normalizeProgress(existing.data.progress),
          persisted: true,
        });
      }
      if (existing.error) persisted = false;
    }

    let previousVocabulary: string[] = [];
    if (persisted) {
      const recent = await supabase
        .from("topik_daily_lessons")
        .select("lesson")
        .eq("user_id", user.id)
        .lt("study_date", studyDate)
        .order("study_date", { ascending: false })
        .limit(20);

      previousVocabulary = (recent.data || []).flatMap((row) => {
        const lesson = asObject(row.lesson);
        return Array.isArray(lesson.vocabulary)
          ? lesson.vocabulary.map((item) => String(asObject(item).korean || "")).filter(Boolean)
          : [];
      });
    }

    const lesson = await generateLesson({
      dayNumber,
      studyDate,
      phase: phaseInfo.phase,
      phaseLabel: phaseInfo.label,
      phaseTarget: phaseInfo.target,
      previousVocabulary,
    });

    if (persisted) {
      const saved = await supabase.from("topik_daily_lessons").insert({
        user_id: user.id,
        study_date: studyDate,
        day_number: dayNumber,
        phase: phaseInfo.phase,
        lesson,
        progress: emptyTopikDailyProgress,
      });
      if (saved.error) persisted = false;
    }

    return NextResponse.json({
      ok: true,
      studyDate,
      startDate,
      dayNumber,
      phase: phaseInfo.phase,
      phaseLabel: phaseInfo.label,
      targetAccuracy: TOPIK_TARGET_ACCURACY,
      lesson,
      progress: emptyTopikDailyProgress,
      persisted,
    });
  } catch (error: unknown) {
    console.error("TOPIK PERSONAL PLAN ERROR:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tạo bài TOPIK hôm nay." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ ok: false, error: "Bạn cần đăng nhập." }, { status: 401 });
    if (!isTopikPersonalAdmin(user.email)) {
      return NextResponse.json({ ok: false, error: "Không có quyền cập nhật mục tiêu này." }, { status: 403 });
    }

    const body = asObject(await request.json());
    const studyDate = typeof body.studyDate === "string" ? body.studyDate : "";
    if (!isIsoDate(studyDate)) {
      return NextResponse.json({ ok: false, error: "Ngày học không hợp lệ." }, { status: 400 });
    }

    const progress = normalizeProgress(body.progress);
    const supabase = await createClient(request);
    const result = await supabase
      .from("topik_daily_lessons")
      .update({ progress, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("study_date", studyDate);

    return NextResponse.json({ ok: true, persisted: !result.error, progress });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể lưu tiến độ TOPIK." },
      { status: 500 }
    );
  }
}
