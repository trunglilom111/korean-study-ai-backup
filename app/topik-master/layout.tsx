import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { isTopikMasterOwner } from "@/utils/topik-master/access";

export const metadata: Metadata = {
  title: "TOPIK Master",
  description: "Giao diện ôn thi TOPIK cá nhân hóa, tối ưu cho điện thoại.",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function TopikMasterLayout({ children }: { children: ReactNode }) {
  const user = await getAuthenticatedUser();

  if (!user) redirect("/login?next=/topik-master");

  if (!isTopikMasterOwner(user.email)) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-950">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <span className="text-5xl" aria-hidden="true">🔒</span>
          <h1 className="mt-5 text-2xl font-black">TOPIK Master là khu học riêng</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tài khoản đang đăng nhập không nằm trong danh sách được phép. Dữ liệu học và giao diện bên trong chưa được tải.
          </p>
          <Link className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white" href="/">
            Trở về trang chính
          </Link>
        </section>
      </main>
    );
  }

  return children;
}
