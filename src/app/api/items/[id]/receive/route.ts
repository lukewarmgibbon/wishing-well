import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { loadListWithAccess, can } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { handler } from "@/lib/api";

const schema = z.object({ received: z.boolean() });

/**
 * Closes the loop: the owner marks a gift as actually arrived. Only the list
 * owner may do this — a gifter claiming an item is a different act.
 */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { received } = schema.parse(await req.json());

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, listId: true, title: true, reservations: { select: { id: true, userId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const found = await loadListWithAccess(item.listId, user.id);
  if (!found) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  if (!allows(found.level, "markReceived")) {
    return NextResponse.json({ error: "Only the list owner can mark gifts received." }, { status: 403 });
  }

  const updated = await prisma.item.update({
    where: { id },
    data: { receivedAt: received ? new Date() : null },
  });

  // Receiving a claimed gift frees the claim, so it can be re-gifted later.
  if (received && item.reservations.length) {
    await prisma.reservation.deleteMany({ where: { itemId: id } });
  }

  return NextResponse.json({ item: updated, releasedClaim: received && item.reservations.length > 0 });
});
