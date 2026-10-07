import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ItemCard } from "@/components/list/ItemCard";
import { HeartHandshake, ArrowRight } from "lucide-react";
import { ListIcon } from "@/components/ListIcon";
import { DemoNotice } from "@/components/views/ListsView";
import { Avatar } from "@/components/Avatar";
import { withOccurrenceMeta, relativeDays, formatDate } from "@/lib/dates";
import { money, type ItemDTO } from "@/lib/format";
import { GiftsToolbar } from "@/components/GiftsToolbar";
import { AddOccasionButton } from "@/components/AddOccasionButton";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { affiliateItemUrl } from "@/lib/affiliate";

const SORTS = {
  soonest: { label: "Soonest occasion" },
  price_asc: { label: "Cheapest first" },
  price_desc: { label: "Priciest first" },
  priority: { label: "Most wanted" },
  recent: { label: "Recently added" },
} as const;

type Sort = keyof typeof SORTS;

export async function GiftsView({
  me,
  isDemo = false,
  searchParams = {},
}: {
  me: string;
  isDemo?: boolean;
  searchParams?: { q?: string; person?: string; sort?: string; max?: string; occasion?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const person = searchParams.person ?? "";
  const sort = (searchParams.sort ?? "soonest") as Sort;
  const maxPrice = searchParams.max ? Number(searchParams.max) : null;

  const [follows, sharedWithMe] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: me },
      include: {
        followee: {
          select: {
            id: true, name: true, image: true,
            lists: { where: { visibility: { not: "PRIVATE" } }, select: { id: true, slug: true, title: true, emoji: true, _count: { select: { items: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.share.findMany({
      where: { userId: me },
      include: { list: { select: { id: true, slug: true, title: true, emoji: true, owner: { select: { id: true, name: true, image: true } } } } },
    }),
  ]);

  const peopleIds = Array.from(new Set([...follows.map((f) => f.followeeId), ...sharedWithMe.map((s) => s.list.owner.id)])).filter((id) => id !== me);
  const sharedListIds = Array.from(new Set([...follows.flatMap((f) => f.followee.lists.map((l) => l.id)), ...sharedWithMe.map((s) => s.listId)]));

  // Occasions for the people I follow, decorated with countdown.
  const occasionRows = peopleIds.length
    ? await prisma.occasion.findMany({
        where: { subjectId: { in: peopleIds }, list: { archivedAt: null } },
        include: { subject: { select: { id: true, name: true } }, list: { select: { id: true, title: true, slug: true } } },
      })
    : [];
  const occasions = occasionRows
    .map((o) => withOccurrenceMeta({ ...o, date: new Date(o.date) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const upcoming = occasions.filter((o) => o.daysUntil >= 0 && o.daysUntil <= 60);

  const openItems = sharedListIds.length
    ? await prisma.item.findMany({
        where: {
          listId: { in: sharedListIds },
          hidden: false,
          receivedAt: null,
          list: { archivedAt: null },
          reservations: { none: {} },
        },
        include: {
          reservations: true,
          list: { select: { id: true, slug: true, title: true, emoji: true, owner: { select: { id: true, name: true } } } },
        },
        take: 300,
      })
    : [];

  const items = openItems.map((i) => ({
    ...i,
    list: i.list,
    url: affiliateItemUrl(i.url),
    reservations: i.reservations.map((r) => ({ id: r.id, userId: r.userId })),
  })) as (ItemDTO & { list: { id: string; slug: string; title: string; emoji: string; owner: { id: string; name: string | null } } })[];

  // ---- filtering, in that order: occasion → person → text → price ----
  const occasionIdsFor = (subjectId: string) => occasions.filter((o) => o.subjectId === subjectId).map((o) => o.listId).filter(Boolean) as string[];

  let filtered = items;
  if (searchParams.occasion) {
    filtered = filtered.filter((i) => occasionIdsFor(searchParams.occasion!).includes(i.list.id));
  }
  if (person) {
    filtered = filtered.filter((i) => i.list.owner.id === person);
  }
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (i) => i.title.toLowerCase().includes(needle) || i.list.title.toLowerCase().includes(needle)
    );
  }
  if (maxPrice && maxPrice > 0) {
    filtered = filtered.filter((i) => (i.price ?? 0) <= maxPrice);
  }

  // ---- sorting ----
  const soonestFor = (listOwnerId: string) => {
    const o = occasions.find((x) => x.subjectId === listOwnerId && x.listId);
    return o?.daysUntil ?? Number.MAX_SAFE_INTEGER;
  };
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return (a.price ?? Infinity) - (b.price ?? Infinity);
      case "price_desc":
        return (b.price ?? -Infinity) - (a.price ?? -Infinity);
      case "priority":
        return b.priority - a.priority;
      case "recent":
        return b.id.localeCompare(a.id);
      default:
        return soonestFor(a.list.owner.id) - soonestFor(b.list.owner.id);
    }
  });

  const totalValue = sorted.reduce((s, i) => s + (i.price ?? 0), 0);
  const currency = sorted.find((i) => i.price != null)?.currency ?? "USD";

  if (peopleIds.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-14">
        {isDemo && <DemoNotice />}
        <div className="surface flex flex-col items-center gap-3 px-6 py-20 text-center">
          <span className="grid size-12 place-items-center rounded-[12px] bg-v-100 text-v-400 dark:bg-v-800 dark:text-v-500">
            <HeartHandshake className="size-5" strokeWidth={1.7} />
          </span>
          <h1 className="text-lg font-semibold">No one to shop for yet</h1>
          <p className="max-w-sm text-[0.875rem] text-v-500 dark:text-v-400">
            Follow friends and family and their shared wishlists will gather here, so you can grab a gift in
            thirty seconds instead of guessing.
          </p>
          <Link href={isDemo ? "/demo/people" : "/people"} className="btn btn-primary mt-2">
            Find people to follow
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {isDemo && <DemoNotice />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.875rem] font-semibold tracking-[-0.025em] sm:text-[2.25rem]">Gifting</h1>
          <p className="mt-1 text-[0.9375rem] text-v-500 dark:text-v-400">
            {sorted.length} unclaimed {sorted.length === 1 ? "item" : "items"}
            {totalValue > 0 && <> · about {money(totalValue, currency)} in total</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddOccasionButton />
          <Link href={isDemo ? "/demo/people" : "/people"} className="btn btn-secondary">
            More people
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------ occasions */}
      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[0.75rem] font-semibold uppercase tracking-wider text-v-400">Coming up</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.slice(0, 6).map((o) => (
              <li key={o.id}>
                <Link
                  href={isDemo ? "/demo/gifts" : `/gifts?occasion=${o.id}`}
                  className={`surface flex items-center gap-3 p-3 transition-[box-shadow,border-color] hover:border-v-300 hover:shadow-md dark:hover:border-v-700 ${
                    o.isSoon ? "border-a-200 dark:border-a-700" : ""
                  }`}
                >
                  <Avatar name={o.subject?.name ?? null} image={o.subject ? undefined : null} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.875rem] font-medium">{o.title}</p>
                    <p className="truncate text-[0.75rem] text-v-400">
                      {o.subject?.name} · {formatDate(o.nextOccurrence)}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${o.isSoon ? "bg-a-100 text-a-600 dark:bg-a-900/40 dark:text-a-300" : "bg-v-100 text-v-500 dark:bg-v-800"}`}>
                    {relativeDays(o.daysUntil)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* -------------------------------------------------- filter toolbar */}
      <GiftsToolbar
        people={follows.map((f) => ({ id: f.followeeId, name: f.followee.name ?? "Someone" }))}
        sorts={SORTS}
        current={{ q, person, sort, max: searchParams.max ?? "" }}
      />

      {/* ---------------------------------------------------------- items */}
      {sorted.length === 0 ? (
        <p className="surface mt-6 px-5 py-16 text-center text-[0.875rem] text-v-500 dark:text-v-400">
          {items.length === 0
            ? "Everything on the lists you follow has been claimed. Nicely done."
            : "Nothing matches those filters."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-x-12 md:grid-cols-2">
          {sorted.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              divided
              mode="viewer"
              showPrices
              viewerId={me}
              header={
                <p className="flex items-center gap-1.5 pt-5 text-[0.6875rem] font-medium uppercase tracking-wider text-v-400">
                  <ListIconDot emoji={item.list.emoji} />
                  <span className="truncate">{item.list.title}</span>
                  <span className="text-v-300 dark:text-v-600">·</span>
                  <span className="truncate">{item.list.owner.name}</span>
                </p>
              }
            />
          ))}
        </ul>
      )}

      <AffiliateDisclosure className="mt-8" />

      {/* --------------------------------------------------- people list */}
      <section className="mt-14">
        <h2 className="text-[0.75rem] font-semibold uppercase tracking-wider text-v-400">People you follow</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {follows.map((f) => (
            <li key={f.id} className="surface p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={f.followee.name} image={f.followee.image} />
                <div className="min-w-0">
                  <p className="truncate text-[0.875rem] font-medium">{f.followee.name ?? "Someone"}</p>
                  <p className="text-[0.75rem] text-v-400">
                    {f.followee.lists.length} shared {f.followee.lists.length === 1 ? "list" : "lists"}
                  </p>
                </div>
              </div>
              {f.followee.lists.length > 0 ? (
                <ul className="mt-3 space-y-0.5">
                  {f.followee.lists.map((l) => (
                    <li key={l.id}>
                      <Link href={`/w/${l.slug}`} className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-[0.8125rem] hover:bg-v-100 dark:hover:bg-v-800">
                        <span className="truncate">
                          <ListIconDot emoji={l.emoji} /> {l.title}
                        </span>
                        <span className="tnum shrink-0 text-[0.75rem] text-v-400">{l._count.items}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[0.75rem] text-v-400">No public lists yet — they can share one any time.</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ListIconDot({ emoji }: { emoji: string }) {
  return (
    <span className="inline-flex size-4 items-center justify-center text-v-300 dark:text-v-700" aria-hidden>
      <ListIcon name={emoji} className="size-3.5" />
    </span>
  );
}
