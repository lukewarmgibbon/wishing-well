"use client";

import { useState, useTransition } from "react";
import { LIST_ICONS, ListIcon } from "@/components/ListIcon";
import { Modal } from "@/components/Modal";

import { useRouter } from "next/navigation";
import { VISIBILITY, type Visibility } from "@/lib/format";


const UNUSED_ICONS = [["Gift","PartyPopper","House","Heart","BookOpen","Headphones","Baby","Sparkles","Cake","Wrench","Footprints","ChefHat"]] as const;

export function ListSettings({
  list,
  archived = false,
}: {
  list: { id: string; title: string; description: string | null; emoji: string; visibility: string; showPrices: boolean; slug: string };
  archived?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: list.title,
    description: list.description ?? "",
    emoji: list.emoji,
    visibility: list.visibility as Visibility,
    showPrices: list.showPrices,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollMode, setRollMode] = useState<"fresh" | "carry">("fresh");
  const [, startTransition] = useTransition();

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not save.");
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await patch({
        title: draft.title,
        description: draft.description || null,
        emoji: draft.emoji,
        visibility: draft.visibility,
        showPrices: draft.showPrices,
      });
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete this list.");
      router.push("/lists");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function setArchived(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${list.id}/archive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update this list.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rollover() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${list.id}/rollover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: rollMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the new list.");
      setRolling(false);
      setOpen(false);
      router.push(`/lists/${data.list.id}`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        Settings
      </button>

      {open && (
        <Modal open={open} onClose={() => setOpen(false)} title="List settings" maxWidth="max-w-lg">
          <form onSubmit={save} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="set-title">Name</label>
                <input
                  id="set-title"
                  className="input"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>

              <div>
                <label className="label" htmlFor="set-desc">Description</label>
                <textarea
                  id="set-desc"
                  className="input min-h-20"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>

              <div>
                <span className="label">Icon</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(LIST_ICONS).map(([name]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setDraft({ ...draft, emoji: name })}
                      aria-pressed={draft.emoji === name}
                      aria-label={name}
                      className={`grid size-9 place-items-center rounded-[10px] border transition-colors ${
                        draft.emoji === name
                          ? "border-a-500 bg-a-100 text-a-600 dark:bg-a-900/50 dark:text-a-300"
                          : "border-v-200 bg-v-0 text-v-400 hover:bg-v-50 hover:text-v-600 dark:border-v-700 dark:bg-v-900 dark:hover:bg-v-800"
                      }`}
                    >
                      <ListIcon name={name} className="size-[18px]" />
                    </button>
                  ))}
                </div>
              </div>

              <fieldset>
                <legend className="label">Who can see this</legend>
                <div className="space-y-1.5">
                  {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
                    <label
                      key={v}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 ${
                        draft.visibility === v ? "border-a-500 bg-a-100 dark:bg-a-900/40" : "border-v-200 dark:border-v-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        className="mt-1"
                        checked={draft.visibility === v}
                        onChange={() => setDraft({ ...draft, visibility: v })}
                      />
                      <span>
                        <span className="block text-sm font-medium">{VISIBILITY[v].label}</span>
                        <span className="block text-xs text-v-500 dark:text-v-400">{VISIBILITY[v].hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-2.5 rounded-[10px] border border-v-200 p-3 dark:border-v-800">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.showPrices}
                  onChange={(e) => setDraft({ ...draft, showPrices: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium">Show prices to guests</span>
                  <span className="block text-xs text-v-500 dark:text-v-400">
                    Turn off for surprise lists so nobody can guess the budget.
                  </span>
                </span>
              </label>

              {error && (
                <p role="alert" className="rounded-[10px] bg-[var(--color-neg-bg)] px-3 py-2 text-[0.8125rem] text-neg">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-6 border-t border-v-200 pt-5 dark:border-v-800">
              <div>
                <h3 className="text-sm font-semibold">Start this list again</h3>
                <p className="mt-1 text-xs text-v-500 dark:text-v-400">
                  Creates next year&rsquo;s copy and leaves this one exactly as it is, so last
                  year&rsquo;s claims and price history stay readable.
                </p>
                {rolling ? (
                  <div className="mt-3 space-y-2.5">
                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 ${
                        rollMode === "fresh" ? "border-a-500 bg-a-100 dark:bg-a-900/40" : "border-v-200 dark:border-v-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rollmode"
                        className="mt-1"
                        checked={rollMode === "fresh"}
                        onChange={() => setRollMode("fresh")}
                      />
                      <span>
                        <span className="block text-sm font-medium">Start empty</span>
                        <span className="block text-xs text-v-500 dark:text-v-400">
                          A clean slate for the new season.
                        </span>
                      </span>
                    </label>
                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 ${
                        rollMode === "carry" ? "border-a-500 bg-a-100 dark:bg-a-900/40" : "border-v-200 dark:border-v-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rollmode"
                        className="mt-1"
                        checked={rollMode === "carry"}
                        onChange={() => setRollMode("carry")}
                      />
                      <span>
                        <span className="block text-sm font-medium">Copy items across</span>
                        <span className="block text-xs text-v-500 dark:text-v-400">
                          Same products, unclaimed, with their price history.
                        </span>
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={rollover} disabled={busy}>
                        {busy ? "Creating…" : "Create the new list"}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setRolling(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-secondary mt-3" onClick={() => setRolling(true)}>
                    {archived ? "Roll over to a new list" : "Create next year's list"}
                  </button>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold">
                  {archived ? "This list is archived" : "Archive this list"}
                </h3>
                <p className="mt-1 text-xs text-v-500 dark:text-v-400">
                  {archived
                    ? "It's hidden from your dashboard but every share link and claim still works."
                    : "Hides it from your dashboard without deleting anything. Good for finished years."}
                </p>
                <button className="btn btn-secondary mt-3" onClick={() => setArchived(!archived)} disabled={busy}>
                  {archived ? "Restore to dashboard" : "Archive list"}
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-a-600 dark:text-a-300">Delete this list</h3>
                <p className="mt-1 text-xs text-v-500 dark:text-v-400">
                  This removes the list and every item on it. Share links stop working immediately.
                </p>
                {confirmDelete ? (
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-primary bg-a-600 hover:bg-a-600-2" onClick={remove} disabled={busy}>
                      Yes, delete it
                    </button>
                    <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-secondary mt-3" onClick={() => setConfirmDelete(true)}>
                    Delete list
                  </button>
                )}
              </div>
            </div>
        </Modal>
      )}
    </>
  );
}
