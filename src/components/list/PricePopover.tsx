"use client";

import { useEffect, useRef, useState } from "react";
import { History, RefreshCw, TrendingDown, X } from "lucide-react";
import { money } from "@/lib/format";

type Summary = {
  current: number | null;
  previous: number | null;
  lowest: number | null;
  highest: number | null;
  dropPercent: number | null;
  currency: string;
  history: { price: number; createdAt: string }[];
};

/**
 * Price history, on demand.
 *
 * Deliberately not a sparkline drawn from guesswork — it fetches real rows
 * from the API when opened, so a list with no history says so rather than
 * inventing a trend.
 */
export function PricePopover({
  itemId,
  price,
  currency,
  open,
  onOpenChange,
  canCheck = false,
  onChecked,
}: {
  itemId: string;
  price: number;
  currency: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canCheck?: boolean;
  onChecked?: (data: { changed: boolean; price?: number | null; note?: string }) => void;
}) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    fetch(`/api/items/${itemId}/price`)
      .then((r) => r.json())
      .then((d) => setData(d.price))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, data, itemId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    function onClick(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onOpenChange]);

  async function recheck() {
    setChecking(true);
    setNote(null);
    try {
      const res = await fetch(`/api/items/${itemId}/price`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setNote(d.error ?? "Could not check that price.");
      else if (d.note) setNote(d.note);
      else setNote(d.changed ? `Now ${money(d.price, currency) ?? ""}` : "No change.");
      setData(null);
      onChecked?.(d);
    } catch {
      setNote("Could not reach the retailer.");
    } finally {
      setChecking(false);
    }
  }

  const low = data?.lowest != null && data.current != null && data.lowest < data.current;

  return (
    <span className="relative" ref={wrap}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="chip gap-1 bg-v-0 text-v-500 transition-colors hover:bg-v-50 hover:text-v-700 dark:bg-v-900-2 dark:text-v-400 dark:hover:bg-v-800 dark:hover:text-v-200"
      >
        <History className="size-3" strokeWidth={2} />
        Price history
      </button>

      {open && (
        <div className="surface absolute bottom-full left-0 z-40 mb-2 w-72 p-4 text-left shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              {/* "Tracked price" is only honest once something is recorded.
                  With zero rows the figure is just the item's own price, so
                  call it that instead of implying a history exists. */}
              <p className="kicker text-v-400">
                {data && data.history.length === 0 ? "Current price" : "Tracked price"}
              </p>
              <p className="tnum text-lg font-semibold tracking-[-0.02em]">
                {money(data?.current ?? price, currency)}
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close price history"
              className="-mr-1 -mt-1 grid size-7 place-items-center rounded-[7px] text-v-400 hover:bg-v-100 dark:hover:bg-v-800"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {loading && <p className="mt-2 text-[0.8125rem] text-v-400">Loading…</p>}

          {!loading && data && (
            <>
              {data.dropPercent != null && (
                <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-medium text-pos">
                  <TrendingDown className="size-3.5" strokeWidth={2.2} />
                  {data.dropPercent.toFixed(0)}% below the first price we saw
                </p>
              )}
              {low && (
                <p className="mt-1 text-[0.8125rem] text-v-500 dark:text-v-400">
                  Lowest so far: {money(data.lowest, currency)}
                </p>
              )}

              {data.history.length > 1 ? (
                <ol className="mt-3 space-y-1.5 border-t border-v-200 pt-3 dark:border-v-800">
                  {data.history.slice(0, 5).map((p, idx) => (
                    <li key={idx} className="tnum flex justify-between text-[0.8125rem]">
                      <span className="text-v-500 dark:text-v-400">
                        {new Date(p.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="font-medium">{money(p.price, currency)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 border-t border-v-200 pt-3 text-[0.8125rem] text-v-400 dark:border-v-800">
                  {data.history.length === 1
                    ? "One price recorded so far. It builds up over time."
                    : "Nothing recorded yet. The price is saved the first time this item is added or its price changes."}
                </p>
              )}
            </>
          )}

          {note && <p className="mt-3 text-[0.8125rem] text-v-500 dark:text-v-400">{note}</p>}

          {canCheck && (
            <button onClick={recheck} disabled={checking} className="btn btn-secondary mt-3 w-full justify-center">
              <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking…" : "Check now"}
            </button>
          )}
        </div>
      )}
    </span>
  );
}
