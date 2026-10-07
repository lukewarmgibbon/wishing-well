import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrToken } from "@/lib/auth";
import { handler } from "@/lib/api";

/** Lists the signed-in extension user can add items to. */
export const GET = handler(async (req: Request) => {
  const user = await requireUserOrToken(req);
  const lists = await prisma.wishlist.findMany({
    where: {
      OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id, role: "EDITOR" } } }],
    },
    orderBy: { title: "asc" },
    select: { id: true, title: true, emoji: true, slug: true, owner: { select: { name: true } } },
  });
  return NextResponse.json({ lists, user: { id: user.id, name: user.name } });
});
