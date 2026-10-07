import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserOrToken } from "@/lib/auth";
import { handler } from "@/lib/api";
import { can } from "@/lib/access";
import { recordPrice } from "@/lib/pricing";

const itemSchema = z.object({
  listId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000),
  imageUrl: z.string().trim().url().max(2000).nullish(),
  price: z.number().min(0).max(1_000_000).nullish(),
  currency: z.string().length(3).optional(),
  note: z.string().trim().max(500).nullish(),
  priority: z.coerce.number().int().min(1).max(3).optional(),
});

/**
 * Add an item from the extension. Accepts a bearer token (extension) or the
 * web session cookie. 409s on a duplicate URL so double-clicking is harmless.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUserOrToken(req);
  const body = itemSchema.parse(await req.json());

  const list = await prisma.wishlist.findUnique({
    where: { id: body.listId },
    include: { shares: { where: { userId: user.id } } },
  });
  if (!list) return NextResponse.json({ error: "That list no longer exists." }, { status: 404 });

  const isEditor =
    list.ownerId === user.id || list.shares.some((s) => s.role === "EDITOR");
  if (!can(isEditor ? "editor" : "viewer", "editor")) {
    return NextResponse.json({ error: "You can view that list but not add to it." }, { status: 403 });
  }

  const existing = await prisma.item.findFirst({ where: { listId: list.id, url: body.url } });
  if (existing) {
    return NextResponse.json({ item: existing, duplicate: true }, { status: 200 });
  }

  const last = await prisma.item.findFirst({
    where: { listId: list.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const item = await prisma.item.create({
    data: {
      listId: list.id,
      title: body.title,
      url: body.url,
      imageUrl: body.imageUrl ?? null,
      price: body.price ?? null,
      currency: body.currency ?? "USD",
      note: body.note ?? null,
      priority: body.priority ?? 2,
      position: (last?.position ?? 0) + 1,
    },
  });

  // Seed price history from the scraped price so later checks have a baseline.
  if (item.price != null) await recordPrice(item.id, item.price, item.currency, "manual");

  await prisma.wishlist.update({ where: { id: list.id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ item, duplicate: false }, { status: 201 });
});
