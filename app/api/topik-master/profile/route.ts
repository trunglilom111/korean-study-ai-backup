import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";
import {
  TOPIK_MASTER_OWNER_EMAIL,
  isTopikMasterOwner,
} from "@/utils/topik-master/access";

const PROFILE_FIELDS =
  "display_name,current_level,target_level,exam_date,weekly_study_minutes,preferred_skills,current_streak,longest_streak,last_activity_on,updated_at";
const LEVELS = new Set(["TOPIK I · Cấp 1", "TOPIK I · Cấp 2", "TOPIK II · Cấp 3", "TOPIK II · Cấp 4", "TOPIK II · Cấp 5", "TOPIK II · Cấp 6"]);
const SKILLS = new Set(["listening", "reading", "writing", "vocabulary", "grammar"]);

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

async function authorize(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return { error: NextResponse.json({ ok: false, error: "Bạn cần đăng nhập." }, { status: 401 }) };
  if (!isTopikMasterOwner(user.email)) {
    return { error: NextResponse.json({ ok: false, error: "Tài khoản này không có quyền dùng TOPIK Master." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const authorization = await authorize(request);
  if (authorization.error) return authorization.error;

  const { user } = authorization;
  const supabase = await createClient(request);
  const existing = await supabase
    .from("topik_master_profiles")
    .select(PROFILE_FIELDS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json(
      { ok: false, error: "Profile schema chưa được apply. Hãy chạy migration Giai đoạn 1 sau khi duyệt." },
      { status: 503 }
    );
  }

  if (existing.data) return NextResponse.json({ ok: true, profile: existing.data });

  const created = await supabase
    .from("topik_master_profiles")
    .insert({ user_id: user.id, owner_email: TOPIK_MASTER_OWNER_EMAIL })
    .select(PROFILE_FIELDS)
    .single();

  if (created.error) {
    return NextResponse.json({ ok: false, error: "Không thể khởi tạo hồ sơ TOPIK Master." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: created.data });
}

export async function PATCH(request: Request) {
  const authorization = await authorize(request);
  if (authorization.error) return authorization.error;

  const body = asObject(await request.json());
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const currentLevel = typeof body.currentLevel === "string" ? body.currentLevel : "";
  const targetLevel = typeof body.targetLevel === "string" ? body.targetLevel : "";
  const examDate = body.examDate === null || body.examDate === "" ? null : body.examDate;
  const weeklyStudyMinutes = Number(body.weeklyStudyMinutes);
  const preferredSkills = Array.isArray(body.preferredSkills)
    ? [...new Set(body.preferredSkills.filter((skill): skill is string => typeof skill === "string" && SKILLS.has(skill)))]
    : [];

  if (!displayName || displayName.length > 80) {
    return NextResponse.json({ ok: false, error: "Tên hiển thị phải có từ 1 đến 80 ký tự." }, { status: 400 });
  }
  if (!LEVELS.has(currentLevel) || !LEVELS.has(targetLevel)) {
    return NextResponse.json({ ok: false, error: "Cấp TOPIK không hợp lệ." }, { status: 400 });
  }
  if (examDate !== null && !isIsoDate(examDate)) {
    return NextResponse.json({ ok: false, error: "Ngày thi không hợp lệ." }, { status: 400 });
  }
  if (!Number.isInteger(weeklyStudyMinutes) || weeklyStudyMinutes < 30 || weeklyStudyMinutes > 10_080) {
    return NextResponse.json({ ok: false, error: "Thời lượng học tuần phải từ 30 đến 10.080 phút." }, { status: 400 });
  }

  const { user } = authorization;
  const supabase = await createClient(request);
  const saved = await supabase
    .from("topik_master_profiles")
    .upsert(
      {
        user_id: user.id,
        owner_email: TOPIK_MASTER_OWNER_EMAIL,
        display_name: displayName,
        current_level: currentLevel,
        target_level: targetLevel,
        exam_date: examDate,
        weekly_study_minutes: weeklyStudyMinutes,
        preferred_skills: preferredSkills,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select(PROFILE_FIELDS)
    .single();

  if (saved.error) {
    return NextResponse.json({ ok: false, error: "Không thể lưu hồ sơ TOPIK Master." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: saved.data });
}
