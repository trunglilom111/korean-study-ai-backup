import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

const topikExamSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    target: { type: "string" },
    estimatedMinutes: { type: "number" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          title: { type: "string" },
          instructions: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                number: { type: "number" },
                prompt: { type: "string" },
                supportText: { type: "string" },
                audioText: { type: "string" },
                options: {
                  type: "array",
                  items: { type: "string" },
                },
                answer: { type: "string" },
                explanation: { type: "string" },
                writingGuide: {
                  type: "array",
                  items: { type: "string" },
                },
                points: { type: "number" },
              },
              required: [
                "id",
                "number",
                "prompt",
                "supportText",
                "audioText",
                "options",
                "answer",
                "explanation",
                "writingGuide",
                "points",
              ],
            },
          },
        },
        required: ["skill", "title", "instructions", "questions"],
      },
    },
  },
  required: ["title", "subtitle", "target", "estimatedMinutes", "sections"],
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Bạn cần đăng nhập để tạo đề bằng AI." },
        { status: 401 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Thiếu GEMINI_API_KEY trong .env.local." },
        { status: 500 }
      );
    }

    const rawBody: unknown = await request.json();
    const body =
      rawBody && typeof rawBody === "object"
        ? (rawBody as Record<string, unknown>)
        : {};

    const target = body.target === "TOPIK II" ? "TOPIK II" : "TOPIK I";
    const requestedSkill = readString(body.skill);
    const skill = ["all", "listening", "reading", "writing"].includes(requestedSkill)
      ? requestedSkill
      : "all";
    const requestedLevel = readString(body.level);
    const level = ["beginner", "intermediate", "advanced"].includes(requestedLevel)
      ? requestedLevel
      : target === "TOPIK I"
        ? "beginner"
        : "intermediate";
    const topic = readString(body.topic).slice(0, 180);
    const requestedCount = Number(body.questionCount);
    const questionCount = Math.min(
      Math.max(Number.isFinite(requestedCount) ? requestedCount : 8, 4),
      30
    );

    if (target === "TOPIK I" && skill === "writing") {
      return NextResponse.json(
        {
          ok: false,
          error: "TOPIK I không có phần viết. Hãy chọn nghe, đọc hoặc cả hai.",
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Bạn là chuyên gia thiết kế bài luyện thi TOPIK cho người Việt.

Tạo một ĐỀ MÔ PHỎNG NGUYÊN GỐC, không sao chép, không tái tạo, không mô phỏng gần giống câu hỏi của đề TOPIK chính thức hay sách có bản quyền. Đây là bài luyện theo định dạng kỹ năng, không phải đề thi chính thức.

THIẾT LẬP:
- Kỳ thi: ${target}
- Trình độ: ${level}
- Kỹ năng yêu cầu: ${skill}
- Số câu tổng: ${questionCount}
- Chủ đề ưu tiên: ${topic || "đời sống, học tập và giao tiếp hằng ngày"}

YÊU CẦU NỘI DUNG:
- TOPIK I: chỉ 듣기 (listening) và 읽기 (reading), phù hợp cấp 1–2.
- TOPIK II: 듣기, 읽기, 쓰기; phù hợp cấp 3–6 tùy trình độ. Nếu chọn all, phải có ít nhất 1 câu viết.
- Với listening: skill là "listening", audioText là đoạn tiếng Hàn tự nhiên dài 1–3 câu để trình duyệt đọc; prompt là câu hỏi tiếng Hàn; supportText để rỗng.
- Với reading: skill là "reading", supportText là đoạn văn/câu tiếng Hàn cần đọc; prompt là câu hỏi tiếng Hàn; audioText để rỗng.
- Với writing: skill là "writing", options phải là []; prompt là yêu cầu viết bằng tiếng Hàn; answer là một câu trả lời mẫu ngắn; writingGuide gồm 3–5 tiêu chí bằng tiếng Việt; supportText và audioText để rỗng.
- Với câu trắc nghiệm: options phải có đúng 4 lựa chọn bằng tiếng Hàn; answer phải giống chính xác một lựa chọn trong options; explanation giải thích bằng tiếng Việt rõ ràng.
- Mọi câu đều cần id duy nhất (ví dụ q1), number tăng dần, points hợp lý, giải thích tiếng Việt.
- Dùng tiếng Hàn tự nhiên, không đưa tên thương hiệu hoặc trích dẫn nguồn.
- estimatedMinutes phản ánh thời gian hợp lý cho số câu, tối thiểu 10 phút.
- Với đề từ 20 câu trở lên, hãy phân bố câu hỏi rõ ràng theo kỹ năng đã chọn, đa dạng dạng hỏi và không lặp lại tình huống hoặc đáp án.
`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: prompt,
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: topikExamSchema,
      },
    });

    if (!interaction.output_text) {
      throw new Error("Gemini không trả về đề luyện.");
    }

    const exam = JSON.parse(interaction.output_text) as unknown;

    return NextResponse.json({ ok: true, provider: "Gemini", exam });
  } catch (error: unknown) {
    console.error("AI TOPIK ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Không thể tạo đề TOPIK lúc này.",
      },
      { status: 500 }
    );
  }
}
