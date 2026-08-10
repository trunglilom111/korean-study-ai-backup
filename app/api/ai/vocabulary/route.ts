import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

const vocabularySchema = {
  type: "object",

  properties: {
    title: {
      type: "string",
      description:
        "Tiêu đề ngắn bằng tiếng Việt cho bộ từ vựng.",
    },

    description: {
      type: "string",
      description:
        "Mô tả ngắn bộ từ vựng bằng tiếng Việt.",
    },

    vocabulary: {
      type: "array",

      items: {
        type: "object",

        properties: {
          korean: {
            type: "string",
            description:
              "Từ hoặc cụm từ tiếng Hàn.",
          },

          meaning: {
            type: "string",
            description:
              "Nghĩa tiếng Việt ngắn gọn và tự nhiên.",
          },

          partOfSpeech: {
            type: "string",
            description:
              "Từ loại bằng tiếng Việt.",
          },

          level: {
            type: "string",
            description:
              "Một trong các mức: sơ cấp, trung cấp, cao cấp.",
          },

          exampleKorean: {
            type: "string",
            description:
              "Một câu ví dụ tiếng Hàn tự nhiên.",
          },

          exampleVietnamese: {
            type: "string",
            description:
              "Bản dịch tiếng Việt của câu ví dụ.",
          },

          memoryTip: {
            type: "string",
            description:
              "Mẹo nhớ ngắn bằng tiếng Việt. Có thể để trống nếu không cần.",
          },
        },

        required: [
          "korean",
          "meaning",
          "partOfSpeech",
          "level",
          "exampleKorean",
          "exampleVietnamese",
          "memoryTip",
        ],
      },
    },
  },

  required: [
    "title",
    "description",
    "vocabulary",
  ],
};

export async function POST(
  request: Request
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Bạn cần đăng nhập để dùng AI." },
        { status: 401 }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Thiếu GEMINI_API_KEY.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const topic =
      typeof body.topic === "string"
        ? body.topic.trim()
        : "";

    const level =
      typeof body.level === "string"
        ? body.level.trim()
        : "tự động";

    /*
     * Giới hạn số lượng để tránh
     * tốn quota Free Tier quá nhanh.
     */

    const requestedCount =
      Number(body.count) || 15;

    const count =
      Math.min(
        Math.max(
          requestedCount,
          5
        ),
        30
      );

    /*
     * Sau này Scan ảnh có thể
     * gửi text đã đọc vào đây.
     */

    const sourceText =
      typeof body.sourceText ===
      "string"
        ? body.sourceText.trim()
        : "";

    if (
      !topic &&
      !sourceText
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Hãy nhập chủ đề hoặc nội dung nguồn.",
        },
        {
          status: 400,
        }
      );
    }

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    /*
     * =======================================
     * PROMPT
     * =======================================
     */

    let prompt = "";

    /*
     * AI tự tổng hợp theo chủ đề
     */

    if (!sourceText) {
      prompt = `
Bạn là giáo viên tiếng Hàn cho người Việt.

Hãy tạo một bộ từ vựng tiếng Hàn để học.

CHỦ ĐỀ:
${topic}

TRÌNH ĐỘ:
${level}

SỐ LƯỢNG:
${count} từ

YÊU CẦU:

- Ưu tiên từ thực tế và thường dùng.
- Không tạo các từ kỳ lạ hoặc quá hiếm nếu không cần thiết.
- Nghĩa tiếng Việt phải tự nhiên.
- Câu ví dụ tiếng Hàn phải đúng ngữ pháp.
- Câu ví dụ phù hợp với trình độ người học.
- Không lặp lại từ.
- Nếu là động từ hoặc tính từ, ưu tiên dạng từ điển kết thúc bằng 다.
- Không tuyên bố đây là danh sách chính thức của TOPIK hay của một giáo trình cụ thể.
- memoryTip chỉ cần ngắn gọn.
`;
    }

    /*
     * Tổng hợp từ nội dung do
     * người dùng cung cấp.
     *
     * Sau này dùng cho scan ảnh.
     */

    if (sourceText) {
      prompt = `
Bạn là giáo viên tiếng Hàn cho người Việt.

Hãy tìm và tổng hợp các từ vựng tiếng Hàn
quan trọng trong nội dung do người dùng cung cấp.

TRÌNH ĐỘ:
${level}

TỐI ĐA:
${count} từ

NỘI DUNG NGUỒN:

----------
${sourceText}
----------

YÊU CẦU:

- Chỉ ưu tiên từ thực sự hữu ích để học.
- Không tự bịa rằng một từ xuất hiện trong nguồn nếu nó không xuất hiện.
- Nghĩa tiếng Việt phải rõ ràng.
- Với động từ/tính từ, chuẩn hóa về dạng từ điển nếu có thể.
- Tạo một câu ví dụ ngắn, tự nhiên.
- Không lặp lại từ.
`;
    }

    /*
     * =======================================
     * GEMINI
     * =======================================
     */

    const interaction =
      await ai.interactions.create({
        model:
          "gemini-3.6-flash",

        input:
          prompt,

        /*
         * Một lần hỏi độc lập,
         * không cần giữ hội thoại.
         */
        store:
          false,

        /*
         * Bắt Gemini trả đúng JSON.
         */
        response_format: {
          type: "text",

          mime_type:
            "application/json",

          schema:
            vocabularySchema,
        },
      });

    /*
     * =======================================
     * PARSE JSON
     * =======================================
     */

    const text =
      interaction.output_text;

    if (!text) {
      throw new Error(
        "Gemini không trả dữ liệu."
      );
    }

    const result =
      JSON.parse(text);

    return NextResponse.json({
      ok: true,

      provider:
        "Gemini",

      ...result,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "AI VOCABULARY ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Lỗi không xác định";

    return NextResponse.json(
      {
        ok: false,
        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}
