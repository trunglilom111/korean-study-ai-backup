import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

export async function GET() {
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
            "Thiếu GEMINI_API_KEY trong .env.local",
        },
        {
          status: 500,
        }
      );
    }

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    const interaction =
      await ai.interactions.create({
        model:
          "gemini-3.6-flash",

        input:
          "Bạn là trợ lý học tiếng Hàn cho người Việt. Chỉ trả lời đúng một câu: Xin chào Korean Study AI!",
      });

    return NextResponse.json({
      ok: true,
      provider:
        "Gemini",

      message:
        interaction.output_text,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "GEMINI TEST ERROR:",
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
