import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/utils/supabase/auth";

const grammarExplainSchema = {
  type: "object",
  properties: {
    pattern: { type: "string" },
    meaning: { type: "string" },
    structure: { type: "string" },
    nuance: { type: "string" },
    level: { type: "string" },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          korean: { type: "string" },
          vietnamese: { type: "string" },
          note: { type: "string" },
        },
        required: ["korean", "vietnamese", "note"],
      },
    },
    commonMistakes: {
      type: "array",
      items: { type: "string" },
    },
    similarPatterns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          difference: { type: "string" },
        },
        required: ["pattern", "difference"],
      },
    },
  },
  required: [
    "pattern",
    "meaning",
    "structure",
    "nuance",
    "level",
    "examples",
    "commonMistakes",
    "similarPatterns",
  ],
};

const sentenceAnalysisSchema = {
  type: "object",
  properties: {
    originalSentence: { type: "string" },
    naturalTranslation: { type: "string" },
    correctedSentence: { type: "string" },
    correctionNote: { type: "string" },
    tokens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          role: { type: "string" },
          meaning: { type: "string" },
        },
        required: ["text", "role", "meaning"],
      },
    },
    grammarPoints: {
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
  },
  required: [
    "originalSentence",
    "naturalTranslation",
    "correctedSentence",
    "correctionNote",
    "tokens",
    "grammarPoints",
    "vocabulary",
  ],
};

const grammarComparisonSchema = {
  type: "object",
  properties: {
    leftPattern: { type: "string" },
    rightPattern: { type: "string" },
    summary: { type: "string" },
    meaning: { type: "string" },
    nuance: { type: "string" },
    whenToUse: { type: "string" },
    differences: {
      type: "array",
      items: { type: "string" },
    },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          left: { type: "string" },
          right: { type: "string" },
          vietnamese: { type: "string" },
        },
        required: ["left", "right", "vietnamese"],
      },
    },
    commonMistakes: {
      type: "array",
      items: { type: "string" },
    },
    memoryTip: { type: "string" },
  },
  required: [
    "leftPattern",
    "rightPattern",
    "summary",
    "meaning",
    "nuance",
    "whenToUse",
    "differences",
    "examples",
    "commonMistakes",
    "memoryTip",
  ],
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return errorResponse("Bạn cần đăng nhập để tra cứu ngữ pháp.", 401);
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return errorResponse("Thiếu GEMINI_API_KEY.", 500);
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const mode =
    body?.mode === "sentence" || body?.mode === "compare"
      ? body.mode
      : "grammar";
  const input =
    typeof body?.input === "string"
      ? body.input.normalize("NFC").trim()
      : "";
  const compareWith =
    typeof body?.compareWith === "string"
      ? body.compareWith.normalize("NFC").trim()
      : "";

  if (!input) {
    return errorResponse(
      mode === "sentence"
        ? "Hãy nhập câu tiếng Hàn cần phân tích."
        : "Hãy nhập cấu trúc ngữ pháp cần tra cứu.",
      400
    );
  }

  if (input.length > 300 || compareWith.length > 300) {
    return errorResponse("Nội dung tra cứu tối đa 300 ký tự.", 400);
  }

  if (mode === "compare" && !compareWith) {
    return errorResponse("Hãy nhập đủ hai mẫu ngữ pháp để so sánh.", 400);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      mode === "sentence"
        ? `
Bạn là giáo viên tiếng Hàn chuyên dạy người Việt.

Hãy phân tích câu tiếng Hàn sau:
---
${input}
---

YÊU CẦU:
- Dịch tự nhiên sang tiếng Việt.
- Tách các thành phần quan trọng, gồm từ/cụm từ, vai trò và nghĩa.
- Chỉ ra ngữ pháp thực sự đáng học trong câu.
- Nếu câu sai hoặc chưa tự nhiên, đưa correctedSentence là câu sửa; nếu đúng, giữ nguyên câu.
- correctionNote phải giải thích rõ bằng tiếng Việt, không được bịa lỗi.
- Không phân tích lan man những từ quá hiển nhiên.
`
        : mode === "compare"
          ? `
Bạn là giáo viên tiếng Hàn chuyên dạy người Việt.

Hãy so sánh hai mẫu ngữ pháp:
MẪU A: ${input}
MẪU B: ${compareWith}

YÊU CẦU:
- Nêu điểm giống nhau trước, sau đó chỉ rõ khác biệt về nghĩa, sắc thái và hoàn cảnh dùng.
- Cho ví dụ song song bằng tiếng Hàn và bản dịch tiếng Việt.
- Nêu lỗi người Việt thường mắc khi đổi hai mẫu cho nhau.
- memoryTip phải ngắn gọn, dễ nhớ.
- Không bịa nguồn giáo trình.
`
          : `
Bạn là giáo viên tiếng Hàn chuyên dạy người Việt.

Hãy phân tích cấu trúc ngữ pháp sau:
---
${input}
---

YÊU CẦU:
- Xác định đúng cấu trúc nếu đầu vào là một mẫu ngữ pháp.
- Nếu đầu vào là một câu có chứa ngữ pháp, hãy suy ra mẫu quan trọng nhất trong câu.
- Viết toàn bộ giải thích bằng tiếng Việt, giữ ví dụ tiếng Hàn tự nhiên.
- meaning: nghĩa ngắn gọn, dễ nhớ.
- structure: công thức gắn với V/A/N và các biến thể nếu cần.
- nuance: sắc thái, mức độ tự nhiên và bối cảnh sử dụng.
- examples: 2 đến 4 ví dụ, có bản dịch và ghi chú ngắn.
- commonMistakes: lỗi người Việt thường mắc, tối đa 4 mục.
- similarPatterns: tối đa 3 mẫu gần nghĩa và nêu rõ khác biệt.
- Không bịa nguồn giáo trình và không chép đoạn văn dài.
`;
    const schema =
      mode === "sentence"
        ? sentenceAnalysisSchema
        : mode === "compare"
          ? grammarComparisonSchema
          : grammarExplainSchema;
    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: prompt,
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema,
      },
    });

    const output = interaction.output_text;

    if (!output) {
      return errorResponse("Gemini không trả dữ liệu.", 502);
    }

    const result = JSON.parse(output) as Record<string, unknown>;

    return NextResponse.json({
      ok: true,
      provider: "Gemini",
      mode,
      compareWith: mode === "compare" ? compareWith : undefined,
      input,
      ...result,
    });
  } catch (error: unknown) {
    console.error("AI GRAMMAR EXPLAIN ERROR:", error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Không thể phân tích ngữ pháp lúc này.",
      500
    );
  }
}
