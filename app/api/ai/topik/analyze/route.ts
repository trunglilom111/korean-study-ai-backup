import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";

const analysisSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    patterns: { type: "array", items: { type: "string" } },
    weakAreas: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    focus: { type: "string" },
  },
  required: ["summary", "patterns", "weakAreas", "recommendations", "focus"],
};

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Bạn cần đăng nhập để phân tích bài TOPIK." }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Thiếu GEMINI_API_KEY trong .env.local." }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const mistakes = Array.isArray(body.mistakes) ? body.mistakes.slice(0, 10) : [];
    const prompt = `
Bạn là giáo viên luyện TOPIK cho người Việt. Hãy phân tích ngắn gọn kết quả bài luyện, không bịa dữ liệu.
Kỳ thi: ${typeof body.target === "string" ? body.target : "TOPIK"}
Đề: ${typeof body.examTitle === "string" ? body.examTitle : "Bài luyện"}
Điểm: ${Number(body.scorePercent) || 0}% (${Number(body.correctCount) || 0}/${Number(body.totalQuestions) || 0})
CÂU SAI:
${JSON.stringify(mistakes)}

Trả về JSON gồm: summary, patterns (mẫu lỗi), weakAreas (điểm yếu), recommendations (bài tập cụ thể), focus (một trọng tâm học tiếp theo). Mỗi mảng tối đa 5 mục, giải thích bằng tiếng Việt.
`;

    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: prompt,
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: analysisSchema,
      },
    });

    if (!interaction.output_text) throw new Error("Gemini không trả về phân tích.");
    return NextResponse.json({ ok: true, provider: "Gemini", analysis: JSON.parse(interaction.output_text) });
  } catch (error: unknown) {
    console.error("AI TOPIK ANALYSIS ERROR:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể phân tích bài TOPIK lúc này." }, { status: 500 });
  }
}
