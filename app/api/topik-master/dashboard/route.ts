import { NextResponse } from "next/server";
import { getTopikMasterContext } from "@/utils/topik-master/server";
import type { DashboardData } from "@/utils/topik-master/types";

type SkillRow = { skill: string; attempts: number; mastery_score: number; weakness_score: number };

export async function GET(request: Request) {
  const context = await getTopikMasterContext(request);
  if (!context.ok) return context.response;
  const nowIso = new Date().toISOString();
  const [profile, stats, attempts, due] = await Promise.all([
    context.supabase.from("topik_master_profiles").select("exam_date,current_streak").eq("user_id", context.user.id).maybeSingle(),
    context.supabase.from("topik_master_skill_stats").select("skill,attempts,mastery_score,weakness_score").eq("user_id", context.user.id),
    context.supabase.from("topik_attempts").select("id,exam_title,score_percent,created_at").eq("user_id", context.user.id).order("created_at", { ascending: false }).limit(5),
    context.supabase.from("topik_master_review_queue").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).lte("due_at", nowIso),
  ]);

  if (profile.error || stats.error || attempts.error || due.error) {
    return NextResponse.json({ ok: false, error: "Dashboard data chưa sẵn sàng. Hãy apply migration Giai đoạn 1–5." }, { status: 503 });
  }

  const aggregate = new Map<string, { attempts: number; masteryTotal: number; weaknessTotal: number }>();
  for (const row of (stats.data || []) as SkillRow[]) {
    const current = aggregate.get(row.skill) || { attempts: 0, masteryTotal: 0, weaknessTotal: 0 };
    const weight = Math.max(1, row.attempts);
    current.attempts += row.attempts;
    current.masteryTotal += Number(row.mastery_score) * weight;
    current.weaknessTotal += Number(row.weakness_score) * weight;
    aggregate.set(row.skill, current);
  }
  const skills = [...aggregate.entries()].map(([skill, value]) => ({
    skill,
    mastery: Math.round((value.masteryTotal / Math.max(1, value.attempts)) * 100),
    weakness: Math.round((value.weaknessTotal / Math.max(1, value.attempts)) * 100),
    attempts: value.attempts,
  })).sort((left, right) => right.weakness - left.weakness);

  const examDate = profile.data?.exam_date || null;
  const daysUntilExam = examDate
    ? Math.max(0, Math.ceil((Date.parse(`${examDate}T00:00:00+09:00`) - Date.now()) / 86_400_000))
    : null;
  const overallProgress = skills.length
    ? Math.round(skills.reduce((sum, skill) => sum + skill.mastery, 0) / skills.length)
    : 0;
  const dueCount = due.count || 0;
  const weakRecommendations = skills.slice(0, 2).map((skill) => ({
    skill: skill.skill,
    title: `Củng cố ${skill.skill}`,
    reason: `Mastery ${skill.mastery}% · ưu tiên điểm yếu`,
    count: Math.max(5, Math.min(20, Math.ceil(skill.weakness / 5))),
  }));
  const recommendations = [
    ...(dueCount ? [{ skill: "review", title: "Ôn câu đến hạn", reason: `${dueCount} mục đang chờ trong SRS`, count: dueCount }] : []),
    ...weakRecommendations,
  ].slice(0, 4);

  const dashboard: DashboardData = {
    overallProgress,
    streak: profile.data?.current_streak || 0,
    dueReviews: dueCount,
    examDate,
    daysUntilExam,
    skills,
    recent: (attempts.data || []).map((attempt) => ({
      id: attempt.id,
      title: attempt.exam_title,
      score: Number(attempt.score_percent),
      createdAt: attempt.created_at,
    })),
    recommendations,
  };
  return NextResponse.json({ ok: true, dashboard });
}
