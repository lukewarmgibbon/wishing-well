import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, auth } from "@/lib/auth";
import { handler } from "@/lib/api";
import { loadListWithAccess, can } from "@/lib/access";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  emoji: z.string().max(8).optional(),
  visibility: z.enum(["PRIVATE", "SHARED", "PUBLIC"]).optional(),
  showPrices: z.boolean().optional(),
});

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const url = new URL(_req.url);
  const token = url.searchParams.get("token");

  const found = await loadListWithAccess(id, viewerId, token);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (!can(found.level, "viewer")) {
    return NextResponse.json({ error: "This list is private." }, { status: 403 });
  }

  const list = await prisma.wishlist.findUniqueOrThrow({
    where: { id: found.list.id },
    include: {
      items: {
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        include: { reservations: { include: { user: { select: { id: true, name: true, image: true } } } } },
      },
      shares: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      links: true,
    },
  });

  const isOwner = found.level === "owner";
  // Non-owners don't see who claimed what, and hidden items stay hidden.
  const items = list.items
    .filter((i) => isOwner || !i.hidden)
    .map((i) => ({
      ...i,
      price: isOwner || list.showPrices ? i.price : null,
      reservations: isOwner
        ? i.reservations.map((r) => ({
            id: r.id,
            userId: r.userId,
            name: r.user.name,
            image: r.user.image,
            note: r.note,
            createdAt: r.createdAt.toISOString(),
          }))
        : i.reservations.map((r) => ({ id: r.id, userId: r.userId })),
    }));

  return NextResponse.json({
    list: { ...list, items, links: isOwner ? list.links : [] },
    level: found.level,
  });
});

export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (found.level !== "owner") return NextResponse.json({ error: "Only the owner can change this." }, { status: 403 });

  const body = patchSchema.parse(await req.json());
  const list = await prisma.wishlist.update({ where: { id }, data: body });
  return NextResponse.json({ list });
});

export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (found.level !== "owner") return NextResponse.json({ error: "Only the owner can delete this." }, { status: 403 });

  await prisma.wishlist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
