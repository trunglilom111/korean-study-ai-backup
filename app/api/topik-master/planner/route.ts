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

  if (!tasksResult.data?.length) {
    const [stats, due] = await Promise.all([
      context.supabase.from("topik_master_skill_stats").select("skill,weakness_score").eq("user_id", context.user.id).order("weakness_score", { ascending: false }).limit(2),
      context.supabase.from("topik_master_review_queue").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("due_at", new Date().toISOString()),
    ]);
    const weakSkills = (stats.data || []).map((row) => row.skill);
    const primarySkill = weakSkills[0] || "listening";
    const secondarySkill = weakSkills[1] || "reading";
    const rows = [
      { user_id: context.user.id, task_key: `weak-${primarySkill}`, due_date: today, skill: primarySkill, task_type: "practice", title: `Luyện điểm yếu: ${primarySkill}`, description: "Bài luyện được ưu tiên theo weakness score.", target_count: 10 },
      { user_id: context.user.id, task_key: "due-review", due_date: today, skill: primarySkill, task_type: "review", title: "Ôn lại câu đến hạn", description: "Xử lý review queue trước khi học nội dung mới.", target_count: Math.max(1, Math.min(20, due.count || 5)) },
      { user_id: context.user.id, task_key: `support-${secondarySkill}`, due_date: today, skill: secondarySkill, task_type: "lesson", title: `Củng cố ${secondarySkill}`, description: "Giữ cân bằng giữa kỹ năng yếu và mục tiêu TOPIK.", target_count: 1 },
      { user_id: context.user.id, task_key: "writing-daily", due_date: today, skill: "writing", task_type: "writing", title: "Viết đoạn ngắn TOPIK II", description: "Viết và nhận phản hồi theo rubric.", target_count: 1 },
    ];
    await context.supabase.from("topik_master_planner_tasks").upsert(rows, { onConflict: "user_id,due_date,task_key" });
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
