import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { fetchOEmbedInfo, parseMediaUrl } from "@/utils/media-url";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

const shadowingSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    level: { type: "string" },
    sentences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          korean: { type: "string" },
          vietnamese: { type: "string" },
          romanization: { type: "string" },
          focusPoint: { type: "string" },
        },
        required: ["korean", "vietnamese", "romanization", "focusPoint"],
      },
    },
  },
  required: ["title", "description", "level", "sentences"],
};

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Bạn cần đăng nhập để dùng Shadowing AI." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    const transcript =
      typeof body.transcript === "string" ? body.transcript.trim() : "";
    const requestedLevel =
      typeof body.level === "string" ? body.level.trim() : "sơ cấp";
    const level = ["sơ cấp", "trung cấp", "cao cấp"].includes(requestedLevel)
      ? requestedLevel
      : "sơ cấp";

    if (!rawUrl) {
      return NextResponse.json(
        { ok: false, error: "Hãy dán link video hoặc audio." },
        { status: 400 }
      );
    }

    const media = parseMediaUrl(rawUrl);

    if (!media) {
      return NextResponse.json(
        { ok: false, error: "Link không hợp lệ." },
        { status: 400 }
      );
    }

    let videoTitle = "";
    let videoAuthor = "";

    if (media.type === "youtube") {
      const oembed = await fetchOEmbedInfo(media.watchUrl);
      videoTitle = oembed?.title || "";
      videoAuthor = oembed?.author || "";
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Thiếu GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const transcriptBlock = transcript
      ? `
PHỤ ĐỀ / TRANSCRIPT NGƯỜI DÙNG CUNG CẤP:
----------
${transcript.slice(0, 8000)}
----------
Hãy tách transcript thành các câu shadowing. Giữ nguyên câu tiếng Hàn gốc nếu transcript đã là tiếng Hàn.
`
      : `
Người dùng CHƯA cung cấp transcript.
Hãy tạo bài shadowing phù hợp với chủ đề video (dựa trên tiêu đề/kênh).
Không bịa transcript chi tiết — chỉ tạo câu luyện tập liên quan chủ đề.
`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: `
Bạn là giáo viên tiếng Hàn cho người Việt, chuyên thiết kế bài shadowing từ video.

THÔNG TIN NGUỒN:
- Link: ${rawUrl}
- Loại: ${media.type}
${videoTitle ? `- Tiêu đề video: ${videoTitle}` : ""}
${videoAuthor ? `- Kênh/tác giả: ${videoAuthor}` : ""}
- Trình độ mong muốn: ${level}

${transcriptBlock}

YÊU CẦU:
- Tạo từ 5 đến 12 câu shadowing (tùy độ dài transcript).
- Mỗi câu ngắn, tự nhiên, phù hợp để nghe và nhại theo.
- Không quá 22 từ mỗi câu.
- Bản dịch và mẹo phát âm bằng tiếng Việt, dễ hiểu.
- title mô tả nguồn video (có thể dùng tiêu đề video nếu có).
- description giải thích cách luyện với video gốc.
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
      source: {
        url: rawUrl,
        type: media.type,
        title: videoTitle,
        author: videoAuthor,
        embedUrl:
          media.type === "youtube" || media.type === "vimeo"
            ? media.embedUrl
            : null,
      },
      ...result,
    });
  } catch (error: unknown) {
    console.error("AI SHADOWING FROM URL ERROR:", error);

    const message =
      error instanceof Error ? error.message : "Lỗi không xác định";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
