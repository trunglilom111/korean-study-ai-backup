"use client";

import { useState } from "react";

type Mode =
  | "auto"
  | "vi-ko"
  | "ko-vi"
  | "correct";

type Style =
  | "natural"
  | "polite"
  | "casual"
  | "formal"
  | "honorific"
  | "work"
  | "student";

type GrammarPoint = {
  pattern: string;
  meaning: string;
  explanation: string;
};

type VocabularyItem = {
  korean: string;
  meaning: string;
};

type Alternative = {
  korean: string;
  meaning: string;
  nuance: string;
};

type TranslateResult = {
  ok: boolean;

  provider?: string;

  detectedLanguage?: string;

  originalText?: string;

  mainTranslation?: string;

  naturalMeaning?: string;

  politeness?: string;

  explanation?: string;

  correction?: {
    wasCorrect: boolean;
    correctedText: string;
    reason: string;
  };

  grammarPoints?: GrammarPoint[];

  vocabulary?: VocabularyItem[];

  alternatives?: Alternative[];

  notes?: string;

  error?: string;
};

export default function AiTranslate() {
  const [text, setText] =
    useState("");

  const [mode, setMode] =
    useState<Mode>(
      "auto"
    );

  const [style, setStyle] =
    useState<Style>(
      "natural"
    );

  const [
    customRequest,
    setCustomRequest,
  ] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<TranslateResult | null>(
      null
    );

  /*
   * =========================================
   * GỌI GEMINI
   * =========================================
   */

  async function translate() {
    if (!text.trim()) {
      alert(
        "Hãy nhập câu cần dịch hoặc sửa."
      );

      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response =
        await fetch(
          "/api/ai/translate",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                text:
                  text.trim(),

                mode,

                style,

                customRequest:
                  customRequest.trim(),
              }),
          }
        );

      const data =
        (await response.json()) as
          TranslateResult;

      if (
        !response.ok ||
        !data.ok
      ) {
        alert(
          data.error ||
            "Không dịch được câu."
        );

        return;
      }

      setResult(data);
    } catch (error) {
      console.error(
        error
      );

      alert(
        "Không kết nối được Gemini."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================
   * SPEAK
   * =========================================
   */

  function speak(
    value: string
  ) {
    if (!value.trim()) {
      return;
    }

    window
      .speechSynthesis
      .cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        value
      );

    utterance.lang =
      "ko-KR";

    utterance.rate =
      0.9;

    window
      .speechSynthesis
      .speak(
        utterance
      );
  }

  /*
   * =========================================
   * COPY
   * =========================================
   */

  async function copyText(
    value: string
  ) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        value
      );
    } catch {
      alert(
        "Không copy được."
      );
    }
  }

  /*
   * =========================================
   * QUICK EXAMPLES
   * =========================================
   */

  function useExample(
    value: string,
    newMode: Mode
  ) {
    setText(value);
    setMode(newMode);
    setResult(null);
  }

  return (
    <div>

      {/* =====================================
          INTRO
      ===================================== */}

      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">

        <p className="text-sm text-slate-500">
          ✍️ Gemini Korean Assistant
        </p>

        <h2 className="mt-1 text-2xl font-bold">
          Dịch & sửa câu tiếng Hàn
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Không chỉ dịch. AI còn có thể
          sửa câu, giải thích ngữ pháp,
          tách từ vựng và đưa ra các cách
          nói tự nhiên hơn.
        </p>

      </div>

      {/* =====================================
          MODE
      ===================================== */}

      <div className="mb-5">

        <p className="mb-3 text-sm font-semibold text-slate-400">
          Chế độ
        </p>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">

          <ModeButton
            active={
              mode ===
              "auto"
            }
            onClick={() =>
              setMode(
                "auto"
              )
            }
          >
            🤖 Tự nhận diện
          </ModeButton>

          <ModeButton
            active={
              mode ===
              "vi-ko"
            }
            onClick={() =>
              setMode(
                "vi-ko"
              )
            }
          >
            🇻🇳 → 🇰🇷
          </ModeButton>

          <ModeButton
            active={
              mode ===
              "ko-vi"
            }
            onClick={() =>
              setMode(
                "ko-vi"
              )
            }
          >
            🇰🇷 → 🇻🇳
          </ModeButton>

          <ModeButton
            active={
              mode ===
              "correct"
            }
            onClick={() =>
              setMode(
                "correct"
              )
            }
          >
            🛠️ Sửa câu Hàn
          </ModeButton>

        </div>

      </div>

      {/* =====================================
          INPUT CARD
      ===================================== */}

      <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">

        {/* TEXT */}

        <div>

          <label className="mb-2 block text-sm text-slate-400">
            Câu cần xử lý
          </label>

          <textarea
            value={
              text
            }
            onChange={(
              e
            ) =>
              setText(
                e.target.value
              )
            }
            placeholder={
              mode ===
              "correct"
                ? "Ví dụ: 저는 어제 친구를 만나고 싶어요."
                : "Ví dụ: Ngày mai tôi phải đi làm sớm."
            }
            rows={6}
            className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-lg leading-8 outline-none focus:border-slate-500"
          />

          <div className="mt-2 flex justify-between text-xs text-slate-600">

            <span>
              {
                text.length
              }{" "}
              / 3000
            </span>

            {text && (
              <button
                onClick={() => {
                  setText("");
                  setResult(null);
                }}
                className="hover:text-slate-300"
              >
                Xóa
              </button>
            )}

          </div>

        </div>

        {/* STYLE */}

        <div className="mt-5">

          <label className="mb-2 block text-sm text-slate-400">
            🗣️ Cách nói mong muốn
          </label>

          <select
            value={
              style
            }
            onChange={(
              e
            ) =>
              setStyle(
                e.target
                  .value as Style
              )
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
          >

            <option value="natural">
              🇰🇷 Tự nhiên theo ngữ cảnh
            </option>

            <option value="polite">
              🙂 Lịch sự hằng ngày - 해요체
            </option>

            <option value="casual">
              👤 Thân mật - 반말
            </option>

            <option value="formal">
              🎓 Trang trọng - 합니다체
            </option>

            <option value="honorific">
              🎩 Kính ngữ - 높임말
            </option>

            <option value="work">
              💼 Môi trường công việc
            </option>

            <option value="student">
              🎒 Sinh viên / người trẻ
            </option>

          </select>

        </div>

        {/* CUSTOM REQUEST */}

        <div className="mt-5">

          <label className="mb-2 block text-sm text-slate-400">
            ✨ Yêu cầu riêng
          </label>

          <textarea
            value={
              customRequest
            }
            onChange={(
              e
            ) =>
              setCustomRequest(
                e.target.value
              )
            }
            placeholder="Ví dụ: Dùng ngữ pháp -는데 / cho 3 cách nói / giải thích thật dễ hiểu..."
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 leading-7 outline-none"
          />

        </div>

        {/* QUICK REQUESTS */}

        <div className="mt-4 flex flex-wrap gap-2">

          <QuickButton
            onClick={() =>
              setCustomRequest(
                "Hãy giải thích từng phần của câu thật dễ hiểu."
              )
            }
          >
            🔍 Giải thích từng phần
          </QuickButton>

          <QuickButton
            onClick={() =>
              setCustomRequest(
                "Hãy cho tôi 3 cách nói tự nhiên khác nhau."
              )
            }
          >
            💬 3 cách nói
          </QuickButton>

          <QuickButton
            onClick={() =>
              setCustomRequest(
                "Hãy ưu tiên cách nói tự nhiên như người Hàn thực sự sử dụng."
              )
            }
          >
            🇰🇷 Tự nhiên hơn
          </QuickButton>

          <QuickButton
            onClick={() =>
              setCustomRequest(
                "Hãy giải thích kỹ các điểm ngữ pháp xuất hiện trong câu."
              )
            }
          >
            🧩 Giải thích ngữ pháp
          </QuickButton>

        </div>

        {/* SUBMIT */}

        <button
          onClick={
            translate
          }
          disabled={
            loading
          }
          className="mt-6 w-full rounded-2xl bg-white py-4 text-lg font-bold text-black transition disabled:opacity-50"
        >
          {loading
            ? "✨ Gemini đang xử lý..."
            : mode ===
                "correct"
              ? "🛠️ Kiểm tra & sửa câu"
              : "✨ Dịch bằng Gemini"}
        </button>

      </div>

      {/* =====================================
          EXAMPLE START
      ===================================== */}

      {!result &&
        !loading && (
          <div className="mb-8">

            <p className="mb-3 text-sm text-slate-500">
              Thử nhanh
            </p>

            <div className="grid gap-3 md:grid-cols-3">

              <ExampleCard
                title="🇻🇳 → 🇰🇷"
                text="Ngày mai tôi phải đến trường sớm."
                onClick={() =>
                  useExample(
                    "Ngày mai tôi phải đến trường sớm.",
                    "vi-ko"
                  )
                }
              />

              <ExampleCard
                title="🇰🇷 → 🇻🇳"
                text="요즘 한국 생활에 많이 익숙해졌어요."
                onClick={() =>
                  useExample(
                    "요즘 한국 생활에 많이 익숙해졌어요.",
                    "ko-vi"
                  )
                }
              />

              <ExampleCard
                title="🛠️ Sửa câu"
                text="어제 학교에 가고 싶어요."
                onClick={() =>
                  useExample(
                    "어제 학교에 가고 싶어요.",
                    "correct"
                  )
                }
              />

            </div>

          </div>
        )}

      {/* =====================================
          RESULT
      ===================================== */}

      {result && (
        <div className="space-y-5">

          {/* MAIN RESULT */}

          <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 md:p-8">

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">

              <div className="min-w-0">

                <p className="text-sm text-slate-500">
                  ✨ Kết quả chính
                </p>

                <p className="mt-3 whitespace-pre-line break-words text-3xl font-bold leading-relaxed">
                  {
                    result.mainTranslation
                  }
                </p>

              </div>

              <div className="flex shrink-0 gap-2">

                <button
                  onClick={() =>
                    copyText(
                      result.mainTranslation ||
                        ""
                    )
                  }
                  className="rounded-xl bg-slate-800 px-4 py-3"
                >
                  📋
                </button>

                {containsKorean(
                  result.mainTranslation ||
                    ""
                ) && (
                  <button
                    onClick={() =>
                      speak(
                        result.mainTranslation ||
                          ""
                      )
                    }
                    className="rounded-xl bg-slate-800 px-4 py-3"
                  >
                    🔊
                  </button>
                )}

              </div>

            </div>

            {result.naturalMeaning && (
              <p className="mt-5 leading-7 text-slate-400">
                🇻🇳{" "}
                {
                  result.naturalMeaning
                }
              </p>
            )}

            {result.politeness && (
              <div className="mt-4 inline-block rounded-full bg-slate-800 px-3 py-2 text-xs text-slate-300">
                🗣️{" "}
                {
                  result.politeness
                }
              </div>
            )}

          </div>

          {/* CORRECTION */}

          {result.correction &&
            (mode ===
              "correct" ||
              !result.correction
                .wasCorrect) && (
              <SectionCard
                icon={
                  result.correction
                    .wasCorrect
                    ? "✅"
                    : "🛠️"
                }
                title={
                  result.correction
                    .wasCorrect
                    ? "Câu của bạn ổn"
                    : "Sửa câu"
                }
              >

                <p className="text-xl font-bold leading-8">
                  {
                    result
                      .correction
                      .correctedText
                  }
                </p>

                {result
                  .correction
                  .reason && (
                  <p className="mt-3 leading-7 text-slate-400">
                    {
                      result
                        .correction
                        .reason
                    }
                  </p>
                )}

              </SectionCard>
            )}

          {/* EXPLANATION */}

          {result.explanation && (
            <SectionCard
              icon="💡"
              title="Giải thích"
            >

              <p className="whitespace-pre-line leading-7 text-slate-300">
                {
                  result.explanation
                }
              </p>

            </SectionCard>
          )}

          {/* GRAMMAR */}

          {result.grammarPoints &&
            result.grammarPoints
              .length >
              0 && (
              <SectionCard
                icon="🧩"
                title="Ngữ pháp trong câu"
              >

                <div className="space-y-3">

                  {result.grammarPoints.map(
                    (
                      grammar,
                      index
                    ) => (
                      <div
                        key={`${grammar.pattern}-${index}`}
                        className="rounded-2xl bg-slate-950 p-4"
                      >

                        <div className="flex flex-wrap items-center gap-2">

                          <p className="text-lg font-bold">
                            {
                              grammar.pattern
                            }
                          </p>

                          <span className="text-slate-600">
                            →
                          </span>

                          <p className="text-sm text-slate-300">
                            {
                              grammar.meaning
                            }
                          </p>

                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {
                            grammar.explanation
                          }
                        </p>

                      </div>
                    )
                  )}

                </div>

              </SectionCard>
            )}

          {/* VOCABULARY */}

          {result.vocabulary &&
            result.vocabulary
              .length >
              0 && (
              <SectionCard
                icon="📚"
                title="Từ vựng trong câu"
              >

                <div className="flex flex-wrap gap-2">

                  {result.vocabulary.map(
                    (
                      word,
                      index
                    ) => (
                      <button
                        key={`${word.korean}-${index}`}
                        onClick={() =>
                          speak(
                            word.korean
                          )
                        }
                        className="rounded-xl bg-slate-950 px-4 py-3 text-left transition hover:bg-slate-800"
                      >

                        <p className="font-bold">
                          {
                            word.korean
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            word.meaning
                          }
                        </p>

                      </button>
                    )
                  )}

                </div>

              </SectionCard>
            )}

          {/* ALTERNATIVES */}

          {result.alternatives &&
            result.alternatives
              .length >
              0 && (
              <SectionCard
                icon="💬"
                title="Cách nói khác"
              >

                <div className="space-y-3">

                  {result.alternatives.map(
                    (
                      alternative,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="rounded-2xl bg-slate-950 p-4"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <p className="text-lg font-semibold leading-7">
                              {
                                alternative.korean
                              }
                            </p>

                            <p className="mt-2 text-sm text-slate-400">
                              🇻🇳{" "}
                              {
                                alternative.meaning
                              }
                            </p>

                          </div>

                          <div className="flex gap-2">

                            <button
                              onClick={() =>
                                copyText(
                                  alternative.korean
                                )
                              }
                              className="rounded-lg bg-slate-800 px-3 py-2"
                            >
                              📋
                            </button>

                            <button
                              onClick={() =>
                                speak(
                                  alternative.korean
                                )
                              }
                              className="rounded-lg bg-slate-800 px-3 py-2"
                            >
                              🔊
                            </button>

                          </div>

                        </div>

                        {alternative.nuance && (
                          <p className="mt-3 text-xs leading-6 text-slate-600">
                            💡{" "}
                            {
                              alternative.nuance
                            }
                          </p>
                        )}

                      </div>
                    )
                  )}

                </div>

              </SectionCard>
            )}

          {/* NOTES */}

          {result.notes && (
            <SectionCard
              icon="📝"
              title="Ghi chú cho người học"
            >

              <p className="whitespace-pre-line leading-7 text-slate-400">
                {
                  result.notes
                }
              </p>

            </SectionCard>
          )}

          {/* AGAIN */}

          <button
            onClick={() => {
              setResult(null);

              window.scrollTo({
                top: 0,
                behavior:
                  "smooth",
              });
            }}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-4 font-semibold transition hover:bg-slate-800"
          >
            ✍️ Dịch câu khác
          </button>

        </div>
      )}

    </div>
  );
}

/* =========================================
   MODE BUTTON
========================================= */

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children:
    React.ReactNode;
}) {
  return (
    <button
      onClick={
        onClick
      }
      className={`rounded-2xl px-3 py-4 text-sm font-semibold transition ${
        active
          ? "bg-white text-black"
          : "bg-slate-900 text-slate-400 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

/* =========================================
   QUICK BUTTON
========================================= */

function QuickButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children:
    React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="rounded-full bg-slate-950 px-4 py-2 text-sm text-slate-400 transition hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

/* =========================================
   EXAMPLE CARD
========================================= */

function ExampleCard({
  title,
  text,
  onClick,
}: {
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={
        onClick
      }
      className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:bg-slate-800"
    >

      <p className="text-sm font-semibold">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {text}
      </p>

    </button>
  );
}

/* =========================================
   SECTION CARD
========================================= */

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-6">

      <h3 className="mb-4 text-lg font-bold">
        {icon} {title}
      </h3>

      {children}

    </div>
  );
}

/* =========================================
   CHECK KOREAN
========================================= */

function containsKorean(
  value: string
) {
  return /[\u3131-\uD79D]/.test(
    value
  );
}