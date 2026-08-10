import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để tra từ." },
      { status: 401 }
    );
  }

  const query = request.nextUrl.searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Thiếu từ cần tìm" },
      { status: 400 }
    );
  }

  const apiKey = process.env.KOREAN_DICTIONARY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Chưa cấu hình API key" },
      { status: 500 }
    );
  }

  const url =
    `https://krdict.korean.go.kr/api/search` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(query)}` +
    `&translated=y` +
    `&trans_lang=7` +
    `&num=20`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      trimValues: true,
    });

    const data = parser.parse(xml);

    let items = data?.channel?.item ?? [];

    if (!Array.isArray(items)) {
      items = [items];
    }

    const results = items.map((item: any) => {
      let senses = item?.sense ?? [];

      if (!Array.isArray(senses)) {
        senses = [senses];
      }

      const meanings = senses.map((sense: any) => {
        let translation = sense?.translation;

        if (Array.isArray(translation)) {
          translation = translation[0];
        }

        return {
          koreanDefinition: sense?.definition ?? "",
          vietnamese:
            translation?.trans_word ??
            translation?.trans_dfn ??
            "",
          vietnameseDefinition:
            translation?.trans_dfn ?? "",
        };
      });

      return {
        targetCode: item?.target_code ?? "",
        word: item?.word ?? "",
        pronunciation: item?.pronunciation ?? "",
        partOfSpeech: item?.pos ?? "",
        level: item?.word_grade ?? "",
        meanings,
      };
    });

    return NextResponse.json({
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Không thể xử lý dữ liệu từ điển" },
      { status: 500 }
    );
  }
}
