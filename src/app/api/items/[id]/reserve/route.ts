import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";
import { handler } from "@/lib/api";
import { loadListWithAccess } from "@/lib/access";
import { allows } from "@/lib/permissions";

const schema = z.object({
  note: z.string().trim().max(300).optional(),
  // Claim without the owner being told who you are.
  anonymous: z.boolean().optional(),
});

async function loadItem(id: string, userId: string) {
  const item = await prisma.item.findUnique({
    where: { id },
    select: {
      id: true,
      listId: true,
      title: true,
      receivedAt: true,
      list: { select: { ownerId: true } },
    },
  });
  if (!item) return { error: "Item not found." as const, status: 404 };
  const found = await loadListWithAccess(item.listId, userId);
  if (!found || !allows(found.level, "claim")) {
    return { error: "You do not have access to this list." as const, status: 403 };
  }
  return { item, level: found.level };
}

/** Claim an item so nobody else buys the same gift. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();

  const limit = guard(req, "apiWrite");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Slow down a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await ctx.params;
  const g = await loadItem(id, user.id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  if (g.item.receivedAt) {
    return NextResponse.json({ error: "That gift has already been received." }, { status: 409 });
  }

  const body = schema.parse(await req.json().catch(() => ({})));
  const isOwner = g.item.list.ownerId === user.id;

  const existing = await prisma.reservation.findUnique({ where: { itemId: id } });
  if (existing && existing.userId !== user.id && !isOwner) {
    return NextResponse.json(
      { error: "Someone has already claimed this one. Have a look at their other lists!" },
      { status: 409 }
    );
  }

  // Falling back to the account preference means "claim quietly" is a setting
  // you set once, not a box you re-tick on every list.
  const prefs = await prisma.user.findUnique({
    where: { id: user.id },
    select: { anonClaims: true },
  });
  const anonymous = body.anonymous ?? prefs?.anonClaims ?? false;

  const reservation = await prisma.reservation.upsert({
    where: { itemId: id },
    update: { note: body.note ?? null, anonymous },
    create: { itemId: id, userId: user.id, note: body.note ?? null, anonymous },
  });

  return NextResponse.json({
    reserved: true,
    anonymous: reservation.anonymous,
    reservationId: reservation.id,
    isOwnerClaim: isOwner,
  });
});

/** Release a claim. The owner can release anyone's; you can always release your own. */
export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const g = await loadItem(id, user.id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const isOwner = g.item.list.ownerId === user.id;
  const existing = await prisma.reservation.findUnique({ where: { itemId: id } });
  if (!existing) return NextResponse.json({ reserved: false });
  if (existing.userId !== user.id && !isOwner) {
    return NextResponse.json({ error: "That isn't your claim to release." }, { status: 403 });
  }

  await prisma.reservation.delete({ where: { id: existing.id } });
  return NextResponse.json({ reserved: false });
});
