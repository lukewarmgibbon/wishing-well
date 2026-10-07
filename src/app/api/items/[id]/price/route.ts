import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { loadListWithAccess } from "@/lib/access";
import { priceSummary, fetchPrice, recordPrice, dropPercent } from "@/lib/pricing";
import { guard } from "@/lib/rate-limit";
import { allows } from "@/lib/permissions";
import { handler } from "@/lib/api";

/** Price history for one item, newest first. */
export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, listId: true, price: true, currency: true },
  });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const found = await loadListWithAccess(item.listId, user.id);
  if (!found || !allows(found.level, "claim")) {
    return NextResponse.json({ error: "You do not have access to this list." }, { status: 403 });
  }

  const summary = await priceSummary(item.id, item.price);
  return NextResponse.json({ price: summary });
});

/** Trigger a best-effort re-check. Retailers block this often; that is fine. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const limit = guard(req, "apiWrite");
  if (!limit.ok) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, listId: true, url: true, price: true, currency: true },
  });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const found = await loadListWithAccess(item.listId, user.id);
  if (!found || !allows(found.level, "recheckPrice")) {
    return NextResponse.json({ error: "Only the list owner can re-check prices." }, { status: 403 });
  }

  const result = await fetchPrice(item.url);
  if (!result) {
    return NextResponse.json({
      checked: true,
      changed: false,
      note: "The retailer didn't serve a price this time. Nothing recorded.",
    });
  }

  if (Math.abs((result.price ?? 0) - (item.price ?? 0)) < 0.01) {
    return NextResponse.json({ checked: true, changed: false, price: result.price });
  }

  await recordPrice(item.id, result.price, result.currency, "check");
  await prisma.item.update({ where: { id }, data: { price: result.price, currency: result.currency } });

  const history = await prisma.itemPrice.findMany({
    where: { itemId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { price: true },
  });

  return NextResponse.json({
    checked: true,
    changed: true,
    price: result.price,
    previous: item.price,
    dropPercent: dropPercent(history.slice(1), result.price),
  });
});
