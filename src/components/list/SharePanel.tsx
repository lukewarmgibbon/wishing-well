"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";

export type ShareRow = { id: string; role: string; user: { id: string; name: string | null; email: string } };
export type LinkRow = { id: string; token: string; role: string; revoked: boolean; expiresAt: string | null };

export function SharePanel({
  listId,
  slug,
  shares,
  links,
  canEdit,
}: {
  listId: string;
  slug: string;
  shares: ShareRow[];
  links: LinkRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VIEWER" | "EDITOR">("VIEWER");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Start as a relative URL so the server and the first client render agree —
  // reading window.location during render causes a hydration mismatch. The
  // absolute form is swapped in after mount, when it can only help.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const friendlyUrl = `${origin}/w/${slug}`;
  const friendlyUrlText = origin ? friendlyUrl : `/w/${slug}`;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/lists/${listId}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not share.");
      setEmail("");
      setMessage({ kind: "ok", text: `Shared with ${email}.` });
      router.refresh();
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function removeShare(id: string) {
    setBusy(true);
    await fetch(`/api/lists/${listId}/share?shareId=${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function makeLink() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/lists/${listId}/share`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create a link.");
      setMessage({ kind: "ok", text: "New link created." });
      router.refresh();
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleLink(token: string, revoked: boolean) {
    setBusy(true);
    await fetch(`/api/lists/${listId}/share`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle", token, revoked: !revoked }),
    });
    setBusy(false);
    router.refresh();
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setMessage({ kind: "err", text: "Couldn't copy — select the link and copy it manually." });
    }
  }

  const activeLinks = links.filter((l) => !l.revoked);

  return (
    <section className="border-t border-hair pt-8 dark:border-hair-d">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Share this list</h2>
          <p className="text-sm text-v-500 dark:text-v-400">
            One link for everyone, or invite specific people to keep an eye on it.
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={makeLink} disabled={busy}>
            New share link
          </button>
        )}
      </div>

      {!canEdit && (
        <p className="mt-3 rounded-lg bg-v-50 dark:bg-v-900 px-3 py-2 text-sm text-v-500 dark:text-v-400">
          You have view access. Ask the owner if you need to be able to add items.
        </p>
      )}

      {/* The friendly link always points at the slug; the token links are revocable extras. */}
      <div className="mt-4 rounded-xl border border-v-200 dark:border-v-800 bg-v-50 dark:bg-v-900 p-4">
        <p className="label">Main link</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-v-200 dark:border-v-800 bg-white px-3 py-2 font-mono text-xs">
            {friendlyUrlText}
          </code>
          <button className="btn btn-secondary" onClick={() => copyLink(friendlyUrl)}>
            {copied === friendlyUrl ? (
                <>
                  <Check className="size-3.5" strokeWidth={2.5} /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy link
                </>
              )}
          </button>
          <a
            className="btn btn-ghost"
            href={`/w/${slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Preview
          </a>
        </div>
        <p className="mt-2 text-xs text-v-400">
          Anyone with this link can view the list and claim gifts. They do not need an account.
        </p>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            message.kind === "ok" ? "bg-[var(--color-pos-bg)] text-pos dark:bg-[var(--color-pos-bg)]/15" : "bg-a-100 dark:bg-a-900/40 text-a-600 dark:text-a-300"
          }`}
        >
          {message.text}
        </p>
      )}

      {canEdit && (
        <form onSubmit={invite} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label className="label" htmlFor="share-email">Invite by email</label>
            <input
              id="share-email"
              type="email"
              className="input"
              placeholder="sam@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="w-36">
            <label className="label" htmlFor="share-role">Can</label>
            <select id="share-role" className="input" value={role} onChange={(e) => setRole(e.target.value as "VIEWER" | "EDITOR")}>
              <option value="VIEWER">View & claim</option>
              <option value="EDITOR">Also add items</option>
            </select>
          </div>
          <button className="btn btn-secondary" disabled={busy || !email.trim()}>
            Invite
          </button>
        </form>
      )}

      {shares.length > 0 && (
        <div className="mt-5">
          <p className="label">Shared with</p>
          <ul className="divide-y divide-v-200 dark:divide-v-800 rounded-lg border border-v-200 dark:border-v-800">
            {shares.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.user.name ?? s.user.email}</p>
                  <p className="truncate text-xs text-v-400">{s.user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="chip bg-v-50 dark:bg-v-900 text-v-500 dark:text-v-400">
                    {s.role === "EDITOR" ? "Can add" : "View & claim"}
                  </span>
                  {canEdit && (
                    <button className="btn btn-ghost" onClick={() => removeShare(s.id)} disabled={busy}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-5">
          <p className="label">Extra links ({activeLinks.length} active)</p>
          <ul className="divide-y divide-v-200 dark:divide-v-800 rounded-lg border border-v-200 dark:border-v-800">
            {links.map((l) => {
              const url = origin ? `${origin}/w/${slug}?t=${l.token}` : `/w/${slug}?t=${l.token}`;
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <code className={`truncate font-mono text-xs ${l.revoked ? "text-v-400 line-through" : "text-v-500 dark:text-v-400"}`}>
                    {url}
                  </code>
                  <div className="flex shrink-0 items-center gap-1">
                    {l.revoked && <span className="chip bg-v-50 dark:bg-v-900 text-v-400">Disabled</span>}
                    <button className="btn btn-ghost" onClick={() => copyLink(url)} disabled={l.revoked}>
                      {copied === url ? (
                    <>
                      <Check className="size-3.5" strokeWidth={2.5} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> Copy
                    </>
                  )}
                    </button>
                    {canEdit && (
                      <button className="btn btn-ghost" onClick={() => toggleLink(l.token, l.revoked)} disabled={busy}>
                        {l.revoked ? "Enable" : "Disable"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-v-400">
            Disabling a link stops anyone holding it from getting in — handy if a link leaks.
          </p>
        </div>
      )}
    </section>
  );
}
