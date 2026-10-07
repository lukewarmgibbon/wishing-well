import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/api";

/** Start following: their lists show up in your gifting dashboard. */
export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  if (id === me.id) return NextResponse.json({ error: "You already have your own lists." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "No such person." }, { status: 404 });

  await prisma.follow.upsert({
    where: { followerId_followeeId: { followerId: me.id, followeeId: id } },
    update: {},
    create: { followerId: me.id, followeeId: id },
  });

  return NextResponse.json({ following: true });
});

export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  await prisma.follow.deleteMany({ where: { followerId: me.id, followeeId: id } });
  return NextResponse.json({ following: false });
});
