"use client";

import { useMemo, useState } from "react";

type BatchResult = {
  name: string;
  status: "pending" | "running" | "done" | "error";
  entityType?: string;
  itemCount?: number;
  committed?: number;
  error?: string;
};

type ApiResult = {
  ok?: boolean;
  batchId?: string;
  committed?: number;
  error?: string;
};

async function jsonResponse(response: Response) {
  return await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` })) as ApiResult;
}

export default function TopikMasterImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const summary = useMemo(() => {
    const done = results.filter((result) => result.status === "done");
    return {
      done: done.length,
      errors: results.filter((result) => result.status === "error").length,
      committed: done.reduce((sum, result) => sum + (result.committed || 0), 0),
    };
  }, [results]);

  function chooseFiles(list: FileList | null) {
    const selected = Array.from(list || []).filter((file) => file.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name));
    setFiles(selected);
    setResults(selected.map((file) => ({ name: file.name, status: "pending" })));
    setStartedAt(null);
  }

  function updateResult(index: number, patch: Partial<BatchResult>) {
    setResults((current) => current.map((result, resultIndex) => resultIndex === index ? { ...result, ...patch } : result));
  }

  async function importAll() {
    if (!files.length || running) return;
    setRunning(true);
    setStartedAt(Date.now());

    for (let index = 0; index < files.length; index += 1) {
      if (results[index]?.status === "done") continue;
      const file = files[index];
      updateResult(index, { status: "running", error: undefined });
      try {
        const payload = JSON.parse(await file.text()) as { entityType?: string; items?: unknown[] };
        if (!payload.entityType || !Array.isArray(payload.items) || !payload.items.length) throw new Error("Batch JSON không đúng định dạng.");
        updateResult(index, { entityType: payload.entityType, itemCount: payload.items.length });

        const stagedResponse = await fetch("/api/topik-master/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const staged = await jsonResponse(stagedResponse);
        if (!stagedResponse.ok || !staged.ok || !staged.batchId) throw new Error(staged.error || "Không thể staging batch.");

        const approveResponse = await fetch(`/api/topik-master/import/${staged.batchId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "approve-all" }),
        });
        const approved = await jsonResponse(approveResponse);
        if (!approveResponse.ok || !approved.ok) throw new Error(approved.error || "Không thể duyệt batch.");

        const commitResponse = await fetch(`/api/topik-master/import/${staged.batchId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "commit" }),
        });
        const committed = await jsonResponse(commitResponse);
        if (!commitResponse.ok || !committed.ok) throw new Error(committed.error || "Không thể commit batch.");
        updateResult(index, { status: "done", committed: committed.committed || payload.items.length });
      } catch (error) {
        updateResult(index, { status: "error", error: error instanceof Error ? error.message : String(error) });
        break;
      }
    }

    setRunning(false);
  }

  return (
    <main className="import-page">
      <section className="import-card">
        <p className="eyebrow">TOPIK MASTER · OWNER IMPORT</p>
        <h1>Nhập dữ liệu TOPIK Master</h1>
        <p className="lead">Chọn batch JSON từ điển, ngữ pháp hoặc ngân hàng câu hỏi. Hệ thống kiểm tra nguồn và quyền sử dụng, xử lý tuần tự, giữ câu hỏi ở trạng thái draft và dừng ngay khi gặp lỗi.</p>
        <label className="file-picker">
          <span>Chọn batch JSON</span>
          <input type="file" accept="application/json,.json" multiple onChange={(event) => chooseFiles(event.target.files)} disabled={running} />
        </label>
        <div className="summary">
          <span><strong>{files.length}</strong> batch đã chọn</span>
          <span><strong>{summary.done}</strong> hoàn tất</span>
          <span><strong>{summary.committed.toLocaleString("vi-VN")}</strong> mục đã commit</span>
          <span className={summary.errors ? "has-error" : ""}><strong>{summary.errors}</strong> lỗi</span>
        </div>
        <button className="start" onClick={importAll} disabled={!files.length || running}>
          {running ? `Đang nhập ${summary.done + 1}/${files.length}…` : summary.errors ? "Thử lại từ batch lỗi" : "Bắt đầu nhập"}
        </button>
        {startedAt && <p className="hint">Bắt đầu lúc {new Date(startedAt).toLocaleTimeString("vi-VN")}. Không đóng tab cho đến khi hoàn tất.</p>}
      </section>
      <section className="batch-list" aria-live="polite">
        {results.map((result) => (
          <article key={result.name} className={`batch ${result.status}`}>
            <span className="status-dot" />
            <div><strong>{result.name}</strong><small>{result.error || `${result.entityType || "Chờ xử lý"}${result.itemCount ? ` · ${result.itemCount} mục` : ""}`}</small></div>
            <b>{result.status === "done" ? "✓" : result.status === "running" ? "…" : result.status === "error" ? "!" : ""}</b>
          </article>
        ))}
      </section>
      <style jsx>{`
        :global(body){margin:0;background:#f4f7fb;color:#172033;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.import-page{min-height:100vh;padding:32px 16px 80px}.import-card,.batch-list{width:min(760px,100%);margin:0 auto}.import-card{background:white;border:1px solid #dfe7f1;border-radius:24px;padding:28px;box-shadow:0 18px 60px rgba(31,56,88,.08)}.eyebrow{margin:0 0 8px;color:#167b69;font-size:12px;font-weight:800;letter-spacing:.12em}h1{margin:0;font-size:clamp(28px,5vw,42px)}.lead{color:#657086;line-height:1.65}.file-picker{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:22px 0;padding:16px 18px;border:1px dashed #88adcf;border-radius:16px;background:#f7fbff;font-weight:750}.file-picker input{max-width:240px}.summary{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.summary span{padding:12px;background:#f5f7fa;border-radius:12px;color:#667085}.summary strong{color:#172033}.has-error strong{color:#c83e4d}.start{width:100%;margin-top:18px;border:0;border-radius:14px;padding:15px;background:#176bda;color:white;font-weight:800;font-size:16px;cursor:pointer}.start:disabled{opacity:.5;cursor:not-allowed}.hint{margin-bottom:0;text-align:center;color:#7b8496;font-size:13px}.batch-list{display:grid;gap:8px;margin-top:18px}.batch{display:grid;grid-template-columns:12px 1fr 24px;align-items:center;gap:12px;padding:12px 16px;background:white;border:1px solid #e4e9f0;border-radius:12px}.batch small{display:block;margin-top:3px;color:#7b8496}.status-dot{width:9px;height:9px;border-radius:99px;background:#c7ced8}.batch.running .status-dot{background:#f5a524}.batch.done .status-dot{background:#22a06b}.batch.error{border-color:#efb5bb}.batch.error .status-dot{background:#d64555}.batch.error small{color:#b63341}@media(max-width:560px){.import-page{padding:16px 10px 60px}.import-card{padding:20px;border-radius:18px}.file-picker{align-items:flex-start;flex-direction:column}.summary{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
