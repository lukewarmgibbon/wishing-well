"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

type Mode = "login" | "register";

/**
 * Some embedded contexts refuse to store cookies at all. If that happens
 * sign-in cannot work, so detect it up front and say so plainly rather than
 * letting the user watch a form fail for no visible reason.
 */
function useCookieSupport() {
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Set the cookie over HTTP, then ask the server whether it came back.
        // This exercises the real path — `document.cookie` would not, because
        // the session cookie is HttpOnly anyway.
        await fetch("/api/cookie-probe?set=1", { cache: "no-store" });
        const res = await fetch("/api/cookie-probe", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setBlocked(!data.seen);
      } catch {
        if (!cancelled) setBlocked(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return blocked;
}

/**
 * Sign in with the credentials callback endpoint directly.
 *
 * The `signIn()` helper in the Auth.js v5 beta posts to
 * `/api/auth/signin/<provider>`, which 400s and never establishes a session.
 * `/api/auth/callback/<provider>` is the endpoint that actually works, so we
 * drive it ourselves: fetch a CSRF token, post the credentials, and let the
 * browser follow the redirect that carries the session cookie.
 */
async function signInWithPassword(email: string, password: string) {
  const csrfRes = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!csrfRes.ok) throw new Error("Could not reach the server. Try again.");
  const { csrfToken } = await csrfRes.json();
  if (!csrfToken) throw new Error("Could not get a security token. Try again.");

  // Let fetch follow the redirect so the Set-Cookie on the 302 is applied.
  await fetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csrfToken, email, password, callbackUrl: window.location.origin }),
  });

  // A rejected sign-in and a successful one both end in a 200 page, so ask the
  // server who we are rather than guessing from the response.
  const session = await fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json());
  if (!session?.user?.id) throw new Error("That email and password don't match.");
}

export function AuthForm({ mode, googleEnabled }: { mode: Mode; googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/lists";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cookiesBlocked = useCookieSupport();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not create your account.");
      }

      await signInWithPassword(email, password);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[24rem]">
      <div className="border border-hair px-8 py-10 dark:border-hair-d">
        <h1 className="font-semibold tracking-[-0.02em] text-[2.4rem] leading-[0.95]">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-v-500 dark:text-v-400">
          {mode === "login"
            ? "Sign in to see your lists."
            : "Takes about twenty seconds."}
        </p>

        {cookiesBlocked && (
          <p className="mt-4 rounded-lg border border-a-500/40 bg-a-100 dark:bg-a-900/40 px-3 py-2 text-sm text-a-600 dark:text-a-300">
            <strong>This frame is blocking cookies</strong>, so we can&apos;t keep you signed in here.
            Open the app in its own browser tab (copy the address bar URL out of the preview surface) and
            sign in there — it works normally.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          {mode === "register" && (
            <div>
              <label className="label" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : undefined}
              required
            />
            {mode === "register" && <p className="mt-1.5 text-[0.78rem] text-v-400">At least 8 characters.</p>}
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-a-100 dark:bg-a-900/40 px-3 py-2 text-sm text-a-600 dark:text-a-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary w-full py-3.5">
            {busy ? "Just a moment…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div className="my-8 flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-v-400">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <button
              type="button"
              className="btn btn-secondary w-full py-3.5"
              onClick={() => signIn("google", { callbackUrl: next })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z"
                />
              </svg>
              Continue with Google
            </button>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[0.85rem] text-v-500 dark:text-v-400">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/register" className="link-underline font-semibold text-a-600 dark:text-a-300">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="link-underline font-semibold text-a-600 dark:text-a-300">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
