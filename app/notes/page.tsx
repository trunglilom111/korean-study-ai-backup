"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import StudyCanvas from "@/components/StudyCanvas";
import { createClient } from "@/utils/supabase/client";

type NoteCategory = "GRAMMAR" | "VOCABULARY" | "TOPIK" | "SENTENCE" | "OTHER";

type StudyNote = {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  source_type: string | null;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES: { value: NoteCategory; label: string }[] = [
  { value: "GRAMMAR", label: "Ngữ pháp" },
  { value: "VOCABULARY", label: "Từ vựng" },
  { value: "TOPIK", label: "TOPIK sai" },
  { value: "SENTENCE", label: "Câu hay" },
  { value: "OTHER", label: "Khác" },
];

export default function NotesPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState("");
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<NoteCategory>("OTHER");
  const [tagsText, setTagsText] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | "ALL">("ALL");
  const [message, setMessage] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);
    const { data, error } = await supabase
      .from("study_notes")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage("Chưa thể tải sổ tay. Hãy chạy migration Smart Notebook trên Supabase.");
      setNotes([]);
    } else {
      setNotes((data || []) as StudyNote[]);
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotes();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotes]);

  function resetForm() {
    setEditingId("");
    setTitle("");
    setContent("");
    setCategory("OTHER");
    setTagsText("");
  }

  async function saveNote() {
    if (!userId) {
      router.push("/login");
      return;
    }

    if (!content.trim()) {
      setMessage("Hãy nhập nội dung ghi chú.");
      return;
    }

    setSaving(true);
    setMessage("");
    const payload = {
      title: title.trim().slice(0, 160),
      content: content.trim(),
      category,
      tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
      updated_at: new Date().toISOString(),
    };

    const response = editingId
      ? await supabase
          .from("study_notes")
          .update(payload)
          .eq("id", editingId)
          .eq("owner_id", userId)
          .select("*")
          .single()
      : await supabase
          .from("study_notes")
          .insert({ ...payload, owner_id: userId })
          .select("*")
          .single();

    if (response.error || !response.data) {
      setMessage(response.error?.message || "Không thể lưu ghi chú.");
      setSaving(false);
      return;
    }

    const saved = response.data as StudyNote;
    setNotes((current) =>
      editingId
        ? current.map((note) => (note.id === saved.id ? saved : note))
        : [saved, ...current]
    );
    resetForm();
    setMessage(editingId ? "Đã cập nhật ghi chú." : "Đã lưu ghi chú.");
    setSaving(false);
  }

  function editNote(note: StudyNote) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTagsText(note.tags.join(", "));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteNote(note: StudyNote) {
    if (!window.confirm(`Xóa ghi chú "${note.title || "không tiêu đề"}"?`)) {
      return;
    }

    setWorkingId(note.id);
    const { error } = await supabase
      .from("study_notes")
      .delete()
      .eq("id", note.id)
      .eq("owner_id", userId);

    if (error) {
      setMessage(error.message);
    } else {
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (editingId === note.id) resetForm();
      setMessage("Đã xóa ghi chú.");
    }

    setWorkingId("");
  }

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return notes.filter((note) => {
      const matchesCategory = categoryFilter === "ALL" || note.category === categoryFilter;
      const haystack = [note.title, note.content, note.tags.join(" ")].join(" ").toLocaleLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [categoryFilter, notes, search]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center text-slate-400">Đang tải sổ tay...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-slate-400">📓 Kho ghi nhớ của bạn</p>
        <h1 className="mt-1 text-3xl font-bold md:text-4xl">Sổ tay của tôi</h1>
        <p className="mt-2 text-slate-500">Lưu ngữ pháp, từ vựng, câu hay và những lỗi TOPIK cần xem lại.</p>
      </div>

      {message && <p className="mb-5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">{message}</p>}

      <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{editingId ? "Chỉnh sửa" : "Ghi chú mới"}</p>
            <h2 className="mt-1 text-xl font-bold">{editingId ? "Sửa ghi chú" : "Tạo ghi chú"}</h2>
          </div>
          {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">Hủy sửa</button>}
        </div>
        <div className="mt-5 grid gap-4">
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Tiêu đề (không bắt buộc)" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500" />
          <div className="grid gap-3 md:grid-cols-2">
            <select value={category} onChange={(event) => setCategory(event.target.value as NoteCategory)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none">
              {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="Tags, cách nhau bằng dấu phẩy" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500" />
          </div>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20000} rows={7} placeholder="Viết điều bạn muốn nhớ..." className="resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 leading-6 outline-none focus:border-slate-500" />
          <button type="button" disabled={saving} onClick={() => void saveNote()} className="w-fit rounded-xl bg-white px-5 py-3 font-bold text-black disabled:opacity-50">{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Lưu ghi chú"}</button>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm trong sổ tay..." className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-500" />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as NoteCategory | "ALL")} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none">
          <option value="ALL">Tất cả danh mục</option>
          {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-sm text-slate-400">Chưa có ghi chú phù hợp.</div>
        ) : filteredNotes.map((note) => (
          <article key={note.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">{CATEGORIES.find((item) => item.value === note.category)?.label || "Khác"}</p>
                <h2 className="mt-1 text-lg font-bold">{note.title || "Không tiêu đề"}</h2>
              </div>
              <span className="text-xs text-slate-500">{new Date(note.updated_at).toLocaleDateString("vi-VN")}</span>
            </div>
            <p className="mt-4 max-h-40 whitespace-pre-wrap overflow-hidden text-sm leading-6 text-slate-300">{note.content}</p>
            {note.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{note.tags.map((tag) => <span key={tag} className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-400">#{tag}</span>)}</div>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => editNote(note)} className="rounded-xl border border-slate-700 px-3 py-2 text-sm">Sửa</button>
              <button type="button" disabled={workingId === note.id} onClick={() => void deleteNote(note)} className="rounded-xl border border-rose-900 px-3 py-2 text-sm text-rose-300 disabled:opacity-50">Xóa</button>
            </div>
          </article>
        ))}
      </div>

      <StudyCanvas title="Canvas ghi chú" storageKey="korean-study-notebook-canvas" />
    </AppShell>
  );
}
