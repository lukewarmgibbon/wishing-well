import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Gift, HeartHandshake, Users, ArrowRight, ExternalLink } from "lucide-react";
import { DemoNotice } from "@/components/views/ListsView";

export const metadata = { title: "Demo · Wishing Well" };
export const dynamic = "force-dynamic";

export default async function DemoIndex() {
  const lists = await prisma.wishlist.findMany({
    select: { slug: true, title: true, emoji: true, owner: { select: { name: true } }, visibility: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <DemoNotice />

      <h1 className="text-3xl font-bold tracking-tight">Every main page, no sign-in needed</h1>
      <p className="mt-1 text-v-500 dark:text-v-400">
        The preview frame blocks cookies, so these read-only routes render the seeded data directly.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Main screens</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <DemoLink href="/demo/lists" Icon={Gift} title="My lists" desc="Dashboard of lists, with totals and claim counts" />
          <DemoLink href="/demo/gifts" Icon={HeartHandshake} title="Gifting" desc="Everyone you follow, unclaimed items in one grid" />
          <DemoLink href="/demo/people" Icon={Users} title="People" desc="Directory for following friends and family" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">The gifting experience (as a guest)</h2>
        <p className="mt-1 text-sm text-v-500 dark:text-v-400">
          These are the real public URLs — they work signed out in any browser.
        </p>
        <ul className="mt-3 divide-y divide-v-200 dark:divide-v-800 surface">
          {lists.map((l) => (
            <li key={l.slug}>
              <Link href={`/w/${l.slug}`} className="flex items-center justify-between gap-3 p-4 hover:bg-v-50 dark:bg-v-900">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {l.title}
                  </span>
                  <span className="block text-xs text-v-400">
                    {l.owner.name} · {l.visibility.toLowerCase()}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[0.75rem] text-v-400">
                    /w/{l.slug}
                    <ExternalLink className="size-3.5" />
                  </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DemoLink({ href, Icon, title, desc }: { href: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; desc: string }) {
  return (
    <Link href={href} className="surface p-4 transition-shadow hover:">
      <span className="grid size-9 place-items-center rounded-[10px] bg-a-100 text-a-600 dark:bg-a-900/40 dark:text-a-300">
        <Icon className="size-[18px]" strokeWidth={1.7} />
      </span>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-v-500 dark:text-v-400">{desc}</p>
    </Link>
  );
}
