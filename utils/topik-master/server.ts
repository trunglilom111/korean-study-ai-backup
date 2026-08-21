import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { createClient } from "@/utils/supabase/server";
import { isTopikMasterOwner } from "@/utils/topik-master/access";

export async function getTopikMasterContext(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Bạn cần đăng nhập." }, { status: 401 }),
    };
  }
  if (!isTopikMasterOwner(user.email)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Tài khoản này không có quyền dùng TOPIK Master." }, { status: 403 }),
    };
  }
  return { ok: true as const, user, supabase: await createClient(request) };
}

export function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}
