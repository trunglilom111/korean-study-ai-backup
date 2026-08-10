import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";

const shadowingSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Tiêu đề ngắn bằng tiếng Việt cho bài luyện.",
    },
    description: {
      type: "string",
      description: "Mô tả ngắn bằng tiếng Việt về ngữ cảnh của bài.",
    },
    level: {
      type: "string",
      description: "Trình độ của bài: sơ cấp, trung cấp hoặc cao cấp.",
    },
    sentences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          korean: {
            type: "string",
            description: "Một câu tiếng Hàn tự nhiên để nghe và nhại theo.",
          },
          vietnamese: {
            type: "string",
            description: "Bản dịch tự nhiên bằng tiếng Việt.",
          },
          romanization: {
            type: "string",
            description: "Phiên âm Latin đơn giản, ưu tiên phát âm thực tế.",
          },
          focusPoint: {
            type: "string",
            description: "Một mẹo ngắn về phát âm, ngữ điệu hoặc từ cần chú ý.",
          },
        },
        required: ["korean", "vietnamese", "romanization", "focusPoint"],
      },
    },
  },
  required: ["title", "description", "level", "sentences"],
};

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Bạn cần đăng nhập để dùng Shadowing AI." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const requestedLevel =
      typeof body.level === "string" ? body.level.trim() : "sơ cấp";
    const level = ["sơ cấp", "trung cấp", "cao cấp"].includes(requestedLevel)
      ? requestedLevel
      : "sơ cấp";
    const requestedCount = Number(body.count) || 5;
    const count = Math.min(Math.max(requestedCount, 3), 12);

    if (!topic) {
      return NextResponse.json(
        { ok: false, error: "Hãy nhập chủ đề muốn luyện." },
        { status: 400 }
      );
    }

    if (topic.length > 160) {
      return NextResponse.json(
        { ok: false, error: "Chủ đề quá dài. Hãy nhập dưới 160 ký tự." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Thiếu GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: `
Bạn là giáo viên tiếng Hàn cho người Việt, chuyên thiết kế bài shadowing.

Hãy tạo một bài luyện theo chủ đề sau:

CHỦ ĐỀ: ${topic}
TRÌNH ĐỘ: ${level}
SỐ CÂU: ${count}

YÊU CẦU:
- Viết đúng ${count} câu tiếng Hàn ngắn, tự nhiên và liên kết thành một tình huống rõ ràng.
- Mỗi câu phù hợp để người học nghe rồi nhại theo, không quá 22 từ.
- Dùng mức độ lịch sự phù hợp với ngữ cảnh; ưu tiên 해요체 cho sơ cấp/trung cấp nếu không có lý do khác.
- Không chép nội dung từ giáo trình, phim hoặc bài hát có bản quyền.
- Bản dịch và mẹo phát âm phải dễ hiểu bằng tiếng Việt.
- Phiên âm chỉ để hỗ trợ người mới, không thay thế chữ Hàn.
- focusPoint phải ngắn, thực tế, tập trung vào một điểm đáng chú ý của câu.
`,
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: shadowingSchema,
      },
    });

    const output = interaction.output_text;

    if (!output) {
      throw new Error("Gemini không trả dữ liệu.");
    }

    const result = JSON.parse(output);

    return NextResponse.json({
      ok: true,
      provider: "Gemini",
      ...result,
    });
  } catch (error: unknown) {
    console.error("AI SHADOWING ERROR:", error);

    const message =
      error instanceof Error ? error.message : "Lỗi không xác định";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
