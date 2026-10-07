import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserOrToken } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";
import { handler } from "@/lib/api";
import { can } from "@/lib/access";
import { recordPrice } from "@/lib/pricing";

const MAX_ITEMS = 40;

const itemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000),
  imageUrl: z.string().trim().url().max(2000).nullish(),
  price: z.number().min(0).max(1_000_000).nullish(),
  currency: z.string().length(3).optional(),
  note: z.string().trim().max(500).nullish(),
});

const schema = z.object({
  listId: z.string().min(1),
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
});

export type BulkResult = {
  added: { title: string; url: string; id: string }[];
  duplicates: { title: string; url: string }[];
  invalid: { title: string; url: string; reason: string }[];
};

/** Normalise so "?utm_source=x" and "#frag" don't defeat dedupe. */
function canonical(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|ref_|gclid$|fbclid$|_encoding$)/i.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.replace(/^www\./, "");
    u.protocol = "https:";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

/**
 * Save many products from one page in a single round trip.
 *
 * Each item is reported individually — a bulk save that half-fails and says
 * "done" is worse than one that tells you which three didn't make it.
 * Dedupe is two-layer: within the batch itself, and against the list.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUserOrToken(req);

  const limit = guard(req, "itemBulk");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "That's a lot of saving. Try again in a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const body = schema.parse(await req.json());

  const list = await prisma.wishlist.findUnique({
    where: { id: body.listId },
    include: { shares: { where: { userId: user.id } } },
  });
  if (!list) return NextResponse.json({ error: "That list no longer exists." }, { status: 404 });

  const isEditor = list.ownerId === user.id || list.shares.some((s) => s.role === "EDITOR");
  if (!can(isEditor ? "editor" : "viewer", "editor")) {
    return NextResponse.json({ error: "You can view that list but not add to it." }, { status: 403 });
  }

  const last = await prisma.wishlist.findUnique({
    where: { id: list.id },
    select: { items: { orderBy: { position: "desc" }, take: 1, select: { position: true } } },
  });
  let position = last?.items[0]?.position ?? 0;

  // One query for everything already on the list, so this stays O(1) round
  // trips no matter how big the list is.
  const existingRows = await prisma.item.findMany({
    where: { listId: list.id },
    select: { id: true, url: true },
  });
  const seen = new Set(existingRows.map((r) => canonical(r.url)));

  const result: BulkResult = { added: [], duplicates: [], invalid: [] };

  for (const raw of body.items) {
    const url = canonical(raw.url);
    if (seen.has(url)) {
      result.duplicates.push({ title: raw.title, url: raw.url });
      continue;
    }

    try {
      position += 1;
      const item = await prisma.item.create({
        data: {
          listId: list.id,
          title: raw.title,
          url: raw.url,
          imageUrl: raw.imageUrl ?? null,
          price: raw.price ?? null,
          currency: raw.currency ?? "USD",
          note: raw.note ?? null,
          priority: 2,
          position,
        },
        select: { id: true },
      });
      seen.add(url);
      result.added.push({ id: item.id, title: raw.title, url: raw.url });
      if (raw.price != null) await recordPrice(item.id, raw.price, raw.currency ?? "USD", "manual");
    } catch (err) {
      result.invalid.push({
        title: raw.title,
        url: raw.url,
        reason: err instanceof Error ? err.message : "Could not save that one.",
      });
    }
  }

  if (result.added.length) {
    await prisma.wishlist.update({ where: { id: list.id }, data: { updatedAt: new Date() } });
  }

  return NextResponse.json(result, { status: result.added.length ? 201 : 200 });
});
