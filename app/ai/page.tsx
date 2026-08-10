import AppShell from "@/components/AppShell";
import AiTranslate from "@/components/AiTranslate";

export default function AIPage() {
  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-slate-400">한국어 AI 선생님</p>
        <h1 className="text-3xl font-bold md:text-4xl">🤖 AI Tutor</h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Dịch, sửa câu và hiểu ngữ pháp tiếng Hàn theo ngữ cảnh.
        </p>
      </div>

      <AiTranslate />
    </AppShell>
  );
}
