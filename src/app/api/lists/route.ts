import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserOrToken } from "@/lib/auth";
import { handler } from "@/lib/api";
import { slugify } from "@/lib/slug";

const createSchema = z.object({
  title: z.string().trim().min(1, "Give your list a name.").max(120),
  description: z.string().trim().max(500).optional(),
  emoji: z.string().max(8).optional(),
  visibility: z.enum(["PRIVATE", "SHARED", "PUBLIC"]).optional(),
});

export const GET = handler(async (req: Request) => {
  const user = await requireUserOrToken(req);
  const lists = await prisma.wishlist.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { items: true, shares: true, links: true } },
      items: { select: { id: true, price: true, imageUrl: true, title: true, currency: true } },
    },
  });

  return NextResponse.json({
    lists: lists.map((l) => ({
      ...l,
      total: l.items.reduce((sum, i) => sum + (i.price ?? 0), 0),
      items: undefined,
      coverImage: l.items.find((i) => i.imageUrl)?.imageUrl ?? null,
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const user = await requireUserOrToken(req);
  const body = createSchema.parse(await req.json());

  const list = await prisma.wishlist.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      emoji: body.emoji ?? "Gift",
      visibility: body.visibility ?? "PRIVATE",
      slug: `${slugify(body.title)}-${randomBytes(3).toString("hex")}`,
      ownerId: user.id,
    },
  });

  return NextResponse.json({ list }, { status: 201 });
});
