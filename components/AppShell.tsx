"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const menu = [
  {
    href: "/",
    icon: "🏠",
    name: "Hôm nay",
  },

  {
    href: "/review",
    icon: "🔁",
    name: "Ôn hôm nay",
  },

  {
    href: "/vocabulary",
    icon: "📚",
    name: "Từ vựng",
  },

  {
    href: "/flashcards",
    icon: "🧠",
    name: "Flashcard",
  },

  {
    href: "/grammar",
    icon: "🧩",
    name: "Ngữ pháp",
  },

  {
    href: "/notes",
    icon: "📓",
    name: "Sổ tay",
  },

  {
    href: "/ai-learning",
    icon: "✨",
    name: "Học liệu AI",
  },

  {
    href: "/shadowing",
    icon: "🎧",
    name: "Shadowing",
  },

  {
    href: "/topik",
    icon: "🎯",
    name: "TOPIK",
  },

  {
    href: "/ai",
    icon: "🤖",
    name: "AI Tutor",
  },
  {
    href: "/chinese",
    icon: "CN",
    name: "Tiếng Trung",
  },
];

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl">

        {/* LAPTOP */}

        <aside className="hidden w-64 shrink-0 border-r border-slate-800 p-6 md:block">

          <div className="mb-10">
            <div className="text-4xl">
              🇰🇷
            </div>

            <h1 className="mt-3 text-xl font-bold">
              Korean Study AI
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              나만의 한국어 선생님
            </p>
          </div>

          <nav className="space-y-2">
            {menu.map((item) => {
              const active =
                isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-xl px-4 py-3 transition ${
                    active
                      ? "bg-white font-semibold text-black"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <span className="mr-3 text-lg">
                    {item.icon}
                  </span>

                  <span>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 border-t border-slate-800 pt-5">
            <div className="rounded-2xl bg-slate-900 p-4">
              <p className="text-xs text-slate-500">
                🎯 Mục tiêu
              </p>

              <p className="mt-1 font-bold">
                TOPIK 6
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-[5%] rounded-full bg-white" />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Hành trình mới bắt đầu
              </p>
            </div>
          </div>
        </aside>

        {/* CONTENT */}

        <section className="min-w-0 flex-1 p-5 pb-28 md:p-10">
          {children}
        </section>
      </div>

      {/* MOBILE */}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
        <div className="flex overflow-x-auto px-2 py-2">

          {menu.map((item) => {
            const active =
              isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-[76px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] ${
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-500"
                }`}
              >
                <span className="text-xl">
                  {item.icon}
                </span>

                <span className="whitespace-nowrap">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
