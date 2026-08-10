"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "register">(
    "login"
  );

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setMessage("⚠️ Hãy nhập email và mật khẩu.");
      return;
    }

    if (password.length < 6) {
      setMessage("⚠️ Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setMessage(`❌ ${error.message}`);
          return;
        }

        setMessage(
          "✅ Đăng ký thành công. Hãy kiểm tra email để xác nhận tài khoản nếu Supabase yêu cầu."
        );
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          setMessage(`❌ ${error.message}`);
          return;
        }

        setMessage("✅ Đăng nhập thành công!");

        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 700);
      }
    } catch {
      setMessage("❌ Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white">
      <div className="w-full max-w-md">

        {/* LOGO */}

        <div className="mb-8 text-center">
          <div className="text-6xl">
            🇰🇷
          </div>

          <h1 className="mt-4 text-3xl font-bold">
            Korean Study AI
          </h1>

          <p className="mt-2 text-slate-500">
            나만의 한국어 선생님
          </p>
        </div>

        {/* BOX */}

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-950 p-1">

            <button
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={`rounded-lg py-3 text-sm font-semibold ${
                mode === "login"
                  ? "bg-white text-black"
                  : "text-slate-500"
              }`}
            >
              Đăng nhập
            </button>

            <button
              onClick={() => {
                setMode("register");
                setMessage("");
              }}
              className={`rounded-lg py-3 text-sm font-semibold ${
                mode === "register"
                  ? "bg-white text-black"
                  : "text-slate-500"
              }`}
            >
              Đăng ký
            </button>
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              {mode === "login"
                ? "Chào mừng trở lại 👋"
                : "Tạo tài khoản 🚀"}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {mode === "login"
                ? "Đăng nhập để tiếp tục học tiếng Hàn."
                : "Tạo tài khoản để đồng bộ dữ liệu giữa các thiết bị."}
            </p>
          </div>

          {/* EMAIL */}

          <div className="mt-6">
            <label className="mb-2 block text-sm text-slate-400">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="email@example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500"
            />
          </div>

          {/* PASSWORD */}

          <div className="mt-4">
            <label className="mb-2 block text-sm text-slate-400">
              Mật khẩu
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-slate-500"
            />
          </div>

          {/* MESSAGE */}

          {message && (
            <div className="mt-5 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
              {message}
            </div>
          )}

          {/* BUTTON */}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-white py-4 font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
          >
            {loading
              ? "Đang xử lý..."
              : mode === "login"
              ? "Đăng nhập"
              : "Tạo tài khoản"}
          </button>

        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          🇰🇷 조금씩 매일 공부해요
        </p>
      </div>
    </main>
  );
}