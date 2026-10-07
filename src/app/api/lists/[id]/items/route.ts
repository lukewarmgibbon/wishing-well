import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { loadListWithAccess, can } from "@/lib/access";
import { guard } from "@/lib/rate-limit";
import { recordPrice } from "@/lib/pricing";

const itemSchema = z.object({
  title: z.string().trim().min(1, "Give the item a name.").max(300),
  url: z.string().trim().url("That doesn't look like a valid link.").max(2000),
  imageUrl: z.string().trim().url().max(2000).nullish(),
  price: z.number().min(0).max(1_000_000).nullish(),
  currency: z.string().length(3).optional(),
  note: z.string().trim().max(500).nullish(),
  priority: z.coerce.number().int().min(1).max(3).optional(),
  hidden: z.boolean().optional(),
});

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();

  const limit = guard(req, "itemCreate");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "That's a lot of items at once. Try again shortly." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await ctx.params;
  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (!can(found.level, "editor")) {
    return NextResponse.json({ error: "You can view this list but not add to it." }, { status: 403 });
  }

  const body = itemSchema.parse(await req.json());

  // Warn when the same product is already on another of this owner's lists.
  const [onThisList, elsewhere] = await Promise.all([
    prisma.item.findFirst({ where: { listId: id, url: body.url }, select: { id: true, listId: true } }),
    prisma.item.findFirst({
      where: { url: body.url, list: { ownerId: user.id, id: { not: id } } },
      select: { id: true, list: { select: { id: true, title: true } } },
    }),
  ]);

  if (onThisList) {
    const existing = await prisma.item.findUniqueOrThrow({ where: { id: onThisList.id } });
    return NextResponse.json({ item: existing, duplicate: true }, { status: 200 });
  }

  const last = await prisma.item.findFirst({
    where: { listId: id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const item = await prisma.item.create({
    data: {
      listId: id,
      title: body.title,
      url: body.url,
      imageUrl: body.imageUrl ?? null,
      price: body.price ?? null,
      currency: body.currency ?? "USD",
      note: body.note ?? null,
      priority: body.priority ?? 2,
      hidden: body.hidden ?? false,
      position: (last?.position ?? 0) + 1,
    },
  });

  if (item.price != null) await recordPrice(item.id, item.price, item.currency, "manual");

  await prisma.wishlist.update({ where: { id }, data: { updatedAt: new Date() } });
  return NextResponse.json(
    {
      item,
      duplicate: false,
      alsoOn: elsewhere?.list ? { id: elsewhere.list.id, title: elsewhere.list.title } : null,
    },
    { status: 201 }
  );
});
