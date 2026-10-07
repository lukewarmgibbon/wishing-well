"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cake } from "lucide-react";
import { Modal } from "@/components/Modal";

/** Records a birthday or other date for someone you follow. */
export function AddOccasionButton({ people = [] }: { people?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "Birthday",
    date: "",
    kind: "birthday",
    repeats: "yearly",
    subjectId: people[0]?.id ?? "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/occasions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, date: new Date(form.date).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save that.");
      setOpen(false);
      setForm((f) => ({ ...f, date: "" }));
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
        <Cake className="size-4" /> Occasion
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add an occasion"
        description="This is what turns the gifting page into “what's coming up?”."
      >
        <form onSubmit={submit} className="mt-5 space-y-4">
          {people.length > 0 && (
            <div>
              <label className="label" htmlFor="occ-person">Who is it for?</label>
              <select
                id="occ-person"
                className="input"
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="occ-title">Name</label>
            <input
              id="occ-title"
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="occ-date">Date</label>
              <input
                id="occ-date"
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="occ-kind">Kind</label>
              <select
                id="occ-kind"
                className="input"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="wedding">Wedding</option>
                <option value="holiday">Holiday</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-[0.8125rem]">
            <input
              type="checkbox"
              checked={form.repeats === "yearly"}
              onChange={(e) => setForm({ ...form, repeats: e.target.checked ? "yearly" : "none" })}
            />
            Repeats every year
          </label>

          {error && (
            <p role="alert" className="rounded-[10px] bg-[var(--color-neg-bg)] px-3 py-2 text-[0.8125rem] text-neg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !form.date}>
              {busy ? "Saving…" : "Add occasion"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
