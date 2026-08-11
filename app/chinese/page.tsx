"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { speakChinese } from "@/utils/chinese-speech";
import { apiFetch } from "@/utils/api-client";

type StudyStage = {
  id: "foundation" | "hsk1" | "hsk2" | "hsk3" | "hsk4";
  label: string;
  duration: string;
  goal: string;
  focus: string[];
  checkpoint: string;
  color: string;
};

type StarterWord = {
  hanzi: string;
  pinyin: string;
  meaning: string;
  example: string;
  translation: string;
};

type AiWord = {
  hanzi: string;
  pinyin: string;
  meaning: string;
  partOfSpeech: string;
  exampleChinese: string;
  examplePinyin: string;
  exampleVietnamese: string;
  memoryTip: string;
};

type GeminiVocabularyResponse = {
  ok: boolean;
  error?: string;
  title?: string;
  description?: string;
  vocabulary?: AiWord[];
};

const stages: StudyStage[] = [
  { id: "foundation", label: "Nền tảng", duration: "2 tuần", goal: "Đọc pinyin chắc, nghe rõ 4 thanh và nói được câu chào hỏi cơ bản.", focus: ["Pinyin + thanh điệu", "50–70 từ sống còn", "Câu khẳng định / phủ định / hỏi"], checkpoint: "Tự giới thiệu 45 giây, không nhìn phiên âm.", color: "border-rose-300/35 bg-rose-500/10 text-rose-100" },
  { id: "hsk1", label: "HSK 1", duration: "6–8 tuần", goal: "Dùng tiếng Trung trong các tình huống rất quen thuộc, ngắn và chậm.", focus: ["Gia đình, thời gian, mua sắm", "Số lượng và từ để hỏi", "Nghe câu ngắn mỗi ngày"], checkpoint: "Hiểu hội thoại ngắn và trả lời 8/10 câu cơ bản.", color: "border-amber-300/35 bg-amber-500/10 text-amber-100" },
  { id: "hsk2", label: "HSK 2", duration: "8–10 tuần", goal: "Nói được về sinh hoạt, lịch hẹn và trải nghiệm đơn giản bằng nhiều câu nối tiếp.", focus: ["Động từ kết quả, so sánh", "Phương hướng, du lịch, sức khỏe", "Đọc đoạn ngắn có ngữ cảnh"], checkpoint: "Kể lại lịch một ngày bằng 8–10 câu.", color: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" },
  { id: "hsk3", label: "Mục tiêu HSK 3", duration: "10–12 tuần", goal: "Giao tiếp độc lập trong đời sống quen thuộc và bắt đầu luyện bài đọc, nghe theo dạng đề.", focus: ["Bổ ngữ, liên từ, kể chuyện", "Nghe hội thoại tốc độ vừa", "Viết câu và đoạn ngắn"], checkpoint: "Làm bài luyện hỗn hợp, ghi lại lỗi theo chủ điểm.", color: "border-sky-300/35 bg-sky-500/10 text-sky-100" },
  { id: "hsk4", label: "Mục tiêu HSK 4", duration: "12–16 tuần", goal: "Diễn đạt quan điểm và theo dõi nội dung dài hơn bằng vốn từ có hệ thống.", focus: ["Câu phức và sắc thái", "Đọc ý chính / suy luận", "Viết đoạn có bố cục"], checkpoint: "Làm đề mô phỏng theo thời gian và ôn lỗi lặp lại.", color: "border-violet-300/35 bg-violet-500/10 text-violet-100" },
];

const firstWeek = [
  ["Ngày 1", "Tai nghe trước, miệng theo sau", "4 thanh + 10 âm tiết; thu âm 3 phút."],
  ["Ngày 2", "Pinyin không đoán mò", "Luyện j/q/x, zh/ch/sh và ü bằng cặp âm."],
  ["Ngày 3", "Câu đầu tiên", "Nói tên, quốc tịch, nghề nghiệp với 是 / 不 / 吗."],
  ["Ngày 4", "Số và thời gian", "Hỏi giờ, ngày, số điện thoại; nói lại không nhìn mẫu."],
  ["Ngày 5", "Từ vựng có ngữ cảnh", "Học 12 từ qua 6 câu ngắn, không học danh sách rời."],
  ["Ngày 6", "Nghe – nhại", "Nghe 5 câu, nhại chậm rồi nghe lại giọng mình."],
  ["Ngày 7", "Ôn và kiểm tra", "Tự giới thiệu 45 giây + ôn lại các từ còn quên."],
];

const starterWords: StarterWord[] = [
  { hanzi: "你好", pinyin: "nǐ hǎo", meaning: "xin chào", example: "你好！", translation: "Xin chào!" },
  { hanzi: "谢谢", pinyin: "xiè xie", meaning: "cảm ơn", example: "谢谢你。", translation: "Cảm ơn bạn." },
  { hanzi: "我", pinyin: "wǒ", meaning: "tôi / mình", example: "我是学生。", translation: "Tôi là học sinh." },
  { hanzi: "你", pinyin: "nǐ", meaning: "bạn", example: "你好吗？", translation: "Bạn khỏe không?" },
  { hanzi: "是", pinyin: "shì", meaning: "là", example: "我是越南人。", translation: "Tôi là người Việt Nam." },
  { hanzi: "不", pinyin: "bù", meaning: "không", example: "我不是老师。", translation: "Tôi không phải giáo viên." },
  { hanzi: "吗", pinyin: "ma", meaning: "trợ từ hỏi", example: "你是学生吗？", translation: "Bạn là học sinh à?" },
  { hanzi: "再见", pinyin: "zài jiàn", meaning: "tạm biệt", example: "明天见！", translation: "Hẹn gặp ngày mai!" },
];

const diagnostic = [
  { question: "Bạn đã đọc pinyin có dấu thanh chưa?", options: ["Chưa từng", "Biết một ít", "Khá tự tin"], scores: [0, 1, 2] },
  { question: "Bạn có thể tự giới thiệu bằng tiếng Trung?", options: ["Chưa", "1–2 câu", "Một đoạn ngắn"], scores: [0, 1, 2] },
  { question: "Khi nghe một câu chậm, bạn thường…", options: ["Chưa nhận ra từ", "Bắt được vài từ", "Hiểu ý chính"], scores: [0, 1, 2] },
  { question: "Mục tiêu gần nhất của bạn là gì?", options: ["Nói cơ bản", "HSK 1–2", "HSK 3–4"], scores: [0, 1, 2] },
];

function suggestedStage(score: number) {
  if (score <= 2) return stages[0];
  if (score <= 4) return stages[1];
  if (score <= 6) return stages[2];
  return stages[3];
}

export default function ChineseStudyPage() {
  const [activeStageId, setActiveStageId] = useState<StudyStage["id"]>("foundation");
  const [activeDay, setActiveDay] = useState(0);
  const [activeWord, setActiveWord] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [aiLevel, setAiLevel] = useState("HSK 1");
  const [aiTopic, setAiTopic] = useState("giao tiếp hằng ngày");
  const [aiCount, setAiCount] = useState(12);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [aiTitle, setAiTitle] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiWords, setAiWords] = useState<AiWord[]>([]);
  const [aiWordIndex, setAiWordIndex] = useState(0);
  const [showAiMeaning, setShowAiMeaning] = useState(false);

  const activeStage = stages.find((stage) => stage.id === activeStageId) ?? stages[0];
  const currentWord = starterWords[activeWord];
  const diagnosticScore = useMemo(() => answers.reduce((total, answer, index) => total + diagnostic[index].scores[answer], 0), [answers]);
  const recommendation = answers.length === diagnostic.length ? suggestedStage(diagnosticScore) : null;
  const currentAiWord = aiWords[aiWordIndex];

  function chooseDiagnostic(questionIndex: number, answerIndex: number) {
    setAnswers((previous) => {
      const next = [...previous];
      next[questionIndex] = answerIndex;
      return next;
    });
  }

  function chooseStarterWord(index: number) {
    setActiveWord(index);
    setShowMeaning(false);
  }

  function chooseAiWord(index: number) {
    setAiWordIndex(index);
    setShowAiMeaning(false);
  }

  async function generateGeminiDeck() {
    setGenerating(true);
    setGenerationError("");
    try {
      const response = await apiFetch("/api/ai/chinese-vocabulary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: aiLevel, topic: aiTopic, count: aiCount }) });
      const data = (await response.json()) as GeminiVocabularyResponse;
      if (!response.ok || !data.ok || !data.vocabulary?.length) {
        setGenerationError(data.error || "Gemini chưa tạo được bộ học liệu. Hãy thử lại sau.");
        return;
      }
      setAiTitle(data.title || `Bộ học ${aiLevel}`);
      setAiDescription(data.description || "Bộ từ vựng do Gemini tạo riêng cho bạn.");
      setAiWords(data.vocabulary);
      setAiWordIndex(0);
      setShowAiMeaning(false);
    } catch {
      setGenerationError("Không thể kết nối Gemini lúc này. Hãy thử lại sau.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080d1d] text-slate-100">
      <div className="relative isolate overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] bg-[radial-gradient(circle_at_12%_12%,rgba(220,38,38,0.3),transparent_30%),radial-gradient(circle_at_83%_24%,rgba(251,191,36,0.18),transparent_26%),linear-gradient(180deg,#171126_0%,#080d1d_82%)]" />
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-10 md:py-7">
          <Link href="/chinese" className="flex items-center gap-3 font-bold tracking-tight"><span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500 text-xl shadow-lg shadow-red-950/50">中</span><span>Mandarin Path<span className="mt-0.5 block text-xs font-normal text-slate-400">Từ nền tảng đến HSK 3–4</span></span></Link>
          <div className="flex items-center gap-2 text-sm"><a href="#lo-trinh" className="hidden rounded-xl px-3 py-2 text-slate-300 hover:text-white sm:block">Lộ trình</a><a href="#gemini" className="hidden rounded-xl px-3 py-2 text-slate-300 hover:text-white sm:block">Gemini AI</a><Link href="/" className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 font-medium text-slate-200 transition hover:border-slate-500">KR · Tiếng Hàn</Link></div>
        </header>
        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-8 md:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-24 lg:pt-14">
          <div><p className="inline-flex rounded-full border border-red-400/35 bg-red-950/40 px-3 py-1.5 text-xs font-semibold tracking-wide text-red-200">HỌC CÓ LỘ TRÌNH · ÔN CÓ HỆ THỐNG</p><h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-white md:text-6xl">Từ <span className="text-red-400">pinyin</span> đến mục tiêu HSK 3–4.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">Bắt đầu từ âm, thanh điệu và câu ngắn. Mỗi chặng có mục tiêu, bài kiểm tra và lịch ôn để bạn không bị học lan man.</p><div className="mt-8 flex flex-wrap gap-3"><a href="#chan-doan" className="rounded-xl bg-red-500 px-5 py-3 font-bold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400">Chọn điểm bắt đầu</a><a href="#gemini" className="rounded-xl border border-slate-600 bg-slate-900/70 px-5 py-3 font-semibold text-slate-200 transition hover:border-slate-400">Tạo bộ học cùng Gemini</a></div><div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400"><span>✓ Lộ trình 5 chặng</span><span>✓ Luyện nói trên thiết bị</span><span>✓ Gemini cho học liệu mới</span></div></div>
          <article className="rounded-[2rem] border border-red-300/15 bg-slate-950/55 p-5 shadow-2xl shadow-black/30 backdrop-blur md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">BUỔI HỌC HÔM NAY</p><h2 className="mt-2 text-2xl font-bold text-white">Ngày {activeDay + 1}: {firstWeek[activeDay][1]}</h2></div><span className="rounded-2xl bg-red-500/15 px-3 py-2 text-sm font-bold text-red-200">20–30 phút</span></div><p className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-6 text-slate-300">{firstWeek[activeDay][2]}</p><div className="mt-5 grid grid-cols-7 gap-2">{firstWeek.map(([day], index) => <button key={day} type="button" onClick={() => setActiveDay(index)} className={`rounded-xl px-2 py-3 text-xs font-bold transition ${activeDay === index ? "bg-red-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{index + 1}</button>)}</div><p className="mt-4 text-xs text-slate-500">7 ngày đầu tiên ưu tiên âm thanh, câu dùng ngay và ôn lặp lại.</p></article>
        </section>
      </div>

      <section id="lo-trinh" className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20"><div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-300">BẢN ĐỒ HỌC TẬP</p><h2 className="mt-2 text-3xl font-black text-white md:text-4xl">Đi từ cơ bản, rồi mới tăng tốc đến HSK 3–4.</h2><p className="mt-3 leading-7 text-slate-400">Thời lượng là gợi ý cho nhịp học đều 5 ngày/tuần. Mỗi chặng chỉ qua khi bạn hoàn thành điểm kiểm tra của chính chặng đó.</p></div><div className="mt-9 grid gap-4 lg:grid-cols-5">{stages.map((stage, index) => <button key={stage.id} type="button" onClick={() => setActiveStageId(stage.id)} className={`rounded-3xl border p-5 text-left transition ${activeStage.id === stage.id ? `${stage.color} ring-2 ring-white/40` : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"}`}><span className="text-xs font-black">0{index + 1}</span><h3 className="mt-5 text-xl font-bold text-white">{stage.label}</h3><p className="mt-1 text-xs font-semibold text-slate-400">{stage.duration}</p><p className="mt-4 text-sm leading-6">{stage.goal}</p></button>)}</div><article className={`mt-5 rounded-3xl border p-6 ${activeStage.color}`}><div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">CHẶNG ĐANG XEM</p><h3 className="mt-2 text-2xl font-black">{activeStage.label}</h3><p className="mt-4 text-sm leading-6">Mốc hoàn thành: <strong>{activeStage.checkpoint}</strong></p></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">HỌC GÌ MỖI TUẦN</p><ul className="mt-3 grid gap-2 text-sm md:grid-cols-3">{activeStage.focus.map((focus) => <li key={focus} className="rounded-xl bg-black/15 p-3">{focus}</li>)}</ul></div></div></article></section>

      <section id="chan-doan" className="border-y border-slate-800 bg-slate-900/45"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-[1fr_0.8fr]"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-300">CHẨN ĐOÁN NHANH · 1 PHÚT</p><h2 className="mt-2 text-3xl font-black text-white">Chọn đúng điểm bắt đầu trước khi học.</h2><div className="mt-7 space-y-5">{diagnostic.map((item, questionIndex) => <fieldset key={item.question}><legend className="text-sm font-semibold text-slate-200">{questionIndex + 1}. {item.question}</legend><div className="mt-3 grid gap-2 sm:grid-cols-3">{item.options.map((option, optionIndex) => <button key={option} type="button" onClick={() => chooseDiagnostic(questionIndex, optionIndex)} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${answers[questionIndex] === optionIndex ? "border-sky-300 bg-sky-400/15 text-white" : "border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-500"}`}>{option}</button>)}</div></fieldset>)}</div></div><aside className="self-start rounded-[2rem] border border-sky-300/20 bg-[linear-gradient(135deg,rgba(14,116,144,0.2),rgba(15,23,42,0.96))] p-6 md:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">GỢI Ý CỦA BẠN</p>{recommendation ? <><h3 className="mt-4 text-3xl font-black text-white">{recommendation.label}</h3><p className="mt-4 leading-7 text-slate-300">{recommendation.goal}</p><div className="mt-6 rounded-2xl bg-black/20 p-4"><p className="text-xs font-bold text-sky-200">BƯỚC TIẾP THEO</p><p className="mt-2 text-sm leading-6 text-slate-300">Bắt đầu với {recommendation.focus[0].toLowerCase()}, sau đó tạo bộ từ cùng Gemini theo đúng chặng này.</p></div><button type="button" onClick={() => setActiveStageId(recommendation.id)} className="mt-6 rounded-xl bg-sky-300 px-4 py-3 font-bold text-sky-950 hover:bg-sky-200">Xem chặng học</button></> : <><h3 className="mt-4 text-2xl font-bold text-white">Trả lời 4 câu để nhận lộ trình.</h3><p className="mt-3 text-sm leading-6 text-slate-400">Không phải bài thi xếp lớp chính thức; đây là cách chọn bài khởi động phù hợp để bạn có thể bắt đầu ngay.</p><div className="mt-8 text-5xl font-black text-sky-300">{answers.length}/4</div></>}</aside></div></section>

      <section className="mx-auto grid max-w-7xl gap-9 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-300">THẺ NỀN TẢNG</p><h2 className="mt-2 text-3xl font-black text-white md:text-4xl">Từ đầu tiên phải đi cùng âm và câu.</h2><p className="mt-4 leading-7 text-slate-400">Nghe trước, tự đoán nghĩa rồi lật thẻ. Khi bấm phát âm, hệ thống dùng giọng Trung có sẵn trên thiết bị của bạn.</p><div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">{starterWords.map((word, index) => <button key={word.hanzi} type="button" onClick={() => chooseStarterWord(index)} className={`rounded-xl border px-4 py-3 text-left transition ${activeWord === index ? "border-violet-300 bg-violet-500/15 text-white" : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"}`}><span lang="zh" className="chinese-text text-xl font-bold">{word.hanzi}</span><span className="ml-2 text-xs">{word.pinyin}</span></button>)}</div></div><article className="min-h-[360px] rounded-[2rem] border border-violet-300/20 bg-[linear-gradient(135deg,rgba(109,40,217,0.26),rgba(15,23,42,0.92)_55%)] p-7 shadow-xl shadow-violet-950/15 md:p-10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">THẺ {activeWord + 1}/{starterWords.length}</p><p lang="zh" className="chinese-text mt-8 text-7xl font-black text-white md:text-8xl">{currentWord.hanzi}</p><p className="mt-3 text-2xl font-semibold text-violet-200">{currentWord.pinyin}</p>{showMeaning ? <div className="mt-7 rounded-2xl bg-black/25 p-5"><p className="text-xl font-bold text-white">{currentWord.meaning}</p><p lang="zh" className="chinese-text mt-3 text-lg text-slate-200">{currentWord.example}</p><p className="mt-1 text-sm text-slate-400">{currentWord.translation}</p></div> : <p className="mt-8 text-sm text-slate-400">Tự nói nghĩa trước khi lật đáp án.</p>}<div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={() => setShowMeaning((value) => !value)} className="rounded-xl bg-white px-4 py-3 font-bold text-slate-900 hover:bg-violet-100">{showMeaning ? "Ẩn đáp án" : "Lật đáp án"}</button><button type="button" onClick={() => speakChinese(currentWord.hanzi)} className="rounded-xl border border-violet-200/30 bg-violet-950/30 px-4 py-3 font-bold text-violet-100 hover:bg-violet-900/50">Phát âm</button></div></article></section>

      <section id="gemini" className="border-y border-violet-300/15 bg-[#0b1022]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-[0.9fr_1.1fr]"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-300">GEMINI STUDY LAB</p><h2 className="mt-2 text-3xl font-black text-white md:text-4xl">Tạo bộ học tiếng Trung theo đúng mục tiêu.</h2><p className="mt-4 max-w-xl leading-7 text-slate-400">Gemini tạo từ mới, phiên âm đủ dấu thanh, câu ví dụ, dịch nghĩa và mẹo nhớ bằng tiếng Việt. Tất cả là nội dung luyện tập mới, không phải danh sách HSK chính thức.</p><div className="mt-8 space-y-5 rounded-3xl border border-violet-400/20 bg-violet-950/10 p-6"><label className="block text-sm font-medium text-slate-300"><span className="mb-2 block">Mục tiêu</span><select value={aiLevel} onChange={(event) => setAiLevel(event.target.value)} className="form-control"><option>HSK 1</option><option>HSK 2</option><option>HSK 3</option><option>HSK 4</option></select></label><label className="block text-sm font-medium text-slate-300"><span className="mb-2 block">Chủ đề muốn học</span><input value={aiTopic} onChange={(event) => setAiTopic(event.target.value)} maxLength={180} placeholder="Ví dụ: phỏng vấn xin việc, du lịch, sở thích..." className="form-control" /></label><label className="block text-sm font-medium text-slate-300"><span className="mb-2 block">Số từ trong bộ học</span><select value={aiCount} onChange={(event) => setAiCount(Number(event.target.value))} className="form-control"><option value={12}>12 từ · khởi động</option><option value={20}>20 từ · một buổi học</option><option value={30}>30 từ · ôn chuyên đề</option></select></label>{generationError && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{generationError}</p>}<button type="button" onClick={generateGeminiDeck} disabled={generating} className="rounded-xl bg-violet-300 px-5 py-3 font-bold text-violet-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50">{generating ? "Gemini đang tạo bộ học..." : "Tạo bộ học với Gemini"}</button></div><p className="mt-4 text-xs leading-5 text-slate-500">Cần đăng nhập và cấu hình <code>GEMINI_API_KEY</code> trong <code>.env.local</code>. Một khóa Gemini dùng chung được cho cả tiếng Trung và TOPIK; khóa không bao giờ hiển thị ở trình duyệt.</p></div>
        <article className="min-h-[500px] rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6 md:p-8">{currentAiWord ? <><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">{aiTitle}</p><h3 className="mt-2 text-lg font-bold text-white">{aiDescription}</h3><div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">{aiWords.map((word, index) => <button key={`${word.hanzi}-${index}`} type="button" onClick={() => chooseAiWord(index)} className={`rounded-xl border px-3 py-2 text-left transition ${aiWordIndex === index ? "border-violet-300 bg-violet-500/20" : "border-slate-700 bg-slate-950/50 hover:border-slate-500"}`}><span lang="zh" className="chinese-text text-lg font-bold text-white">{word.hanzi}</span><span className="block text-[11px] text-slate-400">{index + 1}</span></button>)}</div><div className="mt-7 rounded-3xl border border-violet-300/20 bg-[radial-gradient(circle_at_80%_10%,rgba(167,139,250,0.16),transparent_36%),#090d1d] p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p lang="zh" className="chinese-text text-5xl font-black text-white">{currentAiWord.hanzi}</p><p className="mt-2 text-xl font-semibold text-violet-200">{currentAiWord.pinyin}</p><p className="mt-2 text-xs uppercase tracking-wider text-slate-500">{currentAiWord.partOfSpeech}</p></div><button type="button" onClick={() => speakChinese(currentAiWord.hanzi)} className="rounded-xl border border-violet-300/30 px-3 py-2 text-sm font-bold text-violet-100 hover:bg-violet-500/15">Nghe</button></div>{showAiMeaning ? <div className="mt-6 space-y-4 border-t border-slate-700 pt-5"><p className="font-bold text-white">{currentAiWord.meaning}</p><div><p lang="zh" className="chinese-text text-slate-200">{currentAiWord.exampleChinese}</p><p className="mt-1 text-sm text-violet-200">{currentAiWord.examplePinyin}</p><p className="mt-1 text-sm text-slate-400">{currentAiWord.exampleVietnamese}</p></div><p className="rounded-xl bg-violet-500/10 p-3 text-sm leading-6 text-violet-100">Mẹo nhớ: {currentAiWord.memoryTip}</p></div> : <p className="mt-6 text-sm text-slate-400">Đoán nghĩa, rồi lật thẻ để xem ví dụ và mẹo nhớ.</p>}<button type="button" onClick={() => setShowAiMeaning((value) => !value)} className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-violet-100">{showAiMeaning ? "Ẩn đáp án" : "Lật đáp án"}</button></div></> : <div className="flex min-h-[430px] flex-col justify-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-400/15 text-2xl text-violet-200">✦</span><h3 className="mt-6 text-2xl font-bold text-white">Bộ học cá nhân sẽ hiện ở đây.</h3><p className="mt-3 max-w-md leading-7 text-slate-400">Chọn trình độ và chủ đề ở bên trái. Gemini sẽ tạo thẻ từ vựng có thể nghe, lật và ôn từng từ.</p><ul className="mt-7 space-y-3 text-sm text-slate-400"><li>• HSK 1–4 và chủ đề tự chọn</li><li>• Pinyin có dấu thanh</li><li>• Ví dụ, dịch nghĩa, mẹo nhớ tiếng Việt</li></ul></div>}</article></div></section>
      <footer className="mx-auto max-w-7xl px-5 py-10 text-sm leading-6 text-slate-500 md:px-10">Gợi ý nhịp ôn: học mới 20–30 phút, ôn lại sau 1 ngày · 3 ngày · 7 ngày. Khi lên HSK 3–4, hãy giữ một sổ lỗi riêng cho thanh điệu, từ vựng và mẫu câu thường sai.</footer>
    </main>
  );
}
