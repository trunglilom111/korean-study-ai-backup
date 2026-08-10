import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const scanVocabularySchema = {
  type: "object",
  properties: {
    detectedLanguage: { type: "string" },
    documentTitle: { type: "string" },
    extractedText: { type: "string" },
    summary: { type: "string" },
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          dictionaryForm: { type: "string" },
          reading: { type: "string" },
          meaning: { type: "string" },
          partOfSpeech: { type: "string" },
          level: { type: "string" },
          explanation: { type: "string" },
          sourceSnippet: { type: "string" },
          exampleTarget: { type: "string" },
          exampleVietnamese: { type: "string" },
        },
        required: [
          "term",
          "dictionaryForm",
          "reading",
          "meaning",
          "partOfSpeech",
          "level",
          "explanation",
          "sourceSnippet",
          "exampleTarget",
          "exampleVietnamese",
        ],
      },
    },
  },
  required: [
    "detectedLanguage",
    "documentTitle",
    "extractedText",
    "summary",
    "words",
  ],
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getLanguageInstruction(languageHint: string) {
  switch (languageHint) {
    case "korean":
      return "Ưu tiên chỉ nhận diện và giải thích tiếng Hàn.";
    case "chinese":
      return "Ưu tiên chỉ nhận diện và giải thích tiếng Trung giản thể hoặc phồn thể.";
    default:
      return "Tự nhận diện tiếng Hàn, tiếng Trung hoặc cả hai. Bỏ qua phần không phải ngôn ngữ đang học.";
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Bạn cần đăng nhập để quét ảnh và lưu từ vựng." },
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
    const body = rawBody && typeof rawBody === "object"
      ? rawBody as Record<string, unknown>
      : {};
    const imageData = readString(body.imageData);
    const mimeType = readString(body.mimeType).toLowerCase();
    const languageHint = ["auto", "korean", "chinese"].includes(readString(body.languageHint))
      ? readString(body.languageHint)
      : "auto";
    const requestedMaxWords = Number(body.maxWords);
    const maxWords = Math.min(
      Math.max(Number.isFinite(requestedMaxWords) ? requestedMaxWords : 12, 6),
      20
    );

    if (!imageData || !mimeType) {
      return NextResponse.json(
        { ok: false, error: "Hãy chọn một ảnh để quét." },
        { status: 400 }
      );
    }

    if (!allowedMimeTypes.has(mimeType)) {
      return NextResponse.json(
        { ok: false, error: "Ảnh cần là JPG, PNG hoặc WebP." },
        { status: 400 }
      );
    }

    if (
      imageData.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData)
    ) {
      return NextResponse.json(
        { ok: false, error: "Dữ liệu ảnh không hợp lệ." },
        { status: 400 }
      );
    }

    const imageBytes = Buffer.from(imageData, "base64");

    if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Ảnh sau khi nén cần nhỏ hơn 5 MB." },
        { status: 400 }
      );
    }

    const prompt = `
Bạn là giáo viên ngôn ngữ cho người Việt và chuyên gia OCR cẩn thận.

Hãy phân tích ảnh người học gửi để biến văn bản trong ảnh thành một bài học từ vựng.

ƯU TIÊN NGÔN NGỮ:
${getLanguageInstruction(languageHint)}

YÊU CẦU QUAN TRỌNG:
- Đọc chính xác phần chữ nhìn thấy trong ảnh. Nếu chữ mờ hoặc không chắc, không được đoán; hãy bỏ qua phần đó.
- extractedText là phần văn bản bạn nhận diện được, giữ xuống dòng hợp lý. Không tự thêm câu không có trong ảnh.
- Chỉ chọn tối đa ${maxWords} từ/cụm từ thực sự xuất hiện trong ảnh và hữu ích để học.
- Không chọn tên riêng, mã số, URL, số điện thoại hoặc dữ liệu cá nhân.
- term là hình thức đúng như ảnh. dictionaryForm là dạng từ điển nếu có ích; với tiếng Hàn, động/tính từ nên dùng dạng -다. Nếu không cần chuẩn hóa, dictionaryForm bằng term.
- reading: phát âm Hangul hoặc pinyin có dấu thanh; nếu không cần, để chuỗi rỗng.
- meaning, explanation, summary phải rõ ràng bằng tiếng Việt.
- sourceSnippet phải là một cụm/câu ngắn thực sự xuất hiện trong ảnh và có chứa term.
- exampleTarget là câu mẫu mới, ngắn, đúng ngữ pháp, có dùng dictionaryForm hoặc term; exampleVietnamese là bản dịch tự nhiên.
- level dùng "sơ cấp", "trung cấp", "cao cấp" cho tiếng Hàn, hoặc "HSK 1–2", "HSK 3", "HSK 4+" cho tiếng Trung. Nếu không đủ cơ sở, dùng "tự động".
- Không tuyên bố đây là cấp độ, danh sách từ, hoặc đề thi chính thức.
- Nếu ảnh không có văn bản học được, trả words là mảng rỗng và giải thích trong summary.
- Chỉ trả về JSON theo schema.
`;

    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: [
        { type: "text", text: prompt },
        { type: "image", data: imageData, mime_type: mimeType },
      ],
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: scanVocabularySchema,
      },
    });

    if (!interaction.output_text) {
      throw new Error("Gemini không trả kết quả quét ảnh.");
    }

    const result = JSON.parse(interaction.output_text) as Record<string, unknown>;

    return NextResponse.json({ ok: true, provider: "Gemini", ...result });
  } catch (error: unknown) {
    console.error("AI SCAN VOCABULARY ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : "Không thể quét ảnh lúc này.",
      },
      { status: 500 }
    );
  }
}
