"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, EyeOff, KeyRound, Mail, ShieldCheck, Check, Loader2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";

export function ProfileSettings({
  name,
  email,
  image,
  emailVerified,
  anonClaims,
  listCount,
  claims,
  following,
}: {
  name: string | null;
  email: string;
  image: string | null;
  emailVerified: boolean;
  anonClaims: boolean;
  listCount: number;
  claims: number;
  following: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState(name ?? "");
  const [anon, setAnon] = useState(anonClaims);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNote, setPwNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: displayName, anonClaims: anon }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save.");
      setSaved("Saved.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwNote(null);
    try {
      if (pw.next !== pw.confirm) throw new Error("The two new passwords don't match.");
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: pw.current || undefined, newPassword: pw.next }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not change your password.");
      setPw({ current: "", next: "", confirm: "" });
      setPwNote({ kind: "ok", text: "Password changed." });
    } catch (err) {
      setPwNote({ kind: "err", text: (err as Error).message });
    } finally {
      setPwBusy(false);
    }
  }

  async function resendVerification() {
    setVerifying(true);
    setVerifyNote(null);
    try {
      const res = await fetch("/api/verify-email", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      setVerifyNote(d.message ?? d.error ?? "Check your inbox.");
      if (res.ok) startTransition(() => router.refresh());
    } catch {
      setVerifyNote("Could not send that right now.");
    } finally {
      setVerifying(false);
    }
  }

  async function emailReset() {
    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await res.json().catch(() => ({}));
    setPwNote({ kind: "ok", text: d.message ?? "If that address has an account, a reset link is on its way." });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center gap-4 border-b border-v-200 pb-6 dark:border-v-800">
        <Avatar name={name} image={image} size="lg" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">{name ?? "Your account"}</h1>
          <p className="truncate text-[0.875rem] text-v-500 dark:text-v-400">{email}</p>
        </div>
      </header>

      <dl className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: "Lists", value: listCount },
          { label: "Gifts claimed", value: claims },
          { label: "People followed", value: following },
        ].map((s) => (
          <div key={s.label} className="surface px-4 py-3">
            <dt className="kicker text-v-400">{s.label}</dt>
            <dd className="tnum mt-1 text-xl font-semibold tracking-[-0.02em]">{s.value}</dd>
          </div>
        ))}
      </dl>

      <form onSubmit={save} className="surface mt-6 space-y-5 p-6">
        <div>
          <h2 className="text-sm font-semibold">Profile</h2>
          <p className="mt-1 text-[0.8125rem] text-v-500 dark:text-v-400">
            This is what people you follow see.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="pf-name">Display name</label>
          <input
            id="pf-name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alex Morgan"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-v-200 p-4 dark:border-v-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={anon}
            onChange={(e) => setAnon(e.target.checked)}
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <EyeOff className="size-4" /> Claim gifts anonymously by default
            </span>
            <span className="mt-1 block text-[0.8125rem] text-v-500 dark:text-v-400">
              The list owner still sees that a gift is taken, but not who took it. Useful when the
              same group buys for the same person.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-[10px] bg-[var(--color-neg-bg)] px-3 py-2 text-[0.8125rem] text-neg">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-pos">
              <Check className="size-3.5" /> {saved}
            </span>
          )}
        </div>
      </form>

      <section className="surface mt-6 p-6">
        <h2 className="text-sm font-semibold">Email</h2>
        <p className="mt-1 text-[0.8125rem] text-v-500 dark:text-v-400">
          {emailVerified
            ? "Your address is confirmed. Password resets and alerts will reach you."
            : "Confirm your address so password resets reach you. Unverified accounts keep working — the badge is just reassurance."}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`chip ${
              emailVerified
                ? "bg-[var(--color-pos-bg)] text-pos"
                : "bg-[var(--color-warn-bg)] text-warn"
            }`}
          >
            {emailVerified ? <BadgeCheck className="size-3" /> : <Mail className="size-3" />}
            {emailVerified ? "Verified" : "Unverified"}
          </span>

          {!emailVerified && (
            <button className="btn btn-secondary" onClick={resendVerification} disabled={verifying}>
              {verifying ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {verifying ? "Sending…" : "Send confirmation link"}
            </button>
          )}
        </div>

        {verifyNote && <p className="mt-3 text-[0.8125rem] text-v-500 dark:text-v-400">{verifyNote}</p>}
      </section>

      <section className="surface mt-6 p-6">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <KeyRound className="size-4" /> Password
        </h2>
        <p className="mt-1 text-[0.8125rem] text-v-500 dark:text-v-400">
          Eight characters minimum. Changing it signs out nothing — your current session stays.
        </p>

        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="pw-current">Current password</label>
            <input
              id="pw-current"
              type="password"
              className="input"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pw-next">New password</label>
              <input
                id="pw-next"
                type="password"
                className="input"
                autoComplete="new-password"
                minLength={8}
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="pw-confirm">Confirm new password</label>
              <input
                id="pw-confirm"
                type="password"
                className="input"
                autoComplete="new-password"
                minLength={8}
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </div>
          </div>

          {pwNote && (
            <p
              role="status"
              className={`rounded-[10px] px-3 py-2 text-[0.8125rem] ${
                pwNote.kind === "ok"
                  ? "bg-[var(--color-pos-bg)] text-pos"
                  : "bg-[var(--color-neg-bg)] text-neg"
              }`}
            >
              {pwNote.text}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={pwBusy || pw.next.length < 8}>
              {pwBusy ? "Updating…" : "Change password"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={emailReset}>
              Email me a reset link instead
            </button>
          </div>
        </form>
      </section>

      <section className="surface mt-6 flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="mt-1 text-[0.8125rem] text-v-500 dark:text-v-400">
            Follows your system by default.
          </p>
        </div>
        <ThemeToggle />
      </section>

      <p className="mt-6 flex items-start gap-2 text-[0.8125rem] text-v-400">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Your extension token is a bearer credential. Rotate it from the Lists page if a shared
        computer ever had access to it.
      </p>
    </div>
  );
}
