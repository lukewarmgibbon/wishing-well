import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PeopleDirectory } from "@/components/PeopleDirectory";

export const metadata = { title: "People · Wishing Well" };

export default async function PeoplePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/people");

  const people = await prisma.user.findMany({
    where: { id: { not: session.user.id } },
    orderBy: { name: "asc" },
    take: 100,
    select: {
      id: true,
      name: true,
      image: true,
      email: true,
      _count: { select: { lists: true, followers: true } },
    },
  });

  const myFollows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followeeId: true },
  });
  const followingIds = new Set(myFollows.map((f) => f.followeeId));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">People</h1>
      <p className="mt-1 text-v-500 dark:text-v-400">
        Follow someone to keep their shared lists on your gifting page. Or share a list with them directly
        from the list&apos;s sharing surface.
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
