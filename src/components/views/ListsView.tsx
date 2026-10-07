import { prisma } from "@/lib/prisma";
import { NewListButton } from "@/components/NewListButton";
import { ExtensionSetupCard } from "@/components/ExtensionSetupCard";
import { SetupChecklist } from "@/components/views/SetupChecklist";
import { ListIcon } from "@/components/ListIcon";
import { ArchiveRestore } from "lucide-react";

const VISIBILITY: Record<string, string> = {
  PRIVATE: "Private",
  SHARED: "Shared link",
  PUBLIC: "Public",
};

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

/**
 * The dashboard body, split out from the page so it can render either for the
 * signed-in user or for a demo identity with no session at all.
 */
export async function ListsView({
  userId,
  apiToken,
  isDemo = false,
}: {
  userId: string;
  apiToken?: string;
  isDemo?: boolean;
}) {
  const allLists = await prisma.wishlist.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
    include: {
      items: { orderBy: { position: "asc" }, select: { price: true, currency: true, imageUrl: true } },
      _count: { select: { items: true, shares: true } },
    },
  });

  const reservedCount = await prisma.reservation.count({
    where: { item: { list: { ownerId: userId } } },
  });

  const lists = allLists.filter((l) => !l.archivedAt);
  const archived = allLists.filter((l) => l.archivedAt);

  return (
    <div className="mx-auto max-w-[84rem] px-6 py-14">
      {isDemo && <DemoNotice />}

      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-hair pb-6 dark:border-hair-d">
        <div>
          <p className="kicker text-a-600 dark:text-a-300">The archive</p>
          <h1 className="mt-3 text-[2.6rem] leading-[0.95] sm:text-[3.4rem]">My lists</h1>
        </div>
        <div className="flex items-center gap-6">
          <dl className="flex gap-8 text-right">
            <div>
              <dt className="kicker text-v-400">Lists</dt>
              <dd className="tnum font-semibold tracking-[-0.02em] text-[1.8rem] leading-none">{lists.length}</dd>
            </div>
            <div>
              <dt className="kicker text-v-400">Claimed</dt>
              <dd className="tnum font-semibold tracking-[-0.02em] text-[1.8rem] leading-none">{reservedCount}</dd>
            </div>
          </dl>
          {isDemo ? null : <NewListButton />}
        </div>
      </div>

      <SetupChecklist userId={userId} />

      {lists.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-semibold tracking-[-0.02em] text-[1.75rem]">Nothing here yet</p>
          <p className="mx-auto mt-3 max-w-sm text-[0.9rem] text-v-500 dark:text-v-400">
            Make a list for an occasion, a room you&apos;re redecorating, or just things you like.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <NewListButton />
          </div>
          <p className="mt-6 text-[0.85rem] text-v-400">
            Adding things by hand works fine. The browser extension picks items
            straight off a product page, and the setup card below shows you how.
          </p>
        </div>
      ) : (
        <ul>
          {lists.map((list, i) => {
            const total = list.items.reduce((sum, it) => sum + (it.price ?? 0), 0);
            const priced = list.items.filter((it) => it.price != null);
            const cover = list.items.find((it) => it.imageUrl)?.imageUrl;
            const href = isDemo ? `/demo/lists/${list.id}` : `/lists/${list.id}`;

            return (
              <li key={list.id} className="border-b border-v-200 dark:border-v-800">
                <a href={href} className="group grid items-center gap-5 py-7 sm:grid-cols-[3rem_5rem_1fr_auto]">
                  <span className="tnum hidden font-semibold tracking-[-0.02em] text-[1.1rem] text-v-400 sm:block">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="grid size-[4.25rem] place-items-center overflow-hidden bg-v-0 dark:bg-v-900-2 text-xl dark:bg-v-0 dark:bg-v-9002-d">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="size-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <ListIcon name={list.emoji} className="size-6 text-v-300 dark:text-v-700" />
                    )}
                  </span>

                  <span className="min-w-0">
                    <span className="block font-semibold tracking-[-0.02em] text-[1.4rem] leading-tight transition-colors group-hover:text-a-600 dark:text-a-300 sm:text-[1.6rem]">
                      {list.title}
                    </span>
                    {list.description && (
                      <span className="mt-1 block max-w-xl text-[0.85rem] leading-relaxed text-v-500 dark:text-v-400">
                        {list.description}
                      </span>
                    )}
                    <span className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="chip bg-v-0 dark:bg-v-900-2 text-v-500 dark:text-v-400 dark:bg-v-0 dark:bg-v-9002-d dark:text-v-400">
                        {VISIBILITY[list.visibility] ?? list.visibility}
                      </span>
                      <span className="kicker text-v-400">
                        {list._count.items} {list._count.items === 1 ? "Item" : "Items"}
                        {list._count.shares > 0 && ` · ${list._count.shares} Shared`}
                      </span>
                    </span>
                  </span>

                  <span className="flex items-center gap-6 sm:justify-end">
                    {priced.length > 0 && (
                      <span className="tnum font-semibold tracking-[-0.02em] text-[1.35rem]">
                        {money(total, priced[0].currency)}
                      </span>
                    )}
                    <span
                      aria-hidden
                      className="text-lg text-v-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-a-600 dark:text-a-300"
                    >
                      →
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="mt-16">
          <div className="flex items-baseline gap-3 border-b border-v-200 pb-3 dark:border-v-800">
            <h2 className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-v-400">Archived</h2>
            <p className="text-[0.8125rem] text-v-400">
              {archived.length} {archived.length === 1 ? "list" : "lists"} kept, out of the way.
            </p>
          </div>
          <ul>
            {archived.map((list) => {
              const href = isDemo ? `/demo/lists/${list.id}` : `/lists/${list.id}`;
              return (
                <li key={list.id} className="border-b border-v-200 dark:border-v-800">
                  <a href={href} className="group flex items-center gap-4 py-4 opacity-70 transition-opacity hover:opacity-100">
                    <span className="grid size-10 shrink-0 place-items-center bg-v-0 dark:bg-v-900-2">
                      <ListIcon name={list.emoji} className="size-5 text-v-300 dark:text-v-700" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium tracking-[-0.01em]">{list.title}</span>
                      <span className="kicker text-v-400">
                        {list._count.items} {list._count.items === 1 ? "item" : "items"} · archived{" "}
                        {list.archivedAt ? new Date(list.archivedAt).toLocaleDateString() : ""}
                      </span>
                    </span>
                    <ArchiveRestore className="size-4 shrink-0 text-v-300 transition-colors group-hover:text-a-600 dark:text-a-300" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isDemo ? null : <ExtensionSetupCard className="mt-16" apiToken={apiToken ?? ""} />}
    </div>
  );
}

export function DemoNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-10 border-l-2 border-a-500 pl-4">
      <p className="kicker text-a-600 dark:text-a-300">Demo mode</p>
      <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-v-500 dark:text-v-400">
        Browsing the seeded data without signing in, because this preview frame blocks cookies.
        Read-only.
        {children}
      </p>
    </div>
  );
}
