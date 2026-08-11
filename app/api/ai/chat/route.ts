import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const chatSchema = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "Phản hồi bằng tiếng Hàn (có thể kèm tiếng Việt ngắn nếu cần).",
    },
    replyVietnamese: {
      type: "string",
      description: "Bản dịch tiếng Việt của reply.",
    },
    feedback: {
      type: "string",
      description:
        "Nhận xét ngắn về câu tiếng Hàn của người học (nếu có). Để trống nếu không cần.",
    },
    correction: {
      type: "object",
      properties: {
        original: { type: "string" },
        corrected: { type: "string" },
        reason: { type: "string" },
      },
      required: ["original", "corrected", "reason"],
    },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          korean: { type: "string" },
          meaning: { type: "string" },
        },
        required: ["korean", "meaning"],
      },
    },
    followUpQuestion: {
      type: "string",
      description: "Câu hỏi tiếp theo để duy trì hội thoại (tiếng Hàn).",
    },
  },
  required: [
    "reply",
    "replyVietnamese",
    "feedback",
    "correction",
    "vocabulary",
    "followUpQuestion",
  ],
};

const writingSchema = {
  type: "object",
  properties: {
    wasCorrect: { type: "boolean" },
    correctedText: { type: "string" },
    score: {
      type: "number",
      description: "Điểm từ 0-100.",
    },
    feedback: { type: "string" },
    grammarNotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["pattern", "explanation"],
      },
    },
    naturalAlternative: { type: "string" },
    encouragement: { type: "string" },
  },
  required: [
    "wasCorrect",
    "correctedText",
    "score",
    "feedback",
    "grammarNotes",
    "naturalAlternative",
    "encouragement",
  ],
};

const SCENARIOS: Record<string, string> = {
  free: "Hội thoại tự do, thân thiện như bạn Hàn.",
  cafe: "Bạn đang gọi đồ uống tại quán cà phê ở Seoul.",
  shopping: "Bạn đang mua sắm tại cửa hàng tiện lợi hoặc trung tâm thương mại.",
  interview: "Buổi phỏng vấn xin việc part-time tại Hàn Quốc.",
  hospital: "Bạn đang đi khám bệnh và nói chuyện với nhân viên y tế.",
  friends: "Trò chuyện thân mật với bạn Hàn cùng trang lứa.",
  travel: "Du lịch Hàn Quốc — hỏi đường, mua vé, check-in khách sạn.",
};

type LearnerContext = {
  vocabulary: { korean: string; meaning: string; level: string }[];
  grammar: { pattern: string; meaning: string; level: string }[];
  collections: string[];
  topikMistakes: string[];
};

async function loadLearnerContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<LearnerContext> {
  const [vocabularyResult, grammarResult, collectionsResult, topikResult] = await Promise.all([
    supabase
      .from("vocabulary")
      .select("korean,meaning,level")
      .eq("user_id", userId)
      .order("next_review_at", { ascending: true, nullsFirst: true })
      .limit(12),
    supabase
      .from("grammar")
      .select("pattern,meaning,level")
      .eq("user_id", userId)
      .order("next_review_at", { ascending: true, nullsFirst: true })
      .limit(8),
    supabase
      .from("vocabulary_collections")
      .select("title")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("topik_mistakes")
      .select("prompt")
      .eq("user_id", userId)
      .order("next_review_at", { ascending: true, nullsFirst: true })
      .limit(8),
  ]);

  return {
    vocabulary: (vocabularyResult.data || []).map((item) => ({
      korean: typeof item.korean === "string" ? item.korean : "",
      meaning: typeof item.meaning === "string" ? item.meaning : "",
      level: typeof item.level === "string" ? item.level : "",
    })).filter((item) => item.korean),
    grammar: (grammarResult.data || []).map((item) => ({
      pattern: typeof item.pattern === "string" ? item.pattern : "",
      meaning: typeof item.meaning === "string" ? item.meaning : "",
      level: typeof item.level === "string" ? item.level : "",
    })).filter((item) => item.pattern),
    collections: (collectionsResult.data || [])
      .map((item) => (typeof item.title === "string" ? item.title : ""))
      .filter(Boolean),
    topikMistakes: (topikResult.data || [])
      .map((item) => (typeof item.prompt === "string" ? item.prompt : ""))
      .filter(Boolean),
  };
}

function learnerContextText(context: LearnerContext) {
  const vocabulary = context.vocabulary
    .map((item) => `${item.korean} (${item.meaning}${item.level ? `, ${item.level}` : ""})`)
    .join(", ");
  const grammar = context.grammar
    .map((item) => `${item.pattern} (${item.meaning}${item.level ? `, ${item.level}` : ""})`)
    .join(", ");
  const collections = context.collections.join(", ");
  const topikMistakes = context.topikMistakes.join(" | ");

  return [
    `Từ vựng gần đây/cần củng cố: ${vocabulary || "chưa có dữ liệu"}`,
    `Ngữ pháp đã lưu: ${grammar || "chưa có dữ liệu"}`,
    `Bộ từ cá nhân: ${collections || "chưa có dữ liệu"}`,
    `Câu TOPIK từng sai cần củng cố: ${topikMistakes || "chưa có dữ liệu"}`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Bạn cần đăng nhập để dùng AI." },
        { status: 401 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Thiếu GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const mode =
      typeof body.mode === "string" ? body.mode : "conversation";

    const ai = new GoogleGenAI({ apiKey });
    const supabase = await createClient(request);
    const learnerContext = await loadLearnerContext(supabase, user.id);

    if (mode === "writing") {
      return handleWriting(body, ai, learnerContext);
    }

    return handleConversation(body, ai, learnerContext);
  } catch (error: unknown) {
    console.error("AI CHAT ERROR:", error);

    const message =
      error instanceof Error ? error.message : "Lỗi không xác định";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function handleWriting(
  body: Record<string, unknown>,
  ai: GoogleGenAI,
  learnerContext: LearnerContext
) {
  const text =
    typeof body.text === "string" ? body.text.trim() : "";
  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!text) {
    return NextResponse.json(
      { ok: false, error: "Hãy viết câu tiếng Hàn cần kiểm tra." },
      { status: 400 }
    );
  }

  if (text.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "Nội dung quá dài. Hãy nhập dưới 2000 ký tự." },
      { status: 400 }
    );
  }

  const interaction = await ai.interactions.create({
    model: "gemini-3.6-flash",
    input: `
Bạn là giáo viên tiếng Hàn chuyên sửa bài viết cho người Việt.

${prompt ? `CHỦ ĐỀ / YÊU CẦU: ${prompt}` : "Kiểm tra câu tiếng Hàn tự do."}

BÀI VIẾT CỦA HỌC VIÊN:
----------
${text}
----------

HỒ SƠ HỌC TẬP THAM KHẢO:
${learnerContextText(learnerContext)}

Hãy chấm và sửa chi tiết:
- correctedText: câu đúng/tự nhiên nhất
- score: 0-100 (100 = hoàn hảo)
- feedback: nhận xét bằng tiếng Việt, cụ thể
- grammarNotes: các điểm ngữ pháp cần học
- naturalAlternative: cách nói tự nhiên hơn (nếu khác correctedText)
- encouragement: lời động viên ngắn bằng tiếng Việt
`,
    store: false,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: writingSchema,
    },
  });

  const output = interaction.output_text;

  if (!output) {
    throw new Error("Gemini không trả dữ liệu.");
  }

  return NextResponse.json({
    ok: true,
    provider: "Gemini",
    mode: "writing",
    ...JSON.parse(output),
  });
}

async function handleConversation(
  body: Record<string, unknown>,
  ai: GoogleGenAI,
  learnerContext: LearnerContext
) {
  const messages = Array.isArray(body.messages)
    ? (body.messages as ChatMessage[]).filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim()
      )
    : [];

  const scenarioKey =
    typeof body.scenario === "string" ? body.scenario : "free";
  const scenario =
    SCENARIOS[scenarioKey] || SCENARIOS.free;
  const level =
    typeof body.level === "string" ? body.level : "trung cấp";

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return NextResponse.json(
      { ok: false, error: "Hãy nhập tin nhắn." },
      { status: 400 }
    );
  }

  if (lastUserMessage.content.length > 1500) {
    return NextResponse.json(
      { ok: false, error: "Tin nhắn quá dài." },
      { status: 400 }
    );
  }

  const historyText = messages
    .slice(-12)
    .map(
      (message) =>
        `${message.role === "user" ? "Học viên" : "Giáo viên"}: ${message.content}`
    )
    .join("\n");

  const interaction = await ai.interactions.create({
    model: "gemini-3.6-flash",
    input: `
Bạn là giáo viên tiếng Hàn thân thiện, dạy người Việt qua hội thoại thực tế.

TÌNH HUỐNG: ${scenario}
TRÌNH ĐỘ HỌC VIÊN: ${level}

HỒ SƠ HỌC TẬP THAM KHẢO:
${learnerContextText(learnerContext)}
Chỉ dùng hồ sơ để gợi ý đúng điểm yếu hoặc ôn lại từ/ngữ pháp phù hợp; không nói ra dữ liệu hồ sơ như một bản báo cáo.

LỊCH SỬ HỘI THOẠI:
----------
${historyText || "(Bắt đầu hội thoại mới)"}
----------

QUY TẮC:
1. reply: trả lời chủ yếu bằng tiếng Hàn, mức độ phù hợp trình độ ${level}.
2. replyVietnamese: dịch reply sang tiếng Việt.
3. Nếu học viên viết tiếng Hàn có lỗi, điền feedback và correction (original/corrected/reason bằng tiếng Việt).
   Nếu không có lỗi, feedback để trống và correction.original/corrected/reason để trống.
4. vocabulary: 1-3 từ vựng hữu ích từ lượt nói này (nếu có).
5. followUpQuestion: một câu hỏi tiếng Hàn để tiếp tục hội thoại.
6. Giữ hội thoại tự nhiên, không quá dài.
`,
    store: false,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: chatSchema,
    },
  });

  const output = interaction.output_text;

  if (!output) {
    throw new Error("Gemini không trả dữ liệu.");
  }

  return NextResponse.json({
    ok: true,
    provider: "Gemini",
    mode: "conversation",
    ...JSON.parse(output),
  });
}
