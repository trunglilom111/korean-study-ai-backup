import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

const grammarSchema = {
  type: "object",

  properties: {
    title: {
      type: "string",
    },

    description: {
      type: "string",
    },

    grammar: {
      type: "array",

      items: {
        type: "object",

        properties: {
          pattern: {
            type: "string",
          },

          meaning: {
            type: "string",
          },

          formula: {
            type: "string",
          },

          explanation: {
            type: "string",
          },

          level: {
            type: "string",
          },

          exampleKorean: {
            type: "string",
          },

          exampleVietnamese: {
            type: "string",
          },

          usageNote: {
            type: "string",
          },

          commonMistake: {
            type: "string",
          },

          tags: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },

        required: [
          "pattern",
          "meaning",
          "formula",
          "explanation",
          "level",
          "exampleKorean",
          "exampleVietnamese",
          "usageNote",
          "commonMistake",
          "tags",
        ],
      },
    },
  },

  required: [
    "title",
    "description",
    "grammar",
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

    const source =
      typeof body.source === "string"
        ? body.source.trim()
        : "";

    const book =
      typeof body.book === "string"
        ? body.book.trim()
        : "";

    const level =
      typeof body.level === "string"
        ? body.level.trim()
        : "tự động";

    const unit =
      typeof body.unit === "string"
        ? body.unit.trim()
        : "";

    const requestText =
      typeof body.request === "string"
        ? body.request.trim()
        : "";

    const requestedCount =
      Number(body.count) || 10;

    const count =
      Math.min(
        Math.max(
          requestedCount,
          3
        ),
        20
      );

    if (
      !source &&
      !requestText
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Hãy nhập nguồn hoặc yêu cầu ngữ pháp.",
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

    const prompt = `
Bạn là giáo viên tiếng Hàn dành cho người Việt.

Nhiệm vụ:
Tổng hợp ngữ pháp tiếng Hàn để học.

NGUỒN / CHỦ ĐỀ:
${source || "Không chỉ định"}

GIÁO TRÌNH:
${book || "Không chỉ định"}

TRÌNH ĐỘ:
${level}

BÀI / UNIT:
${unit || "Không chỉ định"}

YÊU CẦU RIÊNG CỦA NGƯỜI HỌC:
${requestText || "Không có"}

SỐ LƯỢNG TỐI ĐA:
${count}

YÊU CẦU CHẤT LƯỢNG:

- Giải thích bằng tiếng Việt dễ hiểu.
- pattern phải là cấu trúc ngữ pháp tiếng Hàn.
- formula phải cho biết cách gắn với V/A/N nếu phù hợp.
- Ví dụ tiếng Hàn phải tự nhiên.
- Dịch ví dụ chính xác sang tiếng Việt.
- usageNote nêu khi nào nên dùng, sắc thái hoặc điểm cần lưu ý.
- commonMistake nêu lỗi người Việt dễ mắc.
- Không lặp lại các cấu trúc.
- Nếu không chắc cấu trúc thuộc chính xác một bài hoặc trang của giáo trình nào thì KHÔNG được tự bịa nguồn.
- Nếu người dùng cung cấp nội dung từ sách sau này, chỉ tổng hợp từ nội dung được cung cấp.
- Không chép nguyên văn dài từ giáo trình.
`;

    const interaction =
      await ai.interactions.create({
        model:
          "gemini-3.6-flash",

        input: prompt,

        store: false,

        response_format: {
          type: "text",

          mime_type:
            "application/json",

          schema:
            grammarSchema,
        },
      });

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
      "AI GRAMMAR ERROR:",
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
