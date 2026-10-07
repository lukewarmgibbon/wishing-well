import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/api";

/**
 * Find people to follow / share with.
 * Follow = "put their wishlists on my gifting dashboard".
 */
export const GET = handler(async (req: Request) => {
  const me = await requireUser();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  const people = await prisma.user.findMany({
    where: {
      id: { not: me.id },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    take: 20,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      _count: { select: { lists: true, followers: true } },
    },
  });

  const myFollows = await prisma.follow.findMany({
    where: { followerId: me.id, followeeId: { in: people.map((p) => p.id) } },
    select: { followeeId: true },
  });
  const followingIds = new Set(myFollows.map((f) => f.followeeId));

  return NextResponse.json({
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      // Only surface the email if we already share a list — no address harvesting.
      email: p.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
      image: p.image,
      listCount: p._count.lists,
      followerCount: p._count.followers,
      following: followingIds.has(p.id),
    })),
  });
});
