"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";

export type Person = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  listCount: number;
  followerCount: number;
  following: boolean;
};

export function PeopleDirectory({ people }: { people: Person[] }) {
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState<Record<string, boolean>>(
    Object.fromEntries(people.map((p) => [p.id, p.following]))
  );
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => (p.name ?? "").toLowerCase().includes(q) || p.email.includes(q));
  }, [people, query]);

  async function toggle(person: Person) {
    setBusyId(person.id);
    const next = !following[person.id];
    setFollowing((f) => ({ ...f, [person.id]: next }));

    const res = await fetch(`/api/users/${person.id}/follow`, { method: next ? "POST" : "DELETE" });
    if (!res.ok) {
      setFollowing((f) => ({ ...f, [person.id]: !next })); // roll back
    }
    setBusyId(null);
    startTransition(() => {});
  }

  return (
    <div className="mt-6">
      <div className="relative">
        <label className="sr-only" htmlFor="people-search">
          Search people
        </label>
        <input
          id="people-search"
          className="input pl-9"
          placeholder="Search by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-v-400">
          ⌕
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 border-y border-hair py-16 text-center text-v-500 dark:text-v-400 dark:border-hair-d">
          Nobody matches “{query}”. People appear here once they sign up.
        </p>
      ) : (
        <ul className="mt-8 border-t border-v-200 dark:border-v-800">
          {filtered.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar name={p.name} image={p.image} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name ?? "Someone"}</p>
                <p className="truncate text-sm text-v-400">
                  {p.listCount} {p.listCount === 1 ? "list" : "lists"}
                  {p.followerCount > 0 && ` · ${p.followerCount} following them`}
                </p>
              </div>
              <button
                className={following[p.id] ? "btn btn-secondary" : "btn btn-primary"}
                onClick={() => toggle(p)}
                disabled={busyId === p.id || pending}
                aria-pressed={following[p.id]}
              >
                {busyId === p.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : following[p.id] ? (
                  <>
                    <Check className="size-3.5" strokeWidth={2.5} /> Following
                  </>
                ) : (
                  "Follow"
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
