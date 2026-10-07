"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { LIST_ICONS, ListIcon } from "@/components/ListIcon";
import { Modal } from "@/components/Modal";

export function NewListButton({ label = "New list" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("Gift");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, emoji: icon }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the list.");
      setOpen(false);
      setTitle("");
      setDescription("");
      router.push(`/lists/${data.list.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="size-4" strokeWidth={2.2} />
        {label}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New wishlist" maxWidth="max-w-md">
        <form onSubmit={create} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="list-title">Name</label>
            <input
              id="list-title"
              className="input"
              placeholder="Christmas 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="list-desc">Description</label>
            <input
              id="list-desc"
              className="input"
              placeholder="Anything at all would make me happy"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <span className="label">Icon</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(LIST_ICONS).map(([name]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  aria-pressed={icon === name}
                  aria-label={name}
                  className={`grid size-9 place-items-center rounded-[10px] border transition-colors ${
                    icon === name
                      ? "border-a-500 bg-a-100 text-a-600 dark:bg-a-900/50 dark:text-a-300"
                      : "border-v-200 bg-v-0 text-v-400 hover:bg-v-50 hover:text-v-600 dark:border-v-700 dark:bg-v-900 dark:hover:bg-v-800"
                  }`}
                >
                  <ListIcon name={name} className="size-[18px]" />
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-[10px] bg-[var(--color-neg-bg)] px-3 py-2 text-[0.8125rem] text-neg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
              {busy ? "Creating…" : "Create list"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
