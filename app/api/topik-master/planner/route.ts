import { NextResponse } from "next/server";
import { asObject, boundedInteger, getTopikMasterContext } from "@/utils/topik-master/server";
import type { PlannerTask } from "@/utils/topik-master/types";

function seoulDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function serializeTask(task: Record<string, unknown>): PlannerTask {
  const completedCount = Number(task.completed_count) || 0;
  const targetCount = Number(task.target_count) || 1;
  return {
    id: String(task.id),
    taskKey: String(task.task_key),
    dueDate: String(task.due_date),
    skill: String(task.skill),
    taskType: String(task.task_type),
    title: String(task.title),
    description: String(task.description || ""),
    targetCount,
    completedCount,
    completed: completedCount >= targetCount,
  };
}

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const today = seoulDate();
  let tasksResult = await context.supabase
    .from("topik_master_planner_tasks")
    .select("id,task_key,due_date,skill,task_type,title,description,target_count,completed_count,completed_at")
    .eq("user_id", context.user.id)
    .eq("due_date", today)
    .order("created_at");
  if (tasksResult.error) return NextResponse.json({ ok: false, error: "Study Planner chưa sẵn sàng." }, { status: 503 });

  if (!tasksResult.error) {
    const [stats, due, dueVocabulary, dueGrammar] = await Promise.all([
      context.supabase.from("topik_master_skill_stats").select("skill,weakness_score,attempts,correct_count").eq("user_id", context.user.id).order("weakness_score", { ascending: false }).limit(5),
      context.supabase.from("topik_master_review_queue").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("due_at", new Date().toISOString()),
      context.supabase.from("topik_master_vocabulary_srs").select("vocabulary_id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("next_review_at", new Date().toISOString()),
      context.supabase.from("topik_master_grammar_progress").select("grammar_id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("next_review_at", new Date().toISOString()),
    ]);
    const weakSkills = (stats.data || []).map((row) => row.skill);
    const primarySkill = weakSkills[0] || "listening";
    const secondarySkill = weakSkills[1] || "reading";
    const primary = (stats.data || []).find((row) => row.skill === primarySkill);
    const primaryAccuracy = primary?.attempts ? Math.round((Number(primary.correct_count) / Number(primary.attempts)) * 100) : 0;
    const primaryTarget = primaryAccuracy < 50 ? 30 : primaryAccuracy < 75 ? 20 : 10;
    const primaryReason = primaryAccuracy < 50 ? "tăng mạnh khối lượng" : primaryAccuracy < 75 ? "ưu tiên củng cố" : "duy trì phong độ";
    const secondary = (stats.data || []).find((row) => row.skill === secondarySkill);
    const secondaryAccuracy = secondary?.attempts ? Math.round((Number(secondary.correct_count) / Number(secondary.attempts)) * 100) : 0;
    const secondaryTarget = secondaryAccuracy >= 75 ? 10 : 15;
    const rows = [
      { user_id: context.user.id, task_key: `weak-${primarySkill}`, due_date: today, skill: primarySkill, task_type: "practice", title: `Luyện trọng tâm: ${primarySkill}`, description: `Study Brain ${primaryReason} ở mức chính xác ${primaryAccuracy}%.`, target_count: primaryTarget },
      { user_id: context.user.id, task_key: "due-review", due_date: today, skill: primarySkill, task_type: "review", title: "Ôn lại câu đến hạn", description: "Xử lý review queue trước khi học nội dung mới.", target_count: Math.max(1, Math.min(20, due.count || 5)) },
      { user_id: context.user.id, task_key: `support-${secondarySkill}`, due_date: today, skill: secondarySkill, task_type: "lesson", title: `Củng cố ${secondarySkill}`, description: `Giữ kỹ năng ${secondarySkill} ở mức ${secondaryAccuracy}% và cân bằng lịch học.`, target_count: secondaryTarget },
      { user_id: context.user.id, task_key: "vocabulary-due", due_date: today, skill: "vocabulary", task_type: "review", title: "Ôn từ vựng SRS", description: "Số lượng được lấy trực tiếp từ lịch ôn cá nhân.", target_count: Math.max(1, Math.min(50, dueVocabulary.count || 20)) },
      { user_id: context.user.id, task_key: "grammar-due", due_date: today, skill: "grammar", task_type: "review", title: "Ôn ngữ pháp SRS", description: "Ưu tiên mẫu đã quên và mẫu đến hạn.", target_count: Math.max(1, Math.min(30, dueGrammar.count || 5)) },
      { user_id: context.user.id, task_key: "writing-daily", due_date: today, skill: "writing", task_type: "writing", title: "Writing 51–54", description: "Luyện một dạng viết và nhận phản hồi theo rubric.", target_count: 1 },
    ];
    await context.supabase.from("topik_master_planner_tasks").upsert(rows, { onConflict: "user_id,due_date,task_key" });
    const activeKeys = new Set(rows.map((row) => row.task_key));
    const staleIds = (tasksResult.data || []).filter((task) => !activeKeys.has(task.task_key) && Number(task.completed_count) === 0).map((task) => task.id);
    if (staleIds.length) await context.supabase.from("topik_master_planner_tasks").delete().eq("user_id", context.user.id).in("id", staleIds);
    tasksResult = await context.supabase
      .from("topik_master_planner_tasks")
      .select("id,task_key,due_date,skill,task_type,title,description,target_count,completed_count,completed_at")
      .eq("user_id", context.user.id)
      .eq("due_date", today)
      .order("created_at");
  }
  return NextResponse.json({ ok: true, date: today, tasks: (tasksResult.data || []).map((task) => serializeTask(task as Record<string, unknown>)) });
}

export async function PATCH(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const body = asObject(await request.json().catch(() => ({})));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "Task id không hợp lệ." }, { status: 400 });
  const existing = await context.supabase.from("topik_master_planner_tasks").select("target_count").eq("id", id).eq("user_id", context.user.id).maybeSingle();
  if (existing.error || !existing.data) return NextResponse.json({ ok: false, error: "Không tìm thấy nhiệm vụ." }, { status: 404 });
  const completedCount = boundedInteger(body.completedCount, 0, existing.data.target_count, existing.data.target_count);
  const updated = await context.supabase.from("topik_master_planner_tasks").update({
    completed_count: completedCount,
    completed_at: completedCount >= existing.data.target_count ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("user_id", context.user.id)
    .select("id,task_key,due_date,skill,task_type,title,description,target_count,completed_count,completed_at")
    .single();
  if (updated.error || !updated.data) return NextResponse.json({ ok: false, error: "Không thể cập nhật nhiệm vụ." }, { status: 500 });
  return NextResponse.json({ ok: true, task: serializeTask(updated.data as Record<string, unknown>) });
}
