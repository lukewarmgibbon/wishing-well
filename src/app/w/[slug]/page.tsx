import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { loadListWithAccess, can } from "@/lib/access";
import { ItemCard } from "@/components/list/ItemCard";
import { Lock } from "lucide-react";
import { ListIcon } from "@/components/ListIcon";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { affiliateItemUrl } from "@/lib/affiliate";
import { money, type ItemDTO } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const session = await auth();
  const found = await loadListWithAccess(slug, session?.user?.id ?? null);
  if (!found || !can(found.level, "viewer")) {
    return { title: "A wishlist for you", robots: { index: false } };
  }

  const list = await prisma.wishlist.findUnique({
    where: { id: found.list.id },
    include: {
      owner: { select: { name: true } },
      items: {
        where: { hidden: false },
        orderBy: { position: "asc" },
        select: { title: true, imageUrl: true, price: true, currency: true, reservations: { select: { id: true } } },
      },
    },
  });
  if (!list) return { title: "A wishlist for you" };

  const title = `${list.title}${list.owner.name ? ` · a wishlist for ${list.owner.name}` : ""}`;
  const total = list.items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const currency = list.items.find((i) => i.currency)?.currency ?? "USD";
  const free = list.items.filter((i) => i.reservations.length === 0).length;
  const description = list.description
    ? list.description.slice(0, 200)
    : `${list.items.length} ${list.items.length === 1 ? "thing" : "things"}${list.showPrices && total > 0 ? `, about ${money(total, currency)} in total` : ""}. Claim one and the rest of us can pick something else.`;

  // Use the first product image as the card. Its alt must describe that image,
  // not whatever happens to be first on the list.
  const cover = list.items.find((i) => i.imageUrl);
  const image = cover?.imageUrl ?? null;

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      url: `/w/${slug}`,
      images: image ? [{ url: image, alt: cover?.title ?? list.title }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function SharedListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const found = await loadListWithAccess(slug, viewerId, t ?? null);
  if (!found) notFound();
  if (!can(found.level, "viewer")) return <LockedView title={found.list.title} />;

  const list = await prisma.wishlist.findUniqueOrThrow({
    where: { id: found.list.id },
    include: {
      owner: { select: { name: true } },
      items: {
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        include: { reservations: { include: { user: { select: { id: true, name: true } } } } },
      },
    },
  });

  const isOwner = found.level === "owner";
  const visible = list.items.filter((i) => isOwner || !i.hidden);
  const total = visible.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const currency = visible.find((i) => i.currency)?.currency ?? "USD";
  const available = visible.filter((i) => i.reservations.length === 0);
  const showTotal = list.showPrices && !isOwner && total > 0;
  const bandLo = Math.round((total * 0.7) / 5) * 5;
  const bandHi = Math.round((total * 0.85) / 5) * 5;

  const items: ItemDTO[] = visible.map((i) => ({
    ...i,
    // Server-side, so the href the browser clicks is the href we rendered.
    url: affiliateItemUrl(i.url),
    price: isOwner || list.showPrices ? i.price : null,
    // Guests never learn who claimed what — only that something is taken.
    reservations: i.reservations.map((r) => ({ id: r.id, userId: r.userId })),
  }));

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <header className="text-center">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-v-400">
          {isOwner ? "Preview · how this looks to guests" : "A wishlist from"}
        </p>

        <span
          aria-hidden
          className="mx-auto mt-4 grid size-11 place-items-center rounded-[12px] bg-v-100 text-v-500 dark:bg-v-800 dark:text-v-300"
        >
          <ListIcon name={list.emoji} className="size-6" />
        </span>

        <h1 className="mt-4 text-[2.3rem] font-semibold leading-[1.08] tracking-[-0.025em] text-balance sm:text-[3rem]">
          {list.title}
        </h1>

        {list.description && (
          <p className="mx-auto mt-3 max-w-lg text-[0.98rem] leading-relaxed text-v-500 dark:text-v-400">
            {list.description}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="chip bg-v-50 text-v-500 dark:bg-v-900 dark:text-v-400">
            <span className="tnum">{available.length}</span> of{" "}
            <span className="tnum">{visible.length}</span> still available
          </span>
          {showTotal && (
            <span className="tnum chip bg-v-50 dark:bg-v-900 text-v-500 dark:text-v-400 dark:text-ink-d">
              about {money(total, currency)} in total
            </span>
          )}
          <span className="chip bg-[var(--color-pos-bg)] text-pos dark:bg-[var(--color-pos-bg)]/15">{list.owner.name ?? "Someone"}</span>
        </div>

        <hr className="rule mx-auto mt-9 max-w-xs" />

        {!viewerId && (
          <p className="mx-auto mt-7 max-w-md rounded-xl border border-v-200 dark:border-v-800 bg-v-0 dark:bg-v-900 px-4 py-3 text-[0.875rem] text-v-500 dark:text-v-400 dark:border-v-200 dark:border-v-800-dark dark:bg-v-0 dark:bg-v-900-dark">
            <strong className="font-semibold">Claiming a gift?</strong>{" "}
            <Link href="/login" className="font-semibold text-a-600 dark:text-a-300 hover:underline">
              Sign in
            </Link>{" "}
            so we can remember what you picked. No account? You can still browse.
          </p>
        )}

        {!isOwner && bandLo > 0 && total > 0 && (
          <p className="mx-auto mt-4 max-w-md text-[0.875rem] text-v-400">
            Not sure what to get? Anything in the{" "}
            <span className="tnum font-medium text-v-500 dark:text-v-400">
              {money(bandLo, currency)}–{money(bandHi, currency)}
            </span>{" "}
            range would be lovely.
          </p>
        )}
      </header>

      {visible.length === 0 ? (
        <div className="mt-14 border-y border-hair py-20 text-center text-v-400 dark:border-hair-d">
          Nothing here yet — check back soon.
        </div>
      ) : (
        <ul className="mt-14 grid gap-x-16 gap-y-0 md:grid-cols-2">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              mode={isOwner ? "owner" : "viewer"}
              showPrices={list.showPrices || isOwner}
              viewerId={viewerId}
            />
          ))}
        </ul>
      )}

      {isOwner && (
        <p className="mt-10 text-center text-sm text-v-400">
          <Link href={`/lists/${list.id}`} className="font-semibold text-a-600 dark:text-a-300 hover:underline">
            Back to managing this list
          </Link>
        </p>
      )}

      <AffiliateDisclosure className="mt-8 text-center" />
    </div>
  );
}

function LockedView({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-md px-5 py-28 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-[12px] bg-v-100 text-v-400 dark:bg-v-800 dark:text-v-500">
          <Lock className="size-5" strokeWidth={1.7} />
        </span>
      <h1 className="mt-5 text-[1.75rem] font-semibold tracking-[-0.02em]">
        {title} is private
      </h1>
      <p className="mt-2 text-v-500 dark:text-v-400">
        The owner hasn&apos;t shared this list with you. Ask them for a link, or sign in if you already have one.
      </p>
      <div className="mt-7 flex justify-center gap-2">
        <Link href="/login" className="btn btn-primary">Sign in</Link>
        <Link href="/lists" className="btn btn-secondary">My lists</Link>
      </div>
    </div>
  );
}