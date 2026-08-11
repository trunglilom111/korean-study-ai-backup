import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { getAuthenticatedUser } from "@/utils/supabase/auth";

function toArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để tra từ." },
      { status: 401 }
    );
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Thiếu target code" },
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
    `https://krdict.korean.go.kr/api/view` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&method=target_code` +
    `&q=${encodeURIComponent(code)}` +
    `&translated=y` +
    `&trans_lang=7`;

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

    const item = data?.channel?.item;
    const wordInfo = item?.word_info;

    if (!wordInfo) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin chi tiết" },
        { status: 404 }
      );
    }

    const categories = toArray(wordInfo.category_info)
      .map((category: any) => ({
        type: category?.type ?? "",
        name: category?.written_form ?? "",
      }))
      .filter((category: any) => category.name);

    const senses = toArray(wordInfo.sense_info);

    const examples = senses
      .flatMap((sense: any) =>
        toArray(sense?.example_info).map((example: any) => ({
          type: example?.type ?? "",
          text: example?.example ?? "",
        }))
      )
      .filter((example: any) => example.text);

    const patterns = senses
      .flatMap((sense: any) =>
        toArray(sense?.pattern_info).map((pattern: any) => ({
          pattern: pattern?.pattern ?? "",
          reference: pattern?.pattern_reference ?? "",
        }))
      )
      .filter((pattern: any) => pattern.pattern);

    const relatedWords = senses
      .flatMap((sense: any) =>
        toArray(sense?.rel_info).map((related: any) => ({
          word: related?.word ?? "",
          type: related?.type ?? "",
          targetCode: related?.link_target_code ?? "",
        }))
      )
      .filter((related: any) => related.word);

    const derivatives = toArray(wordInfo.der_info)
      .map((item: any) => item?.word ?? "")
      .filter(Boolean);

    return NextResponse.json({
      targetCode: item?.target_code ?? code,
      word: wordInfo?.word ?? "",
      level: wordInfo?.word_grade ?? "",
      categories,
      examples,
      patterns,
      relatedWords,
      derivatives,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Không thể lấy chi tiết từ" },
      { status: 500 }
    );
  }
}
