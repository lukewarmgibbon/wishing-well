import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { loadListWithAccess } from "@/lib/access";
import { slugify } from "@/lib/slug";
import { recordPrice } from "@/lib/pricing";
import { allows } from "@/lib/permissions";
import { handler } from "@/lib/api";

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  // "fresh" drops the items, "carry" copies them over unchecked.
  mode: z.enum(["fresh", "carry"]).default("fresh"),
});

/**
 * Rolls a list forward — the "it's December again" button.
 *
 * The original is left untouched, so last year's claims and history stay
 * readable. This is a copy, not a move.
 */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = schema.parse(await req.json().catch(() => ({})));

  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (!allows(found.level, "manageList")) {
    return NextResponse.json({ error: "Only the owner can roll this over." }, { status: 403 });
  }

  const source = await prisma.wishlist.findUniqueOrThrow({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });

  // Strip a trailing year so "Christmas 2026" becomes "Christmas 2027".
  const year = new Date().getFullYear() + 1;
  const baseTitle = (body.title ?? source.title).replace(/\b(20)?\d{2}\b/g, "").trim() || source.title;
  const title = body.title ?? `${baseTitle} ${year}`;

  const list = await prisma.wishlist.create({
    data: {
      title,
      description: source.description,
      emoji: source.emoji,
      visibility: "PRIVATE",
      showPrices: source.showPrices,
      slug: `${slugify(title)}-${randomBytes(3).toString("hex")}`,
      ownerId: user.id,
    },
  });

  // Items are copied in a second pass so each one can also get a price-history
  // row, which a nested `create` can't do.
  if (body.mode === "carry") {
    for (const [index, item] of source.items.entries()) {
      const created = await prisma.item.create({
        data: {
          listId: list.id,
          title: item.title,
          url: item.url,
          imageUrl: item.imageUrl,
          price: item.price,
          currency: item.currency,
          note: item.note,
          priority: item.priority,
          position: index + 1,
        },
      });
      if (item.price != null) await recordPrice(created.id, item.price, item.currency, "manual");
    }
  }

  return NextResponse.json({ list, copied: body.mode === "carry" ? source.items.length : 0 }, { status: 201 });
});
