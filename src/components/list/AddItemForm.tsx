"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hostOf, money, titleFromUrl } from "@/lib/format";

/**
 * Currencies people are likely to price a gift in. Deliberately a short list:
 * a free-text field here would store anything, and a typo like "GBP" vs "GB"
 * is a silent data problem. Anything missing can be added when the family
 * tells us it is missing.
 */
const CURRENCIES = ["GBP", "EUR", "USD", "CAD", "AUD", "NZD", "INR", "JPY", "CHF", "SEK", "NOK", "DKK", "PLN", "ZAR"];

/** Manual "add an item" — the browser extension uses the same endpoint. */
export function AddItemForm({ listId, onAdded }: { listId: string; onAdded?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const finalUrl = url.trim();
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
      setUrl(`https://${finalUrl}`);
    }
    const normalised = /^https?:\/\//i.test(finalUrl) ? finalUrl : `https://${finalUrl}`;

    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || titleFromUrl(normalised),
          url: normalised,
          price: price ? Number(price) : null,
          currency,
          note: note.trim() || null,
          priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add that item.");

      setTitle("");
      setUrl("");
      setPrice("");
      setCurrency("GBP");
      setNote("");
      setPriority(2);
      setOpen(false);
      onAdded?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <span aria-hidden>+</span> Add an item
      </button>
    );
  }

  return (
    <div className="border border-hair p-5 dark:border-hair-d">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="label" htmlFor="add-title">What is it?</label>
            <input
              id="add-title"
              className="input"
              placeholder={url ? titleFromUrl(url) : "Le Creuset casserole"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="add-url">Link</label>
            <input
              id="add-url"
              className="input"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="w-28">
            <label className="label" htmlFor="add-currency">Currency</label>
            <select
              id="add-currency"
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {/* The family this is built for is spread across countries, and a
                  price stored in the wrong currency is worse than no price —
                  "$40" for something that costs £40 reads as a real number. */}
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="label" htmlFor="add-price">Price</label>
            <input
              id="add-price"
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label" htmlFor="add-note">Note for whoever buys it <span className="font-normal">(size, colour, link to the exact one)</span></label>
            <input
              id="add-note"
              className="input"
              placeholder="Size small, the sage green one"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="add-priority">How much do you want it?</label>
            <select
              id="add-priority"
              className="input"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            >
              <option value={1}>Nice to have</option>
              <option value={2}>Would love</option>
              <option value={3}>Really want</option>
            </select>
          </div>
        </div>

        {url && (
          <p className="text-xs text-v-400">
            Adding from <span className="font-medium text-v-500 dark:text-v-400">{hostOf(url)}</span>
            {title ? ` as “${title}”` : titleFromUrl(url)}
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-a-100 dark:bg-a-900/40 px-3 py-2 text-sm text-a-600 dark:text-a-300">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !url.trim()}>
            {busy ? "Adding…" : "Add to list"}
          </button>
        </div>
      </form>
    </div>
  );
}
