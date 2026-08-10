import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

const chineseVocabularySchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hanzi: { type: "string" },
          pinyin: { type: "string" },
          meaning: { type: "string" },
          partOfSpeech: { type: "string" },
          exampleChinese: { type: "string" },
          examplePinyin: { type: "string" },
          exampleVietnamese: { type: "string" },
          memoryTip: { type: "string" },
        },
        required: [
          "hanzi",
          "pinyin",
          "meaning",
          "partOfSpeech",
          "exampleChinese",
          "examplePinyin",
          "exampleVietnamese",
          "memoryTip",
        ],
      },
    },
  },
  required: ["title", "description", "vocabulary"],
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bạn cần đăng nhập để tạo từ vựng bằng AI.",
        },
        { status: 401 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Thiếu GEMINI_API_KEY trong .env.local.",
        },
        { status: 500 }
      );
    }

    const rawBody: unknown = await request.json();

    const body =
      rawBody && typeof rawBody === "object"
        ? (rawBody as Record<string, unknown>)
        : {};

    const requestedLevel = stringValue(body.level);

    const level = ["HSK 1", "HSK 2", "HSK 3", "HSK 4"].includes(requestedLevel)
      ? requestedLevel
      : "HSK 1";

    const topic = stringValue(body.topic).slice(0, 180);

    const requestedCount = Number(body.count);

    const count = Math.min(
      Math.max(
        Number.isFinite(requestedCount) ? requestedCount : 20,
        8
      ),
      30
    );

    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
Bạn là giáo viên tiếng Trung phổ thông (Mandarin) cho người Việt.

Tạo ${count} từ vựng/cụm từ tiếng Trung GIẢN THỂ mới để người học luyện theo định hướng ${level}.

CHỦ ĐỀ:
${topic || "giao tiếp và đời sống hằng ngày"}

YÊU CẦU:

- Đây là bộ từ luyện theo định hướng trình độ, không được tuyên bố là danh sách HSK chính thức.
- Dùng chữ Hán giản thể.
- Pinyin phải có đầy đủ dấu thanh.
- Nghĩa tiếng Việt phải tự nhiên, dễ hiểu.
- Không lặp từ.
- Ưu tiên từ phổ biến, có thể sử dụng trong giao tiếp hằng ngày.
- Ví dụ tiếng Trung phải ngắn, đúng ngữ pháp và phù hợp với trình độ đã chọn.
- examplePinyin phải là pinyin chính xác của exampleChinese và có đầy đủ dấu thanh.
- exampleVietnamese phải dịch đúng câu ví dụ.
- memoryTip phải ngắn gọn bằng tiếng Việt và giúp người học dễ nhớ từ.
- Không sử dụng nội dung có bản quyền hoặc trích dẫn nguồn.
- Chỉ trả về dữ liệu đúng theo JSON schema được cung cấp.
`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: prompt,
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: chineseVocabularySchema,
      },
    });

    if (!interaction.output_text) {
      throw new Error("Gemini không trả về từ vựng.");
    }

    // Parse JSON và khai báo đúng kiểu để TypeScript
    // cho phép dùng spread operator (...)
    const result = JSON.parse(
      interaction.output_text
    ) as Record<string, unknown>;

    return NextResponse.json({
      ok: true,
      provider: "Gemini",
      ...result,
    });
  } catch (error: unknown) {
    console.error("AI CHINESE VOCABULARY ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể tạo từ vựng lúc này.",
      },
      { status: 500 }
    );
  }
}
