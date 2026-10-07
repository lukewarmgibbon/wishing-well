import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { loadListWithAccess } from "@/lib/access";
import { slugify } from "@/lib/slug";
import { allows } from "@/lib/permissions";
import { handler } from "@/lib/api";

const schema = z.object({ archived: z.boolean() });

/** Archive or restore. Archived lists vanish from the dashboard but stay intact. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { archived } = schema.parse(await req.json());

  const found = await loadListWithAccess(id, user.id);
  if (!found) return NextResponse.json({ error: "List not found." }, { status: 404 });
  if (!allows(found.level, "manageList")) {
    return NextResponse.json({ error: "Only the owner can archive this." }, { status: 403 });
  }

  const list = await prisma.wishlist.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });

  return NextResponse.json({ list });
});
