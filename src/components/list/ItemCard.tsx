"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, CheckCheck, Lock, ImageOff, PackageCheck, EyeOff } from "lucide-react";
import { hostOf, money, PRIORITY, type ItemDTO } from "@/lib/format";
import { PricePopover } from "@/components/list/PricePopover";

export function ItemCard({
  item,
  mode,
  showPrices = true,
  viewerId,
  header,
  divided = false,
}: {
  item: ItemDTO;
  mode: "owner" | "viewer";
  showPrices?: boolean;
  viewerId?: string | null;
  /** Rendered inside this item's own <li>, so a grid never nests list items. */
  header?: React.ReactNode;
  /**
   * Multi-column layout. Cells in a grid row are different heights, so a
   * bottom border lands at a different y for each and reads as a doubled rule.
   * A top border aligns to the row instead.
   */
  divided?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: item.title,
    price: item.price?.toString() ?? "",
    note: item.note ?? "",
    priority: String(item.priority),
  });
  const [isPending, startTransition] = useTransition();
  const [claimBusy, setClaimBusy] = useState(false);
  const [received, setReceived] = useState(Boolean(item.receivedAt));
  const [showPrice, setShowPrice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claims = item.reservations ?? [];
  const mine = viewerId ? claims.find((r) => r.userId === viewerId) : undefined;
  const isClaimed = claims.length > 0;
  const claim = claims[0];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        price: draft.price === "" ? null : Number(draft.price),
        note: draft.note || null,
        priority: Number(draft.priority),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function toggleClaim() {
    setClaimBusy(true);
    setError(null);
    const res = await fetch(`/api/items/${item.id}/reserve`, {
      method: mine ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: mine ? undefined : JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Could not update that.");
    setClaimBusy(false);
    startTransition(() => router.refresh());
  }

  async function toggleHidden() {
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hidden: !item.hidden }),
    });
    router.refresh();
  }

  async function toggleReceived() {
    setError(null);
    const next = !received;
    const res = await fetch(`/api/items/${item.id}/receive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ received: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not update that.");
      return;
    }
    setReceived(next);
    startTransition(() => router.refresh());
  }

  async function remove() {
    if (!confirm("Remove this item from the list?")) return;
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  const priceLabel = showPrices ? money(item.price, item.currency) : null;
  const priority = PRIORITY[(item.priority as 1 | 2 | 3) ?? 2] ?? PRIORITY[2];

  return (
    <li
      className={`group flex flex-col transition-opacity ${
        divided ? "border-t border-hair-soft dark:border-hair-soft-d" : "border-b border-hair-soft dark:border-hair-soft-d"
      } ${item.hidden ? "opacity-45" : received ? "opacity-70" : ""}`}
    >
      {header}

      <div className="flex gap-5 py-6">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="relative size-[6rem] shrink-0 overflow-hidden bg-v-50 dark:bg-v-900"
          aria-hidden
          tabIndex={-1}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="size-full object-cover transition-all duration-700 group-hover:scale-[1.04]"
              loading="lazy"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-v-300 dark:text-v-700">
              <ImageOff className="size-5" strokeWidth={1.5} />
            </span>
          )}
        </a>

        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={save} className="space-y-2">
              <input
                className="input"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                aria-label="Item name"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  className="input w-28"
                  inputMode="decimal"
                  placeholder="Price"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  aria-label="Price"
                />
                <select
                  className="input w-40"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  aria-label="How much you want it"
                >
                  <option value="1">Nice to have</option>
                  <option value="2">Would love</option>
                  <option value="3">Really want</option>
                </select>
              </div>
              <input
                className="input"
                placeholder="Note for the buyer"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                aria-label="Note"
              />
              {error && <p className="text-xs text-a-600 dark:text-a-300">{error}</p>}
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit" disabled={isPending}>Save</button>
                <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-semibold tracking-[-0.02em] text-[1.2rem] leading-snug link-underline"
                  title={item.title}
                >
                  {item.title}
                </a>
                {priceLabel && <span className="tnum shrink-0 text-[0.95rem] text-v-500 dark:text-v-400">{priceLabel}</span>}
              </div>

              <p className="kicker mt-1.5 text-v-400">{hostOf(item.url)}</p>

              {item.note && (
                <p className="mt-3 border-l border-hair pl-3 text-[0.85rem] italic leading-relaxed text-v-500 dark:text-v-400 dark:border-hair-d dark:text-v-400">
                  {item.note}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`chip ${priority.cls}`}>{priority.label}</span>
                {item.hidden && <span className="chip bg-v-0 dark:bg-v-900-2 text-v-500 dark:text-v-400">Hidden</span>}
                {received && (
                  <span className="chip bg-[var(--color-pos-bg)] text-pos dark:bg-[var(--color-pos-bg)]/15">
                    <PackageCheck className="size-3" strokeWidth={2} /> Received
                  </span>
                )}
                {item.price != null && (
                  <PricePopover
                    itemId={item.id}
                    price={item.price}
                    currency={item.currency}
                    open={showPrice}
                    onOpenChange={setShowPrice}
                    canCheck={mode === "owner"}
                    onChecked={(data) => {
                      if (data.changed && data.price != null) {
                        // The server is the source of truth; refresh to pick it up.
                        startTransition(() => router.refresh());
                      }
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {error && !editing && <p className="pb-2 text-xs text-a-600 dark:text-a-300">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 pb-5">
        {mode === "owner" ? (
          <>
            {claim && (
              <span
                className="chip bg-[var(--color-pos-bg)] text-pos dark:bg-[var(--color-pos-bg)]/15"
                title={claim.anonymous ? "This person claimed it anonymously" : undefined}
              >
                {claim.anonymous ? <EyeOff className="size-3" strokeWidth={2} /> : <Gift className="size-3" strokeWidth={2} />}
                {claim.anonymous ? "Claimed anonymously" : `Claimed by ${claim.name ?? "a guest"}`}
              </span>
            )}
            {claims.length > 1 && <span className="chip bg-a-600-wash text-a-600 dark:text-a-300 dark:bg-a-600-wash-d">+{claims.length - 1} more</span>}
            <span className="ml-auto flex flex-wrap gap-1">
              <button className="btn btn-ghost" onClick={toggleReceived} disabled={claimBusy}>
                {received ? "Not received" : "Mark received"}
              </button>
              {!editing && <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit</button>}
              <button className="btn btn-ghost" onClick={toggleHidden}>{item.hidden ? "Show" : "Hide"}</button>
              <button className="btn btn-ghost" onClick={remove}>Delete</button>
            </span>
          </>
        ) : (
          <>
            {isClaimed && !mine && <span className="chip bg-v-0 dark:bg-v-900-2 text-v-500 dark:text-v-400 dark:bg-v-0 dark:bg-v-9002-d"><Lock className="size-3" strokeWidth={2} />
                Already claimed</span>}
            {mine && <span className="chip bg-[var(--color-pos-bg)] text-pos dark:bg-[var(--color-pos-bg)]/15"><CheckCheck className="size-3" strokeWidth={2} />
                Yours</span>}
            <span className="ml-auto">
              {isClaimed && !mine ? (
                <span className="kicker text-v-400">Pick something else</span>
              ) : !viewerId ? (
                <a className="btn btn-secondary" href="/login">Sign in to claim</a>
              ) : (
                <button className={mine ? "btn btn-secondary" : "btn btn-primary"} onClick={toggleClaim} disabled={claimBusy}>
                  {mine ? "Release claim" : "I'll get this one"}
                </button>
              )}
            </span>
          </>
        )}
      </div>
    </li>
  );
}
