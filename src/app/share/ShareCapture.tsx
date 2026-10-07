"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { titleFromUrl } from "@/lib/format";

type List = { id: string; title: string };
type Preview = {
  url: string;
  title: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
  retailer: string | null;
};

/**
 * The screen someone lands on after sharing a product into the app.
 *
 * Deliberately not a raw form: the whole value here is that the details arrive
 * already filled in. Every field stays editable, because a shop that blocks
 * scraping will return almost nothing and the user must still be able to type
 * a title and hit save.
 */
export function ShareCapture({ sharedUrl, lists }: { sharedUrl: string | null; lists: List[] }) {
  const router = useRouter();

  const [url, setUrl] = useState(sharedUrl ?? "");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState(2);
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [loading, setLoading] = useState(Boolean(sharedUrl));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only auto-fill when the user arrived with a link; never clobber typing.
  const filledFor = useRef<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (!sharedUrl || filledFor.current === sharedUrl || touched.current) return;
    filledFor.current = sharedUrl;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/metadata", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: sharedUrl }),
        });
        const data = await res.json();
        const product: Preview | undefined = data.product;
        if (product) {
          setUrl(product.url);
          setTitle(product.title ?? titleFromUrl(product.url));
          setImage(product.image ?? null);
          setPrice(product.price ? String(product.price) : "");
          setCurrency(product.currency ?? "GBP");
        } else {
          setTitle(titleFromUrl(sharedUrl));
        }
        if (!data.ok && data.error) setNotice(data.error);
      } catch {
        setTitle(titleFromUrl(sharedUrl));
      } finally {
        setLoading(false);
      }
    })();
  }, [sharedUrl]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || titleFromUrl(url),
          url,
          imageUrl: image,
          price: price ? Number(price) : null,
          currency,
          note: note.trim() || null,
          priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add that item.");
      router.push(`/lists/${listId}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!lists.length) {
    return (
      <div className="border border-hair px-8 py-10 dark:border-hair-d">
        <p className="text-sm">You don&apos;t have a list yet.</p>
        <a href="/lists" className="btn btn-primary mt-4">Create one</a>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4 border border-hair px-8 py-10 dark:border-hair-d">
      {image && (
        // Retailer-hosted images may block hotlinking, so this is decorative
        // and must never block the form from working.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-32 w-full rounded-xl object-contain" />
      )}

      {lists.length > 1 && (
        <div>
          <label className="label" htmlFor="share-list">Which list?</label>
          <select
            id="share-list"
            className="input"
            value={listId}
            onChange={(e) => setListId(e.target.value)}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor="share-title">What is it?</label>
        <input
          id="share-title"
          className="input"
          value={title}
          onChange={(e) => { touched.current = true; setTitle(e.target.value); }}
          placeholder={loading ? "Fetching details…" : "Product name"}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="share-url">Link</label>
        <input
          id="share-url"
          className="input"
          value={url}
          onChange={(e) => { touched.current = true; setUrl(e.target.value); }}
          placeholder="https://…"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label" htmlFor="share-price">Price</label>
          <input
            id="share-price"
            className="input"
            inputMode="decimal"
            value={price}
            onChange={(e) => { touched.current = true; setPrice(e.target.value); }}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label" htmlFor="share-currency">Currency</label>
          <select
            id="share-currency"
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["GBP", "EUR", "USD", "AUD", "CAD", "NZD", "SEK", "NOK", "DKK", "CHF", "JPY", "INR"].map(
              (c) => (
                <option key={c} value={c}>{c}</option>
              ),
            )}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="share-note">Note for whoever buys it</label>
        <input
          id="share-note"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Size, colour, which exact one"
        />
      </div>

      {notice && (
        <p className="text-sm text-v-600 dark:text-v-300">
          {notice} Fill in anything that&apos;s blank and save.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-neg dark:text-neg">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button className="btn btn-primary" disabled={busy || loading}>
          {busy ? "Saving…" : "Save to list"}
        </button>
        <a href="/lists" className="btn">Cancel</a>
      </div>
    </form>
  );
}