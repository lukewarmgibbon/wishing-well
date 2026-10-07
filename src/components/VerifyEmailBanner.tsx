"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MailWarning, X } from "lucide-react";
import type { DefaultSession } from "next-auth";

type User = { emailConfirmed?: boolean } & DefaultSession["user"] & { id: string };

/**
 * A nudge to confirm your email address.
 *
 * Unverified accounts keep working — nothing is locked — but a mistyped address
 * means password resets go to an inbox the person cannot read, and there is no
 * way back from that. The warning used to live only in Settings, which is
 * exactly the page someone does not visit when sign-up goes subtly wrong, so
 * it follows them around until it is dealt with.
 *
 * Dismissible for the session only: a fresh page load brings it back, because
 * the underlying problem does not go away on its own.
 */
export function VerifyEmailBanner({ user }: { user: User | null }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  // The banner is tied to one account; signing in as someone else should not
  // inherit a dismissal that was set for a different person.
  useEffect(() => setDismissed(false), [user?.id]);

  if (!user || user.emailConfirmed || dismissed) return null;
  // Settings already says this, in more detail, with the resend button.
  if (pathname === "/settings") return null;

  return (
    <div className="border-b border-warn-wash bg-[var(--color-warn-bg)] px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <MailWarning className="size-4 shrink-0 text-warn" strokeWidth={1.8} />
        <p className="min-w-0 flex-1 text-[0.8125rem] text-warn">
          Confirm your email address so password resets can reach you.
        </p>
        <Link
          href="/settings"
          className="shrink-0 text-[0.8125rem] font-semibold text-warn underline underline-offset-2 hover:opacity-80"
        >
          Confirm
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss for now"
          className="shrink-0 rounded p-0.5 text-warn/60 transition-colors hover:text-warn"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
