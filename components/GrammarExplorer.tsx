"use client";

import { useState } from "react";

import { createClient } from "@/utils/supabase/client";
import { apiFetch } from "@/utils/api-client";

type AnalysisMode = "grammar" | "sentence" | "compare";

type GrammarExample = {
  korean: string;
  vietnamese: string;
  note: string;
};

type SimilarPattern = {
  pattern: string;
  difference: string;
};

type GrammarResult = {
  input: string;
  pattern: string;
  meaning: string;
  structure: string;
  nuance: string;
  level: string;
  examples: GrammarExample[];
  commonMistakes: string[];
  similarPatterns: SimilarPattern[];
};

type SentenceToken = {
  text: string;
  role: string;
  meaning: string;
};

type SentenceGrammarPoint = {
  pattern: string;
  explanation: string;
};

type SentenceResult = {
  originalSentence: string;
  naturalTranslation: string;
  correctedSentence: string;
  correctionNote: string;
  tokens: SentenceToken[];
  grammarPoints: SentenceGrammarPoint[];
  vocabulary: { korean: string; meaning: string }[];
};

type CompareResult = {
  leftPattern: string;
  rightPattern: string;
  summary: string;
  meaning: string;
  nuance: string;
  whenToUse: string;
  differences: string[];
  examples: { left: string; right: string; vietnamese: string }[];
  commonMistakes: string[];
  memoryTip: string;
};

const MODE_LABELS: { value: AnalysisMode; label: string }[] = [
  { value: "grammar", label: "Tra cấu trúc" },
  { value: "sentence", label: "Phân tích câu" },
  { value: "compare", label: "So sánh" },
];

const GRAMMAR_EXAMPLES = ["-는 바람에", "-(으)ㄹ 텐데", "비가 오는 바람에 여행을 못 갔어요."];
const SENTENCE_EXAMPLES = [
  "비가 오는 바람에 여행을 못 갔어요.",
  "한국에 가면 김치를 먹어 보고 싶어요.",
];
const COMPARE_EXAMPLES = [
  ["-는 바람에", "때문에"],
  ["-는 것 같다", "-(으)ㄹ 것 같다"],
];

export default function GrammarExplorer() {
  const [mode, setMode] = useState<AnalysisMode>("grammar");
  const [input, setInput] = useState("");
  const [compareInput, setCompareInput] = useState("");
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [sentenceResult, setSentenceResult] = useState<SentenceResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function changeMode(nextMode: AnalysisMode) {
    setMode(nextMode);
    setResult(null);
    setSentenceResult(null);
    setCompareResult(null);
    setMessage("");
  }

  async function analyze() {
    const value = input.trim();
    const secondValue = compareInput.trim();

    if (!value || (mode === "compare" && !secondValue)) {
      setMessage(
        mode === "compare"
          ? "Hãy nhập đủ hai mẫu ngữ pháp để so sánh."
          : mode === "sentence"
            ? "Hãy nhập câu tiếng Hàn cần phân tích."
            : "Hãy nhập cấu trúc hoặc câu tiếng Hàn."
      );
      return;
    }

    setLoading(true);
    setMessage("");
    setResult(null);
    setSentenceResult(null);
    setCompareResult(null);

    try {
      const response = await apiFetch("/api/ai/grammar/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: value,
          mode,
          ...(mode === "compare" ? { compareWith: secondValue } : {}),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        input?: string;
        pattern?: string;
        meaning?: string;
        structure?: string;
        nuance?: string;
        level?: string;
        examples?: GrammarExample[];
        commonMistakes?: string[];
        similarPatterns?: SimilarPattern[];
        originalSentence?: string;
        naturalTranslation?: string;
        correctedSentence?: string;
        correctionNote?: string;
        tokens?: SentenceToken[];
        grammarPoints?: SentenceGrammarPoint[];
        vocabulary?: { korean: string; meaning: string }[];
        leftPattern?: string;
        rightPattern?: string;
        summary?: string;
        whenToUse?: string;
        differences?: string[];
        memoryTip?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Không thể phân tích ngữ pháp.");
      }

      if (mode === "grammar") {
        if (!payload.pattern) {
          throw new Error("Kết quả tra cứu chưa đủ dữ liệu.");
        }

        setResult({
          input: payload.input || value,
          pattern: payload.pattern,
          meaning: payload.meaning || "",
          structure: payload.structure || "",
          nuance: payload.nuance || "",
          level: payload.level || "",
          examples: (payload.examples || []) as GrammarExample[],
          commonMistakes: payload.commonMistakes || [],
          similarPatterns: payload.similarPatterns || [],
        });
      } else if (mode === "sentence") {
        if (!payload.originalSentence) {
          throw new Error("Kết quả phân tích câu chưa đủ dữ liệu.");
        }

        setSentenceResult({
          originalSentence: payload.originalSentence,
          naturalTranslation: payload.naturalTranslation || "",
          correctedSentence: payload.correctedSentence || payload.originalSentence,
          correctionNote: payload.correctionNote || "",
          tokens: payload.tokens || [],
          grammarPoints: payload.grammarPoints || [],
          vocabulary: payload.vocabulary || [],
        });
      } else {
        if (!payload.leftPattern || !payload.rightPattern) {
          throw new Error("Kết quả so sánh chưa đủ dữ liệu.");
        }

        setCompareResult({
          leftPattern: payload.leftPattern,
          rightPattern: payload.rightPattern,
          summary: payload.summary || "",
          meaning: payload.meaning || "",
          nuance: payload.nuance || "",
          whenToUse: payload.whenToUse || "",
          differences: payload.differences || [],
          examples: (payload.examples || []) as unknown as CompareResult["examples"],
          commonMistakes: payload.commonMistakes || [],
          memoryTip: payload.memoryTip || "",
        });
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể phân tích ngữ pháp."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveGrammar() {
    if (!result) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Bạn cần đăng nhập để lưu ngữ pháp.");
      }

      const { error } = await supabase.from("grammar").insert({
        user_id: user.id,
        pattern: result.pattern,
        meaning: result.meaning,
        explanation: [result.structure, result.nuance].filter(Boolean).join("\n\n"),
        level: result.level || null,
        examples: result.examples.map(({ korean, vietnamese }) => ({ korean, vietnamese })),
        tags: ["AI", "tra cứu"],
        notes: result.commonMistakes.join("\n"),
        status: "learning",
      });

      if (error) {
        throw new Error(error.code === "23505" ? "Bạn đã lưu cấu trúc này rồi." : error.message);
      }

      setMessage("Đã lưu ngữ pháp vào kho cá nhân.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu ngữ pháp.");
    } finally {
      setSaving(false);
    }
  }

  const examples = mode === "grammar" ? GRAMMAR_EXAMPLES : SENTENCE_EXAMPLES;

  return (
    <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">
      <div>
        <p className="text-sm text-slate-500">🔎 Tra cứu & phân tích ngữ pháp</p>
        <h2 className="mt-1 text-xl font-bold">Học ngữ pháp bằng ví dụ</h2>
        <p className="mt-1 text-sm text-slate-400">
          Chọn một chế độ để tra cấu trúc, phân tích câu hoặc so sánh hai mẫu ngữ pháp.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {MODE_LABELS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => changeMode(item.value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              mode === item.value
                ? "bg-white text-black"
                : "border border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void analyze();
        }}
      >
        <div className="grid gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              mode === "sentence"
                ? "Nhập câu tiếng Hàn cần phân tích..."
                : mode === "compare"
                  ? "Mẫu A, ví dụ: -는 바람에"
                  : "Nhập ngữ pháp hoặc câu tiếng Hàn..."
            }
            maxLength={300}
            className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg outline-none focus:border-slate-500"
          />
          {mode === "compare" && (
            <input
              value={compareInput}
              onChange={(event) => setCompareInput(event.target.value)}
              placeholder="Mẫu B, ví dụ: 때문에"
              maxLength={300}
              className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg outline-none focus:border-slate-500"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-white px-6 py-3 font-bold text-black disabled:opacity-50"
        >
          {loading ? "Đang phân tích..." : "Phân tích"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "compare"
          ? COMPARE_EXAMPLES.map(([left, right]) => (
              <button
                key={`${left}-${right}`}
                type="button"
                onClick={() => {
                  setInput(left);
                  setCompareInput(right);
                }}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
              >
                {left} vs {right}
              </button>
            ))
          : examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInput(example)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
              >
                {example}
              </button>
            ))}
      </div>

      {message && (
        <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
          {message}
        </p>
      )}

      {result && <GrammarResultView result={result} saving={saving} onSave={() => void saveGrammar()} />}
      {result && <GrammarPractice result={result} />}
      {sentenceResult && <SentenceResultView result={sentenceResult} />}
      {compareResult && <CompareResultView result={compareResult} />}
    </section>
  );
}

function GrammarResultView({
  result,
  saving,
  onSave,
}: {
  result: GrammarResult;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-2xl font-bold text-white">{result.pattern}</h3>
          {result.level && <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">{result.level}</span>}
        </div>
        <p className="mt-3 text-lg font-semibold text-slate-200">💡 {result.meaning}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="🧩 Cấu trúc" text={result.structure} />
        <InfoCard title="🎯 Sắc thái" text={result.nuance} />
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h3 className="font-bold">📖 Ví dụ</h3>
        <div className="mt-3 space-y-3">
          {result.examples.map((example, index) => (
            <div key={`${example.korean}-${index}`} className="border-l-2 border-slate-700 pl-3">
              <p className="font-semibold text-slate-100">{example.korean}</p>
              <p className="text-sm text-slate-300">{example.vietnamese}</p>
              {example.note && <p className="mt-1 text-xs text-slate-500">{example.note}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="⚠️ Lỗi thường gặp" items={result.commonMistakes} />
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="font-bold">🔄 Ngữ pháp tương tự</h3>
          <div className="mt-3 space-y-3">
            {result.similarPatterns.length === 0 ? (
              <p className="text-sm text-slate-500">Không có mẫu gần nghĩa nổi bật.</p>
            ) : result.similarPatterns.map((item) => (
              <div key={item.pattern}>
                <p className="font-semibold text-slate-200">{item.pattern}</p>
                <p className="text-sm text-slate-400">{item.difference}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <button type="button" disabled={saving} onClick={onSave} className="rounded-xl bg-white px-5 py-3 font-bold text-black disabled:opacity-50">
        {saving ? "Đang lưu..." : "⭐ Lưu vào kho ngữ pháp"}
      </button>
    </div>
  );
}

function GrammarPractice({ result }: { result: GrammarResult }) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const example = result.examples[0];
  const expected = example?.korean || "";
  const blankSentence = expected.replace(result.pattern, "___");
  const isCorrect = Boolean(answer.trim() && expected.includes(answer.trim()));

  if (!example) return null;

  return (
    <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Luy&#7879;n ng&#7919; ph&#225;p</p>
          <p className="mt-1 font-semibold text-white">&#272;i&#7873;n ph&#7847;n c&#242;n thi&#7871;u b&#7857;ng m&#7851;u {result.pattern}</p>
        </div>
        {checked && <span className={isCorrect ? "text-emerald-300" : "text-rose-300"}>{isCorrect ? "\u0110\u00fang r\u1ed3i" : "Th\u1eed l\u1ea1i"}</span>}
      </div>
      <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3 text-lg text-slate-100">{blankSentence}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={answer} onChange={(event) => { setAnswer(event.target.value); setChecked(false); }} placeholder="Nh\u1eadp ph\u1ea7n c\u00f2n thi\u1ebfu..." className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-300" />
        <button type="button" onClick={() => setChecked(true)} className="rounded-xl bg-amber-300 px-4 py-2 font-bold text-slate-950">Ki&#7875;m tra</button>
      </div>
      {checked && !isCorrect && <p className="mt-2 text-sm text-slate-400">&#272;&#225;p &#225;n tham kh&#7843;o: {expected}</p>}
    </div>
  );
}

function SentenceResultView({ result }: { result: SentenceResult }) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-xl font-bold text-white">{result.originalSentence}</p>
        <p className="mt-2 text-lg text-slate-300">{result.naturalTranslation}</p>
        <div className="mt-4 border-t border-slate-800 pt-4">
          <p className="text-sm font-semibold text-slate-400">Kiểm tra độ tự nhiên</p>
          <p className="mt-1 text-slate-200">{result.correctedSentence}</p>
          <p className="mt-1 text-sm text-slate-400">{result.correctionNote}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h3 className="font-bold">🔍 Tách thành phần câu</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {result.tokens.map((token, index) => (
            <div key={`${token.text}-${index}`} className="rounded-xl border border-slate-800 p-3">
              <p className="font-semibold text-slate-100">{token.text}</p>
              <p className="text-xs text-slate-500">{token.role}</p>
              <p className="mt-1 text-sm text-slate-300">{token.meaning}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="🧩 Ngữ pháp trong câu" items={result.grammarPoints.map((point) => `${point.pattern}: ${point.explanation}`)} />
        <ListCard title="📚 Từ vựng đáng chú ý" items={result.vocabulary.map((word) => `${word.korean}: ${word.meaning}`)} />
      </div>
    </div>
  );
}

function CompareResultView({ result }: { result: CompareResult }) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <h3 className="rounded-xl border border-slate-800 p-3 text-xl font-bold text-white">A · {result.leftPattern}</h3>
          <h3 className="rounded-xl border border-slate-800 p-3 text-xl font-bold text-white">B · {result.rightPattern}</h3>
        </div>
        <p className="mt-4 text-lg font-semibold text-slate-200">{result.summary}</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{result.meaning}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="🎯 Sắc thái" text={result.nuance} />
        <InfoCard title="🗣️ Khi nào dùng" text={result.whenToUse} />
      </div>
      <ListCard title="📌 Khác biệt quan trọng" items={result.differences} />
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h3 className="font-bold">📖 Ví dụ song song</h3>
        <div className="mt-3 space-y-3">
          {result.examples.map((example, index) => (
            <div key={`${example.left}-${index}`} className="grid gap-2 border-b border-slate-800 pb-3 last:border-0 md:grid-cols-2">
              <p className="text-sm text-slate-200">A: {example.left}</p>
              <p className="text-sm text-slate-200">B: {example.right}</p>
              <p className="text-sm text-slate-400 md:col-span-2">{example.vietnamese}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="⚠️ Lỗi thường gặp" items={result.commonMistakes} />
        <InfoCard title="🧠 Mẹo ghi nhớ" text={result.memoryTip} />
      </div>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{text || "Chưa có thông tin."}</p>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <h3 className="font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Không có dữ liệu nổi bật.</p>
      ) : (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}
