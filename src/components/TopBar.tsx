"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { DefaultSession } from "next-auth";
import { Flame, LogOut, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

type User = { name?: string | null; image?: string | null } & DefaultSession["user"];

const links = [
  { href: "/lists", label: "My lists" },
  { href: "/gifts", label: "Gifting" },
  { href: "/people", label: "People" },
];

export function TopBar({ user }: { user: User | null }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-v-200 bg-v-0/85 backdrop-blur-lg dark:border-v-800 dark:bg-v-950/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-6 place-items-center rounded-[7px] bg-a-600 text-white shadow-xs">
            <Flame className="size-3.5" strokeWidth={2.2} />
          </span>
          {/* The wordmark yields to the actions on narrow screens; the mark still
              identifies the product, and nothing is unreachable. */}
          <span className="hidden whitespace-nowrap text-[0.9375rem] font-semibold tracking-[-0.015em] sm:inline">
            Wishing Well
          </span>
        </Link>

        {user ? (
          <>
            <nav className="hidden items-center gap-1 sm:flex">
              {links.map((l) => {
                const active = pathname === l.href || pathname.startsWith(l.href + "/");
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`rounded-[7px] px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                      active
                        ? "bg-v-100 text-v-900 dark:bg-v-800 dark:text-v-0"
                        : "text-v-500 hover:bg-v-100 hover:text-v-800 dark:text-v-400 dark:hover:bg-v-800 dark:hover:text-v-100"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              <span className="mr-1 hidden max-w-40 truncate text-[0.8125rem] text-v-500 md:inline dark:text-v-400">
                {user.name ?? user.email}
              </span>
              <ThemeToggle />
              <Link
                href="/settings"
                aria-label="Settings"
                title="Settings"
                className={`grid size-8 place-items-center rounded-[7px] transition-colors ${
                  pathname.startsWith("/settings")
                    ? "bg-v-100 text-v-900 dark:bg-v-800 dark:text-v-0"
                    : "text-v-500 hover:bg-v-100 hover:text-v-800 dark:text-v-400 dark:hover:bg-v-800 dark:hover:text-v-100"
                }`}
              >
                <Settings className="size-4" />
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn btn-ghost"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="btn btn-ghost whitespace-nowrap">Sign in</Link>
            <Link href="/register" className="btn btn-primary whitespace-nowrap">Get started</Link>
          </div>
        )}
      </div>

      {user ? (
        <nav className="flex gap-1 overflow-x-auto border-t border-v-200 px-6 py-2 sm:hidden dark:border-v-800">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="btn btn-secondary shrink-0">
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
