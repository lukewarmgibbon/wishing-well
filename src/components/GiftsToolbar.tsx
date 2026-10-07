"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X, ArrowUpDown } from "lucide-react";

/**
 * Search, sort and filter for the gifting page.
 *
 * State lives in the URL so a filtered view is shareable and survives a
 * refresh — which matters when you're forwarding "these three things" to
 * someone else.
 */
export function GiftsToolbar({
  people,
  sorts,
  current,
}: {
  people: { id: string; name: string }[];
  sorts: Record<string, { label: string }>;
  current: { q: string; person: string; sort: string; max: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(current.q);

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const active = Boolean(current.q || current.person || current.max);

  return (
    <div className="mt-8 flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-v-400" />
        <label htmlFor="gifts-search" className="sr-only">Search items</label>
        <input
          id="gifts-search"
          className="input pl-8"
          placeholder="Search items and lists…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ q: text });
            if (e.key === "Escape") { setText(""); apply({ q: "" }); }
          }}
          onBlur={() => text !== current.q && apply({ q: text })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="gifts-person" className="sr-only">Filter by person</label>
        <select
          id="gifts-person"
          className="input w-full sm:w-44"
          value={current.person}
          onChange={(e) => apply({ person: e.target.value })}
        >
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <label htmlFor="gifts-max" className="sr-only">Maximum price</label>
        <select
          id="gifts-max"
          className="input w-full sm:w-44"
          value={current.max}
          onChange={(e) => apply({ max: e.target.value })}
        >
          <option value="">Any price</option>
          <option value="25">Under 25</option>
          <option value="50">Under 50</option>
          <option value="100">Under 100</option>
          <option value="250">Under 250</option>
        </select>

        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <ArrowUpDown className="hidden size-4 shrink-0 text-v-400 sm:block" />
          <label htmlFor="gifts-sort" className="sr-only">Sort by</label>
          <select
            id="gifts-sort"
            className="input w-full sm:w-48"
            value={current.sort}
            onChange={(e) => apply({ sort: e.target.value })}
          >
            {Object.entries(sorts).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {active && (
          <button className="btn btn-ghost" onClick={() => { setText(""); apply({ q: "", person: "", max: "", occasion: "" }); }}>
            <X className="size-4" /> Clear
          </button>
        )}

        {pending && <span className="text-[0.75rem] text-v-400">Updating…</span>}
      </div>
    </div>
  );
}
