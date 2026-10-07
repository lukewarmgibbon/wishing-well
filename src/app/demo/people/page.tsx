import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PeopleDirectory } from "@/components/PeopleDirectory";
import { DemoNotice } from "@/components/views/ListsView";
import { demoUser, DEMO_ACCOUNTS } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DemoPeople() {
  const sam = await demoUser(DEMO_ACCOUNTS.sam);
  if (!sam) notFound();

  const people = await prisma.user.findMany({
    where: { id: { not: sam.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, image: true, email: true, _count: { select: { lists: true, followers: true } } },
  });
  const follows = await prisma.follow.findMany({ where: { followerId: sam.id }, select: { followeeId: true } });
  const followingIds = new Set(follows.map((f) => f.followeeId));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <DemoNotice />
      <h1 className="text-3xl font-bold tracking-tight">People</h1>
      <p className="mt-1 text-v-500 dark:text-v-400">
        Follow someone to keep their shared lists on your gifting page.
      </p>
      <PeopleDirectory
        people={people.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
          image: p.image,
          listCount: p._count.lists,
          followerCount: p._count.followers,
          following: followingIds.has(p.id),
        }))}
      />
    </div>
  );
}
