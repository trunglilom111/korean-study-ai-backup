import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

const translateSchema = {
  type: "object",

  properties: {
    detectedLanguage: {
      type: "string",
      description:
        "Ngôn ngữ đầu vào mà AI nhận diện.",
    },

    originalText: {
      type: "string",
      description:
        "Câu gốc của người dùng.",
    },

    mainTranslation: {
      type: "string",
      description:
        "Bản dịch hoặc câu tiếng Hàn đã sửa tốt nhất.",
    },

    naturalMeaning: {
      type: "string",
      description:
        "Nghĩa tự nhiên bằng ngôn ngữ còn lại.",
    },

    politeness: {
      type: "string",
      description:
        "Mức độ lịch sự/sắc thái của câu.",
    },

    explanation: {
      type: "string",
      description:
        "Giải thích ngắn gọn bằng tiếng Việt.",
    },

    correction: {
      type: "object",

      properties: {
        wasCorrect: {
          type: "boolean",
        },

        correctedText: {
          type: "string",
        },

        reason: {
          type: "string",
        },
      },

      required: [
        "wasCorrect",
        "correctedText",
        "reason",
      ],
    },

    grammarPoints: {
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

          explanation: {
            type: "string",
          },
        },

        required: [
          "pattern",
          "meaning",
          "explanation",
        ],
      },
    },

    vocabulary: {
      type: "array",

      items: {
        type: "object",

        properties: {
          korean: {
            type: "string",
          },

          meaning: {
            type: "string",
          },
        },

        required: [
          "korean",
          "meaning",
        ],
      },
    },

    alternatives: {
      type: "array",

      items: {
        type: "object",

        properties: {
          korean: {
            type: "string",
          },

          meaning: {
            type: "string",
          },

          nuance: {
            type: "string",
          },
        },

        required: [
          "korean",
          "meaning",
          "nuance",
        ],
      },
    },

    notes: {
      type: "string",
      description:
        "Ghi chú quan trọng cho người Việt học tiếng Hàn.",
    },
  },

  required: [
    "detectedLanguage",
    "originalText",
    "mainTranslation",
    "naturalMeaning",
    "politeness",
    "explanation",
    "correction",
    "grammarPoints",
    "vocabulary",
    "alternatives",
    "notes",
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

    const text =
      typeof body.text === "string"
        ? body.text.trim()
        : "";

    const mode =
      typeof body.mode === "string"
        ? body.mode
        : "auto";

    const style =
      typeof body.style === "string"
        ? body.style
        : "natural";

    const customRequest =
      typeof body.customRequest ===
      "string"
        ? body.customRequest.trim()
        : "";

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Hãy nhập câu cần dịch hoặc sửa.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Giới hạn để tránh vô tình
     * dùng quá nhiều quota Gemini.
     */
    if (text.length > 3000) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nội dung quá dài. Hãy nhập dưới 3000 ký tự.",
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

    const modeInstruction =
      getModeInstruction(
        mode
      );

    const styleInstruction =
      getStyleInstruction(
        style
      );

    const prompt = `
Bạn là giáo viên tiếng Hàn chuyên dạy người Việt.

NHIỆM VỤ:
${modeInstruction}

CÂU CỦA NGƯỜI HỌC:
----------
${text}
----------

PHONG CÁCH / SẮC THÁI:
${styleInstruction}

YÊU CẦU RIÊNG:
${customRequest || "Không có"}

QUY TẮC:

1. Nếu dịch Việt → Hàn:
- Ưu tiên cách nói tự nhiên mà người Hàn thực sự sử dụng.
- Không dịch từng chữ máy móc.
- Giữ đúng ý của người dùng.

2. Nếu dịch Hàn → Việt:
- Dịch tự nhiên sang tiếng Việt.
- Giải thích sắc thái nếu cần.

3. Nếu sửa câu tiếng Hàn:
- Xác định câu gốc đúng hay chưa.
- Nếu sai hoặc không tự nhiên, sửa thành câu tự nhiên.
- Giải thích lỗi bằng tiếng Việt thật dễ hiểu.

4. grammarPoints:
- Chỉ lấy những ngữ pháp thực sự đáng học trong câu.
- Không cần phân tích những thứ quá hiển nhiên.

5. vocabulary:
- Chọn các từ tiếng Hàn quan trọng trong câu.
- Nghĩa tiếng Việt ngắn gọn.

6. alternatives:
- Cho tối đa 3 cách nói khác.
- Mỗi cách phải có sắc thái khác nhau hoặc hoàn cảnh dùng khác nhau.
- Nếu không cần nhiều cách nói, có thể trả ít hơn.

7. Nếu người dùng yêu cầu sử dụng một ngữ pháp cụ thể,
hãy cố gắng sử dụng ngữ pháp đó nếu phù hợp về nghĩa.

8. Không bịa quy tắc ngữ pháp.
9. explanation và notes phải viết bằng tiếng Việt.
`;

    const interaction =
      await ai.interactions.create({
        model:
          "gemini-3.6-flash",

        input:
          prompt,

        store:
          false,

        response_format: {
          type: "text",

          mime_type:
            "application/json",

          schema:
            translateSchema,
        },
      });

    const output =
      interaction.output_text;

    if (!output) {
      throw new Error(
        "Gemini không trả dữ liệu."
      );
    }

    const result =
      JSON.parse(output);

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
      "AI TRANSLATE ERROR:",
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

/*
 * =========================================================
 * MODE
 * =========================================================
 */

function getModeInstruction(
  mode: string
) {
  switch (mode) {
    case "vi-ko":
      return `
Dịch nội dung tiếng Việt sang tiếng Hàn.
Nếu đầu vào có một chút tiếng Hàn xen lẫn,
hãy hiểu theo ngữ cảnh.
`;

    case "ko-vi":
      return `
Dịch nội dung tiếng Hàn sang tiếng Việt.
Giải thích những sắc thái tiếng Hàn
khó truyền tải trực tiếp sang tiếng Việt.
`;

    case "correct":
      return `
Kiểm tra và sửa câu tiếng Hàn của người học.
Nếu câu đã đúng nhưng chưa tự nhiên,
hãy đưa ra cách nói tự nhiên hơn.
`;

    default:
      return `
Tự nhận diện ngôn ngữ.
Nếu là tiếng Việt thì dịch sang tiếng Hàn.
Nếu là tiếng Hàn thì dịch sang tiếng Việt
và đồng thời kiểm tra độ tự nhiên của câu.
`;
  }
}

/*
 * =========================================================
 * STYLE
 * =========================================================
 */

function getStyleInstruction(
  style: string
) {
  switch (style) {
    case "casual":
      return `
Thân mật, tự nhiên.
Phù hợp nói với bạn bè hoặc người rất thân.
Có thể dùng 반말 khi thích hợp.
`;

    case "polite":
      return `
Lịch sự thông dụng.
Ưu tiên 해요체.
Phù hợp phần lớn giao tiếp hằng ngày.
`;

    case "formal":
      return `
Trang trọng và lịch sự.
Ưu tiên 합니다체 khi phù hợp.
`;

    case "honorific":
      return `
Sử dụng kính ngữ phù hợp.
Chú ý 높임말 và các động từ kính ngữ
nếu đối tượng cần được tôn trọng.
`;

    case "work":
      return `
Tự nhiên trong môi trường công việc ở Hàn Quốc.
Lịch sự, rõ ràng, không quá cứng nhắc.
`;

    case "student":
      return `
Tự nhiên như sinh viên/người trẻ Hàn Quốc nói.
Không dùng tiếng lóng quá mức.
`;

    default:
      return `
Tự nhiên nhất theo ngữ cảnh.
Gemini tự chọn mức độ lịch sự phù hợp.
`;
  }
}
