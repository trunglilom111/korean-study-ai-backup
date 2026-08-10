import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

export const runtime = "nodejs";

/**
 * Vercel Function có giới hạn request body khoảng 4.5 MB.
 * Vì ảnh được gửi dưới dạng Base64 nên phải giới hạn ảnh gốc
 * thấp hơn đáng kể để tránh request vượt giới hạn.
 */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const scanVocabularySchema = {
  type: "object",
  properties: {
    detectedLanguage: {
      type: "string",
      description:
        "Ngôn ngữ chính được nhận diện trong ảnh: tiếng Hàn, tiếng Trung, hoặc Hàn-Trung.",
    },

    documentTitle: {
      type: "string",
      description:
        "Tiêu đề ngắn mô tả nội dung học tập trong ảnh. Nếu không có tiêu đề rõ ràng thì tự tạo tiêu đề ngắn.",
    },

    extractedText: {
      type: "string",
      description:
        "Toàn bộ văn bản học tập nhìn thấy rõ trong ảnh, giữ xuống dòng hợp lý. Không được tự bịa.",
    },

    summary: {
      type: "string",
      description:
        "Tóm tắt ngắn bằng tiếng Việt về nội dung trong ảnh và những gì người học nên chú ý.",
    },

    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: {
            type: "string",
            description:
              "Từ hoặc cụm từ đúng như xuất hiện trong ảnh.",
          },

          dictionaryForm: {
            type: "string",
            description:
              "Dạng từ điển. Với tiếng Hàn, ưu tiên dạng kết thúc bằng -다. Với tiếng Trung giữ dạng từ/cụm từ chuẩn.",
          },

          reading: {
            type: "string",
            description:
              "Cách đọc. Tiếng Hàn dùng cách đọc Hangul nếu hữu ích; tiếng Trung dùng pinyin có dấu thanh.",
          },

          meaning: {
            type: "string",
            description:
              "Nghĩa tiếng Việt tự nhiên và phù hợp với ngữ cảnh trong ảnh.",
          },

          partOfSpeech: {
            type: "string",
            description:
              "Từ loại bằng tiếng Việt, ví dụ: danh từ, động từ, tính từ, trạng từ, trợ từ, cụm từ.",
          },

          level: {
            type: "string",
            description:
              "Trình độ ước lượng. Hàn: sơ cấp/trung cấp/cao cấp. Trung: HSK 1–2/HSK 3/HSK 4+. Nếu không đủ cơ sở thì tự động.",
          },

          explanation: {
            type: "string",
            description:
              "Giải thích ngắn bằng tiếng Việt, tập trung vào cách dùng thực tế.",
          },

          sourceSnippet: {
            type: "string",
            description:
              "Một đoạn ngắn thực sự xuất hiện trong ảnh và phải chứa term.",
          },

          exampleTarget: {
            type: "string",
            description:
              "Một câu ví dụ mới, tự nhiên, đúng ngữ pháp và phù hợp trình độ.",
          },

          exampleVietnamese: {
            type: "string",
            description:
              "Bản dịch tiếng Việt tự nhiên của exampleTarget.",
          },
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

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Loại bỏ prefix nếu frontend gửi:
 *
 * data:image/png;base64,AAAA...
 */
function normalizeBase64Image(
  value: string,
  mimeType: string
): {
  base64: string;
  mimeType: string;
} {
  const dataUrlMatch = value.match(
    /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i
  );

  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1].toLowerCase(),
      base64: dataUrlMatch[2],
    };
  }

  return {
    mimeType,
    base64: value,
  };
}

function getLanguageInstruction(languageHint: string): string {
  switch (languageHint) {
    case "korean":
      return `
CHỈ TẬP TRUNG VÀO TIẾNG HÀN.

- Ưu tiên Hangul.
- Nếu ảnh có tiếng Việt hoặc tiếng Anh thì bỏ qua.
- Nếu có chữ Hán trong ngữ cảnh tiếng Hàn, chỉ giải thích khi nó thực sự cần thiết.
`;

    case "chinese":
      return `
CHỈ TẬP TRUNG VÀO TIẾNG TRUNG.

- Có thể nhận diện cả giản thể và phồn thể.
- Nếu ảnh có tiếng Việt, tiếng Anh hoặc ngôn ngữ khác thì bỏ qua.
- Pinyin phải có dấu thanh chuẩn.
`;

    default:
      return `
TỰ ĐỘNG NHẬN DIỆN.

- Nhận diện tiếng Hàn, tiếng Trung hoặc cả hai.
- Nếu chỉ có một ngôn ngữ thì tập trung vào ngôn ngữ đó.
- Nếu có cả tiếng Hàn và tiếng Trung thì phân loại chính xác từng từ theo ngữ cảnh.
- Bỏ qua phần không liên quan đến việc học ngôn ngữ.
`;
  }
}

function isValidBase64(value: string): boolean {
  if (!value || value.length % 4 !== 0) {
    return false;
  }

  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function isValidMimeType(value: string): boolean {
  return allowedMimeTypes.has(value);
}

export async function POST(request: Request) {
  try {
    /**
     * ---------------------------------------------------------
     * 1. AUTHENTICATION
     * ---------------------------------------------------------
     */

    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bạn cần đăng nhập để quét ảnh và lưu từ vựng.",
        },
        { status: 401 }
      );
    }

    /**
     * ---------------------------------------------------------
     * 2. API KEY
     * ---------------------------------------------------------
     */

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Thiếu GEMINI_API_KEY trong .env.local.",
        },
        { status: 500 }
      );
    }

    /**
     * ---------------------------------------------------------
     * 3. READ REQUEST
     * ---------------------------------------------------------
     */

    const rawBody: unknown = await request.json();

    const body =
      rawBody && typeof rawBody === "object"
        ? (rawBody as Record<string, unknown>)
        : {};

    const originalImageData = readString(body.imageData);

    let mimeType = readString(body.mimeType).toLowerCase();

    const requestedLanguage = readString(
      body.languageHint
    );

    const languageHint = [
      "auto",
      "korean",
      "chinese",
    ].includes(requestedLanguage)
      ? requestedLanguage
      : "auto";

    const requestedMaxWords = Number(body.maxWords);

    const maxWords = Math.min(
      Math.max(
        Number.isFinite(requestedMaxWords)
          ? requestedMaxWords
          : 12,
        6
      ),
      20
    );

    /**
     * ---------------------------------------------------------
     * 4. BASIC VALIDATION
     * ---------------------------------------------------------
     */

    if (!originalImageData) {
      return NextResponse.json(
        {
          ok: false,
          error: "Hãy chọn một ảnh để quét.",
        },
        { status: 400 }
      );
    }

    /**
     * Cho phép frontend gửi cả:
     *
     * imageData = "AAAA..."
     *
     * hoặc:
     *
     * imageData = "data:image/png;base64,AAAA..."
     */
    const normalized = normalizeBase64Image(
      originalImageData,
      mimeType
    );

    const imageData = normalized.base64;
    mimeType = normalized.mimeType;

    /**
     * ---------------------------------------------------------
     * 5. MIME VALIDATION
     * ---------------------------------------------------------
     */

    if (!isValidMimeType(mimeType)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ảnh cần là JPG, PNG hoặc WebP.",
        },
        { status: 400 }
      );
    }

    /**
     * ---------------------------------------------------------
     * 6. BASE64 VALIDATION
     * ---------------------------------------------------------
     */

    if (!isValidBase64(imageData)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dữ liệu ảnh không hợp lệ. Hãy thử chọn lại ảnh.",
        },
        { status: 400 }
      );
    }

    /**
     * ---------------------------------------------------------
     * 7. IMAGE SIZE VALIDATION
     * ---------------------------------------------------------
     *
     * Base64 lớn hơn binary khoảng 33%.
     * Giới hạn ảnh gốc ở mức 3 MB để tránh request
     * vượt giới hạn 4.5 MB của Vercel.
     */

    const imageBytes = Buffer.from(
      imageData,
      "base64"
    );

    if (!imageBytes.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Không đọc được dữ liệu ảnh.",
        },
        { status: 400 }
      );
    }

    if (imageBytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ảnh quá lớn. Vui lòng chọn ảnh dưới 3 MB hoặc nén ảnh trước khi quét.",
        },
        { status: 400 }
      );
    }

    /**
     * ---------------------------------------------------------
     * 8. PROMPT
     * ---------------------------------------------------------
     */

    const prompt = `
Bạn là một giáo viên tiếng Hàn và tiếng Trung chuyên dạy người Việt,
đồng thời là một chuyên gia OCR.

Nhiệm vụ của bạn là:

1. ĐỌC CHÍNH XÁC văn bản trong ảnh.
2. XÁC ĐỊNH ngôn ngữ.
3. TRÍCH XUẤT các từ/cụm từ đáng học.
4. GIẢI THÍCH cho người Việt.
5. TẠO ví dụ mới để người học hiểu cách dùng.

${getLanguageInstruction(languageHint)}

==================================================
NGUYÊN TẮC OCR - CỰC KỲ QUAN TRỌNG
==================================================

- Chỉ sử dụng chữ thực sự nhìn thấy trong ảnh.
- Không được tự bịa chữ.
- Không được tự sửa một từ thành từ khác chỉ vì nghĩ rằng nó "có vẻ đúng hơn".
- Nếu một chữ không rõ, hãy bỏ qua nó.
- Nếu chỉ đọc được một phần câu thì chỉ lấy phần chắc chắn.
- Không được tạo sourceSnippet từ nội dung tưởng tượng.
- sourceSnippet PHẢI thực sự xuất hiện trong ảnh.
- term PHẢI xuất hiện trong sourceSnippet hoặc xuất hiện rõ ràng trong ảnh.
- Không lấy những từ chỉ suy ra từ ngữ cảnh nhưng không nhìn thấy.

==================================================
TRÍCH XUẤT VĂN BẢN
==================================================

extractedText phải:

- Ghi lại phần văn bản có thể đọc được.
- Giữ thứ tự xuất hiện tương đối.
- Giữ xuống dòng khi hợp lý.
- Không thêm nội dung.
- Không tự dịch extractedText.
- Không biến extractedText thành một bài văn mới.

Nếu ảnh có nhiều phần:

1. Tiêu đề
2. Đoạn văn
3. Câu ví dụ
4. Danh sách từ
5. Chú thích

hãy giữ cấu trúc tương đối của chúng.

==================================================
CHỌN TỪ VỰNG
==================================================

Chọn tối đa ${maxWords} từ/cụm từ.

Ưu tiên:

- Từ xuất hiện rõ ràng.
- Từ có giá trị học tập.
- Từ phổ biến.
- Từ có thể dùng trong giao tiếp.
- Từ quan trọng đối với chủ đề.
- Từ có cấu trúc hoặc cách dùng đáng học.

Không chọn:

- Tên người.
- Tên địa điểm.
- Tên thương hiệu.
- URL.
- Email.
- Số điện thoại.
- Mã số.
- Ký hiệu không có giá trị học ngôn ngữ.
- Từ bị cắt mất quá nhiều chữ.
- Nội dung không đọc rõ.

==================================================
TIẾNG HÀN
==================================================

Nếu là tiếng Hàn:

- term = đúng dạng nhìn thấy trong ảnh.
- dictionaryForm = dạng từ điển nếu có thể xác định chắc chắn.
- Với động từ/tính từ, ưu tiên dạng -다.
- reading có thể để trống nếu term đã là Hangul và không cần thêm thông tin.
- meaning phải dựa vào NGỮ CẢNH của ảnh.
- Nếu một từ có nhiều nghĩa, chọn nghĩa phù hợp nhất với câu.
- Không được lấy nghĩa máy móc từ từ điển nếu nó không phù hợp với ngữ cảnh.
- explanation tập trung vào cách dùng thực tế.
- exampleTarget là câu mới, không copy nguyên câu trong ảnh.

==================================================
TIẾNG TRUNG
==================================================

Nếu là tiếng Trung:

- Giữ đúng chữ giản thể hoặc phồn thể như ảnh.
- reading = pinyin có đầy đủ dấu thanh.
- Không dùng pinyin thiếu dấu nếu có thể xác định.
- meaning phải phù hợp với ngữ cảnh.
- Nếu từ có nhiều nghĩa, chọn nghĩa phù hợp nhất.
- exampleTarget phải dùng đúng từ.
- Không chuyển giản thể thành phồn thể hoặc ngược lại trong term.
- Không tự thêm chữ Hán không xuất hiện vào term.

==================================================
LEVEL
==================================================

Đây chỉ là trình độ ƯỚC LƯỢNG.

Tiếng Hàn:
- sơ cấp
- trung cấp
- cao cấp
- tự động

Tiếng Trung:
- HSK 1–2
- HSK 3
- HSK 4+
- tự động

Không được tuyên bố đây là danh sách HSK chính thức.

==================================================
CÂU VÍ DỤ
==================================================

exampleTarget:

- Phải là câu MỚI.
- Không copy nguyên câu trong ảnh.
- Phải đúng ngữ pháp.
- Phải sử dụng term hoặc dictionaryForm.
- Không quá dài.
- Tự nhiên như người bản xứ sử dụng.
- Phù hợp với trình độ.

exampleVietnamese:

- Dịch tự nhiên.
- Không dịch từng chữ một cách máy móc.

==================================================
GIẢI THÍCH
==================================================

explanation:

- Viết bằng tiếng Việt.
- Ngắn nhưng có giá trị.
- Nêu cách dùng quan trọng.
- Nếu có điểm dễ nhầm thì nói rõ.
- Không viết lan man.

==================================================
NẾU ẢNH KHÔNG RÕ
==================================================

Nếu ảnh:

- quá mờ,
- bị che,
- chữ quá nhỏ,
- thiếu phần quan trọng,
- hoặc không có nội dung ngôn ngữ phù hợp,

hãy:

- Không đoán.
- words có thể là [].
- summary giải thích rằng ảnh chưa đủ rõ để trích xuất chính xác.

==================================================
OUTPUT
==================================================

Chỉ trả về JSON theo schema.

Không markdown.

Không giải thích ngoài JSON.

Không thêm field ngoài schema.
`;

    /**
     * ---------------------------------------------------------
     * 9. GEMINI
     * ---------------------------------------------------------
     */

    const ai = new GoogleGenAI({
      apiKey,
    });

    const interaction =
      await ai.interactions.create({
        model: "gemini-3.6-flash",

        input: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "image",
            data: imageData,
            mime_type: mimeType,
          },
        ],

        store: false,

        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: scanVocabularySchema,
        },
      });

    /**
     * ---------------------------------------------------------
     * 10. CHECK GEMINI RESPONSE
     * ---------------------------------------------------------
     */

    if (!interaction.output_text) {
      throw new Error(
        "Gemini không trả kết quả quét ảnh."
      );
    }

    /**
     * JSON được Gemini tạo theo schema.
     *
     * Dùng Record<string, unknown> để TypeScript
     * cho phép spread (...) mà không gây lỗi TS2698.
     */

    const result = JSON.parse(
      interaction.output_text
    ) as Record<string, unknown>;

    /**
     * ---------------------------------------------------------
     * 11. EXTRA SAFETY CHECK
     * ---------------------------------------------------------
     */

    const words = Array.isArray(result.words)
      ? result.words
      : [];

    /**
     * Không cho phép Gemini trả quá số từ yêu cầu.
     */

    result.words = words.slice(0, maxWords);

    /**
     * ---------------------------------------------------------
     * 12. RETURN
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      ok: true,
      provider: "Gemini",
      ...result,
    });
  } catch (error: unknown) {
    console.error(
      "AI SCAN VOCABULARY ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể quét ảnh lúc này.",
      },
      { status: 500 }
    );
  }
}