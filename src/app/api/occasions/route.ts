import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserOrToken } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";
import { withOccurrenceMeta } from "@/lib/dates";
import { handler } from "@/lib/api";

const schema = z.object({
  title: z.string().trim().min(1, "Give the occasion a name.").max(120),
  date: z.string().datetime({ message: "Pick a valid date." }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  repeats: z.enum(["yearly", "none"]).optional(),
  kind: z.enum(["birthday", "wedding", "anniversary", "holiday", "other"]).optional(),
  leadDays: z.coerce.number().int().min(0).max(365).optional(),
  // Whose occasion this is. Defaults to the caller, so you can log your own.
  subjectId: z.string().optional(),
  listId: z.string().nullish(),
});

/** Occasions the caller can see: the ones they made, and the ones about them. */
export const GET = handler(async (req: Request) => {
  const user = await requireUserOrToken(req);

  const rows = await prisma.occasion.findMany({
    where: {
      OR: [
        { creatorId: user.id },
        { subjectId: user.id },
        { subject: { followers: { some: { followerId: user.id } } } },
      ],
    },
    include: { subject: { select: { id: true, name: true } }, list: { select: { id: true, title: true } } },
    orderBy: { date: "asc" },
  });

  const decorated = rows.map((o) => withOccurrenceMeta({ ...o, date: new Date(o.date) }));
  decorated.sort((a, b) => a.daysUntil - b.daysUntil);

  return NextResponse.json({ occasions: decorated });
});

export const POST = handler(async (req: Request) => {
  const user = await requireUserOrToken(req);
  const limit = guard(req, "apiWrite");
  if (!limit.ok) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });

  const body = schema.parse(await req.json());
  const subjectId = body.subjectId ?? user.id;

  // You may only log occasions for people you follow, or yourself.
  if (subjectId !== user.id) {
    const follows = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: user.id, followeeId: subjectId } },
    });
    if (!follows) {
      return NextResponse.json({ error: "You can only add occasions for people you follow." }, { status: 403 });
    }
  }

  if (body.listId) {
    const list = await prisma.wishlist.findFirst({
      where: { id: body.listId, OR: [{ ownerId: subjectId }, { ownerId: user.id }] },
      select: { id: true },
    });
    if (!list) return NextResponse.json({ error: "That list isn't available." }, { status: 404 });
  }

  const occasion = await prisma.occasion.create({
    data: {
      title: body.title,
      date: new Date(body.date),
      repeats: body.repeats ?? "yearly",
      kind: body.kind ?? "other",
      leadDays: body.leadDays ?? 14,
      subjectId,
      creatorId: user.id,
      listId: body.listId ?? null,
    },
    include: { subject: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ occasion }, { status: 201 });
});

export const DELETE = handler(async (req: Request) => {
  const user = await requireUserOrToken(req);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which occasion?" }, { status: 400 });

  const occasion = await prisma.occasion.findUnique({ where: { id } });
  if (!occasion) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (occasion.creatorId !== user.id && occasion.subjectId !== user.id) {
    return NextResponse.json({ error: "You can only remove your own occasions." }, { status: 403 });
  }

  await prisma.occasion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
