import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { affiliateItemUrl } from "@/lib/affiliate";
import { loadListWithAccess } from "@/lib/access";
import { AddItemForm } from "@/components/list/AddItemForm";
import { ItemCard } from "@/components/list/ItemCard";
import { SharePanel } from "@/components/list/SharePanel";
import { ListSettings } from "@/components/list/ListSettings";
import { money, type ItemDTO } from "@/lib/format";
import { ShoppingBag, ArchiveRestore } from "lucide-react";
import { ListIcon } from "@/components/ListIcon";
import { DemoNotice } from "@/components/views/ListsView";

export async function ListDetailView({
  id,
  viewerId,
  isDemo = false,
}: {
  id: string;
  viewerId: string | null;
  isDemo?: boolean;
}) {
  const found = await loadListWithAccess(id, viewerId);
  if (!found) notFound();

  const list = await prisma.wishlist.findUniqueOrThrow({
    where: { id: found.list.id },
    include: {
      shares: { include: { user: { select: { id: true, name: true, email: true } } } },
      links: true,
      items: {
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        include: {
          reservations: {
            include: { user: { select: { id: true, name: true, image: true } } },
          },
        },
      },
    },
  });

  const isOwner = found.level === "owner";
  const visible = list.items.filter((i) => isOwner || !i.hidden);
  const total = visible.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const currency = visible.find((i) => i.currency)?.currency ?? "USD";
  const claimed = list.items.filter((i) => i.reservations.length > 0);
  const receivedCount = list.items.filter((i) => i.receivedAt).length;

  const items: ItemDTO[] = list.items.map((i) => ({
    ...i,
    url: affiliateItemUrl(i.url),
    // An anonymous claim is stored with the user, but the owner must not be
    // able to see who made it — otherwise the flag is decorative.
    reservations: i.reservations.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.anonymous ? null : r.user.name,
      image: r.anonymous ? null : r.user.image,
      note: r.anonymous ? null : r.note,
      anonymous: r.anonymous,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {isDemo && <DemoNotice />}
      <Link href={isDemo ? "/demo/lists" : "/lists"} className="text-sm text-v-400 hover:text-v-700 dark:hover:text-v-200">
        ← All my lists
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-v-100 text-v-500 dark:bg-v-800 dark:text-v-300"
            >
              <ListIcon name={list.emoji} className="size-5" />
            </span>
            {list.title}
          </h1>
          {list.description && <p className="mt-1 max-w-2xl text-v-500 dark:text-v-400">{list.description}</p>}
          <p className="mt-2 text-sm text-v-400">
            {visible.length} {visible.length === 1 ? "item" : "items"}
            {total > 0 && <> · about {money(total, currency)} in total</>}
            {claimed.length > 0 && <> · {claimed.length} already claimed</>}
          </p>
        </div>
        <div className="flex gap-2">
          <a className="btn btn-secondary" href={`/w/${list.slug}`} target="_blank" rel="noreferrer">
            View as guest
          </a>
          {isOwner && <ListSettings list={list} archived={Boolean(list.archivedAt)} />}
        </div>
      </header>

      {list.archivedAt && (
        <p className="mt-4 rounded-xl border border-v-200 bg-v-0 px-4 py-3 text-sm text-v-500 dark:border-v-800 dark:bg-v-900-2 dark:text-v-400">
          <ArchiveRestore className="mr-1.5 inline size-4 -translate-y-0.5" />
          This list is archived. Share links and claims still work — it&apos;s just off your dashboard.
        </p>
      )}

      {!isOwner && (
        <p className="mt-4 rounded-xl border border-a-500 bg-a-100 dark:bg-a-900/40 px-4 py-3 text-sm text-a-600 dark:text-a-300">
          You&apos;re viewing a list shared with you.{" "}
          {found.level === "editor" ? "You can add and edit items." : "You can view it and claim gifts."}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {(found.level === "owner" || found.level === "editor") && <AddItemForm listId={list.id} />}

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border-y border-hair py-20 text-center dark:border-hair-d">
            <span className="mx-auto grid size-12 place-items-center rounded-[12px] bg-v-100 text-v-400 dark:bg-v-800 dark:text-v-500">
              <ShoppingBag className="size-5" strokeWidth={1.7} />
            </span>
            <p className="font-medium">This list is empty</p>
            <p className="max-w-sm text-sm text-v-500 dark:text-v-400">
              Add something by hand, or install the browser extension and save products as you browse.
            </p>
          </div>
        ) : (
          <ul className="grid gap-x-16 md:grid-cols-2">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                divided
                mode={isOwner ? "owner" : "viewer"}
                showPrices={list.showPrices || isOwner}
                viewerId={viewerId}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <SharePanel
          listId={list.id}
          slug={list.slug}
          shares={list.shares}
          links={list.links.map((l) => ({ ...l, expiresAt: l.expiresAt?.toISOString() ?? null }))}
          canEdit={isOwner}
        />
      </div>
    </div>
  );
}
